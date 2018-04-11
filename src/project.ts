import { parse } from "babylon";
import { File as FileAst, ImportDeclaration, stringLiteral } from "babel-types";
import traverse from "babel-traverse";
import generate from "babel-generator";
import * as glob from "glob";
import { shouldBeReplaced, shouldBeReplacedWithModuleMove } from "./functions";

import * as path from "path";
import * as fs from "fs";

import { DefaultFileRef, FileSourceReader, FileSourceWriter, RimrafAdapter } from "./file-util";

export type $DiffKey<T, U> = T extends U ? never : T;
export type $Diff<T, U> = Pick<T, $DiffKey<keyof T, keyof U>>;
export type $Optional<T> = { [P in keyof T]?: T[P] };
export type $PartialOptional<T, U> = $Diff<T, U> & $Optional<U>

export interface Project {
  getProjectDir(): string;
  getDocumentsList(): Promise<DocumentRef[]>;
}

export interface DocumentRef {
  getRef(): DocumentEntity;
  detach(): void;
}

export interface DocumentEntity {
  readonly fileRef: FileRef;
  readonly isDirty: boolean;
  parse(): Promise<this>;
  transformPreceding(to: string): this;
  transformFollowing(opt: TransformOptions): this;
  flush(): Promise<this>;
  move(newFile: FileRef): Promise<this>;
}

export interface FileRef {
  readonly id: string;
  readonly path: string;
}

export interface SourceReader {
  read(file: FileRef): Promise<string>;
}

export interface SourceWriter {
  write(file: FileRef, source: string): Promise<void>;
}

export interface SourceRemover {
  delete(file: FileRef): Promise<void>;
}

export class DefaultProject implements Project {
  private _docRefList?: DocumentRef[];
  protected reader: SourceReader = new FileSourceReader();
  protected writer: SourceWriter = new FileSourceWriter();
  protected remover: SourceRemover = new RimrafAdapter();

  constructor(
    private _config: AllProjectOptions,
  ) {
  }

  getProjectDir() {
    return this._config.rootDir;
  }

  getDocumentsList() {
    if (this._docRefList) {
      return Promise.resolve(this._docRefList);
    }
    return new Promise<DocumentRef[]>((resolve, reject) => {
      glob(this._config.pattern, { cwd: this._config.rootDir }, (err, files) => {
        if (err) return reject(err);
        resolve(files.map(f => {
          const fileRef = new DefaultFileRef(f, this._config.rootDir);
          return new DefaultDocumentRef({
            fileRef,
            reader: this.reader,
            writer: this.writer,
            remover: this.remover,
          });
        }));
      });
    });
  }
}

export type AllProjectOptions = {
  rootDir: string;
  pattern: string;
};

export const defaultProjectConfig = {
  pattern: "src/**/*.js",
}

export type ProjectOptions = $PartialOptional<AllProjectOptions, typeof defaultProjectConfig>;

export function createProject(configuration: ProjectOptions) {
  const conf = { ...defaultProjectConfig, ...configuration }
  return new DefaultProject(conf);
}

export interface TransformOptions {
  from: string;
  to: string;
}

export type DefaultDocumentRefCreateOptioons = {
  fileRef: FileRef,
  reader: SourceReader,
  writer: SourceWriter,
  remover: SourceRemover,
};

export class DefaultDocumentRef implements DocumentRef {

  constructor(private _opt: DefaultDocumentRefCreateOptioons) {
  }

  private _ref?: DocumentEntity | null;

  getRef() {
    if (this._ref) return this._ref;
    const ref = new BabylonDocmentEntity({ fileRef: this._opt.fileRef});
    ref.reader = this._opt.reader;
    ref.writer = this._opt.writer;
    ref.remover = this._opt.remover;
    this._ref = ref;
    return this._ref;
  }

  detach(): void {
    this._ref = null;
  }

}

export async function rename(prj: Project, fromPath: string, toPath: string) {
  const docRefs = await prj.getDocumentsList();
  const docs = docRefs.map(ref => ref.getRef());
  const from = new DefaultFileRef(fromPath, prj.getProjectDir());
  const to = new DefaultFileRef(toPath, prj.getProjectDir());
  const selfDoc = docs.find(doc => doc.fileRef.id === from.id);
  const restDocs = docs.filter(doc => doc.fileRef.id !== from.id);
  if (selfDoc) {
    await selfDoc.parse();
    selfDoc.transformPreceding(to.id);
  }
  await Promise.all(restDocs.map(async doc => {
    await doc.parse();
    doc.transformFollowing({ from: from.id, to: to.id });
    await doc.flush();
    return;
  }));
  if (!selfDoc) return prj;
  await selfDoc.move(to);
}

export class BabylonDocmentEntity implements DocumentEntity {

  private _fref: FileRef;

  private _dirty: boolean = true;
  private _rawSource?: string;
  private _file?: FileAst;

  reader!: SourceReader;
  writer!: SourceWriter;
  remover!: SourceRemover;

  constructor ({
    fileRef,
  }: {
    fileRef: FileRef,
  }) {
    this._fref= fileRef;
  }

  get fileRef() {
    return this._fref;
  }

  get isDirty() {
    return this._dirty;
  }

  async parse() {
    if (!this._dirty && this._rawSource) {
      return this;
    } else {
      this._rawSource = await this.reader.read(this.fileRef);
      this._file = parse(this._rawSource, {
        sourceType: "module",
      });
      this._dirty = false;
      return this;
    }
  }

  transformPreceding(to: string) {
    if (!this._file) {
      throw new Error("Call parse");
    }
    let flag = false;
    let newModuleName: string;
    traverse(this._file, {
      ImportDeclaration: (path) => {
        const result = shouldBeReplaced({
          targetModuleName: path.node.source.value,
          targetFileId: this.fileRef.id,
          toFileId: to,
        });
        if (result.hit) {
          flag = true;
          newModuleName = result.newModuleId;
        }
      },
      exit(path) {
        if (flag && path.isImportDeclaration()) flag = false;
      },
      StringLiteral: (path) => {
        if (flag && newModuleName) {
          path.replaceWith(stringLiteral(newModuleName));
          flag = false;
        }
      },
    });
    return this;
  }

  transformFollowing({ from, to } : TransformOptions): this {
    if (!this._file) {
      throw new Error("Call parse");
    }
    let flag = false;
    let newModuleName: string;
    traverse(this._file, {
      ImportDeclaration: (path) => {
        const result = shouldBeReplacedWithModuleMove({
          targetFileId: this.fileRef.id,
          targetModuleName: path.node.source.value,
          movingFileId: from,
          toFileId: to,
        });
        if (result.hit) {
          flag = true;
          newModuleName = result.newModuleId;
        }
      },
      exit(path) {
        if (flag && path.isImportDeclaration()) flag = false;
      },
      StringLiteral: (path) => {
        if (flag && newModuleName) {
          path.replaceWith(stringLiteral(newModuleName));
          flag = false;
        }
      },
    });
    return this;
  }

  async flush() {
    if (!this._file || !this._rawSource) {
      throw new Error("Cannot flush because the source or AST is not set.");
    }
    await this.writer.write(this.fileRef, generate(this._file, {}, this._rawSource).code);
    return this;
  }
  
  async move(newFile: FileRef) {
    if (this._fref.path === newFile.path) {
      return this;
    }
    if (this.remover) {
      await this.remover.delete(this._fref);
    }
    this._fref = newFile;
    await this.flush();
    return this;
  }

}
