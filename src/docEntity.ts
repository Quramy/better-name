import { File as FileAst, ImportDeclaration, stringLiteral, StringLiteral } from "babel-types";
import { parse } from "babylon";
import traverse from "babel-traverse";
import generate from "babel-generator";

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

export class BabylonDocmentEntity implements DocumentEntity {

  private _fref: FileRef;

  private _touched: boolean = false;
  private _dirty: boolean = true;
  private _rawSource?: string;
  private _file?: FileAst;

  reader!: SourceReader;
  writer!: SourceWriter;
  remover!: SourceRemover;

  readonly fileMappingOptions: FileMappingOptions;

  constructor ({
    fileRef,
    fileMappingOptions = { },
  }: {
    fileRef: FileRef,
    fileMappingOptions?: FileMappingOptions,
  }) {
    this._fref= fileRef;
    this.fileMappingOptions = fileMappingOptions;
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

  private _transformImports(matcher: (sourceNode: StringLiteral) => ShouldBeReplacedResult) {
    if (!this._file) {
      throw new Error("Don't call traverse before parsing AST. Call parse().");
    }
    let flag = false;
    let newModuleName: string;
    traverse(this._file, {
      ImportDeclaration: (path) => {
        const result = matcher(path.node.source);
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

  async flush() {
    if (!this._file || !this._rawSource) {
      throw new Error("Cannot flush because the source or AST is not set.");
    }
    if (!this._touched) return this;
    await this.writer.write(this.fileRef, generate(this._file, {}, this._rawSource).code);
    this._touched = false;
    return this;
  }
  
  async move(newFile: FileRef) {
    this._touched = true;
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
