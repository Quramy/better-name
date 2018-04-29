import {
  File as FileAst,
  ImportDeclaration,
  ExportAllDeclaration,
  ExportNamedDeclaration,
  stringLiteral,
  StringLiteral,
} from "@babel/types";
import { parse } from "babylon";
import traverse, { NodePath } from "@babel/traverse";
import generate from "@babel/generator";
import { getLogger } from "./logger";

import {
  FileRef,
  SourceReader,
  SourceWriter,
  SourceRemover,
  DocumentEntity,
  TransformOptions,
  FileMappingOptions,
} from "./types";

import {
  shouldBeReplaced,
  shouldBeReplacedWithModuleMove,
  ShouldBeReplacedResult,
} from "./functions";
import { Prettier } from "./prettier";

export class DefaultDocumentEntity implements DocumentEntity {
  private _fref: FileRef;
  private _code?: string;

  reader!: SourceReader;
  writer!: SourceWriter;

  constructor ({
    fileRef,
    fileMappingOptions = { },
  }: {
    fileRef: FileRef,
    fileMappingOptions?: FileMappingOptions,
  }) {
    this._fref= fileRef;
  }

  get fileRef() {
    return this._fref;
  }

  get isDirty() {
    return false;
  }

  async parse() {
    this._code = await this.reader.read(this.fileRef);
    return this;
  }

  transformPreceding(to: string): this {
    return this;
  }

  transformFollowing(opt: TransformOptions): this {
    return this;
  }

  async flush(force = false) {
    if (force) {
      await this.writer.write(this.fileRef, this._code || "");
    }
    return this;
  }

  async move(newFile: FileRef) {
    this._fref = newFile;
    return this;
  }
}

export class BabylonDocumentEntity implements DocumentEntity {

  private _fref: FileRef;

  private _touched: boolean = false;
  private _dirty: boolean = true;
  private _rawSource?: string;
  private _file?: FileAst;
  private _prettier: Prettier;

  reader!: SourceReader;
  writer!: SourceWriter;

  readonly fileMappingOptions: FileMappingOptions;

  constructor ({
    projectRoot = "",
    fileRef,
    fileMappingOptions = { },
    enabledPrettier = true,
  }: {
    projectRoot?: string,
    fileRef: FileRef,
    fileMappingOptions?: FileMappingOptions,
    enabledPrettier?: boolean,
  }) {
    this._fref= fileRef;
    this.fileMappingOptions = fileMappingOptions;
    this._prettier = new Prettier({ projectRoot, enabled: !!projectRoot && enabledPrettier });
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
      try {
        this._file = parse(this._rawSource, {
          sourceType: "module",
          // TODO
          // arguments type mismatch
          plugins: [
            "jsx",
            "flow",
            "classConstructorCall",
            "classProperties",
            "asyncGenerators",
            "decorators",
            "doExpressions",
            "dynamicImport",
            "exportExtensions",
            "functionBind",
            "functionSent",
            "objectRestSpread",
            "exportDefaultFrom" as any,
          ],
        });
      } catch (e) {
        console.error(this.fileRef.path, e);
        throw e;
      }
      this._dirty = false;
      return this;
    }
  }

  private _transformImports(matcher: (sourceNode: StringLiteral) => ShouldBeReplacedResult) {
    if (!this._file) {
      throw new Error("Don't call traverse before parsing AST. Call parse().");
    }
    let flag = false;
    let newModuleName: string;
    const pathHandler = (path: NodePath<ImportDeclaration | ExportAllDeclaration | ExportNamedDeclaration>) => {
      const { source } = path.node;
      if (!source) return;
      const result = matcher(source);
      if (result.hit) {
        flag = true;
        newModuleName = result.newModuleId;
      }
    };
    traverse(this._file, {
      ImportDeclaration: pathHandler,
      ExportAllDeclaration: pathHandler,
      ExportNamedDeclaration: pathHandler,
      exit(path) {
        if (flag && path.isImportDeclaration()) flag = false;
      },
      StringLiteral: (path) => {
        if (flag && newModuleName) {
          path.replaceWith(stringLiteral(newModuleName));
          this._touched = true;
          flag = false;
        }
      },
    });
    return this;
  }

  transformPreceding(to: string) {
    return this._transformImports(s => shouldBeReplaced({
      targetModuleName: s.value,
      targetFileId: this.fileRef.id,
      toFileId: to,
    }));
  }

  transformFollowing({ from, to } : TransformOptions): this {
    return this._transformImports(s => shouldBeReplacedWithModuleMove({
      targetFileId: this.fileRef.id,
      targetModuleName: s.value,
      movingFileId: from,
      toFileId: to,
      opt: this.fileMappingOptions,
    }));
  }

  async flush(force: boolean = false) {
    if (!this._touched && !force) return this;
    if (!this._file || !this._rawSource) {
      throw new Error("Cannot flush because the source or AST is not set.");
    }
    const newSrc = await this._prettier.format(generate(this._file, {}, this._rawSource).code);
    await this.writer.write(this.fileRef, newSrc);
    getLogger().info(`write contents to "${this.fileRef.id}".`);
    this._touched = false;
    return this;
  }
  
  async move(newFile: FileRef) {
    if (this._fref.path === newFile.path) {
      return this;
    }
    this._fref = newFile;
    return this;
  }

}
