import { File as FileAst, ImportDeclaration, stringLiteral } from "babel-types";
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
} from "./types";

import {
  shouldBeReplaced,
  shouldBeReplacedWithModuleMove,
} from "./functions";

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
