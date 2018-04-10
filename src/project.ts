import { parse } from "babylon";
import { File, ImportDeclaration, stringLiteral } from "babel-types";
import traverse from "babel-traverse";
import generate from "babel-generator";
import * as glob from "glob";
import { shouldBeReplaced } from "./functions";

export type $DiffKey<T, U> = T extends U ? never : T;
export type $Diff<T, U> = Pick<T, $DiffKey<keyof T, keyof U>>;
export type $Optional<T> = { [P in keyof T]?: T[P] };
export type $PartialOptional<T, U> = $Diff<T, U> & $Optional<U>

export interface Project {
  getProjectDir(): string;
  getDocumentsList(): Promise<DocumentRef[]>;
}

export interface DocumentRef {
  readonly ref?: DocumentEntity;
  detach(): void;
}

export interface DocumentEntity {
  readonly isDirty: boolean;
  parse(): Promise<this>;
  reader?: SourceReader;
  writer?: SourceWriter;
  transform(opt: TransformOptions): this;
  flush(): Promise<this>;
}

export class DefaultProject implements Project {
  private _docRefList?: DocumentRef[];

  constructor(
    private _config: AllProjectOptions,
  ) {
  }

  getProjectDir() {
    return this._config.rootDir;
  }

  async getDocumentsList() {
    if (this._docRefList) {
      return Promise.resolve(this._docRefList);
    }
    return new Promise<DocumentRef[]>((resolve, reject) => {
      glob(this._config.pattern, (err, files) => {
        if (err) return reject(err);
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

export interface SourceReader {
  read(id: string): Promise<string>;
}

export interface SourceWriter {
  write(id: string, source: string): Promise<void>;
}

export class BabylonDocmentEntity implements DocumentEntity {

  
  private _dirty: boolean = true;
  private _rawSource?: string;
  private _file?: File;

  readonly fileId: string;

  reader!: SourceReader;
  writer!: SourceWriter;

  constructor ({
    fileId,
  }: {
    fileId: string,
  }) {
    this.fileId = fileId;
  }

  get isDirty() {
    return this._dirty;
  }

  async parse() {
    if (!this._dirty && this._rawSource) {
      return this;
    } else {
      this._rawSource = await this.reader.read(this.fileId);
      this._file = parse(this._rawSource, {
        sourceType: "module",
      });
      this._dirty = false;
      return this;
    }
  }

  transform({ from, to } : TransformOptions): this {
    if (!this._file) {
      throw new Error("Call parse");
    }
    let flag = false;
    let newModuleName: string;
    traverse(this._file, {
      ImportDeclaration: (path) => {
        // if (/hogehoge/.test(path.node.source.value)) flag = true;
        const result = shouldBeReplaced({
          targetFileId: this.fileId,
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
    await this.writer.write(this.fileId, generate(this._file, {}, this._rawSource).code);
    return this;
  }

}
