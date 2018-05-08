import {
  FileRef,
  SourceReader,
  SourceWriter,
  DocumentEntity,
  TransformOptions,
  FileMappingOptions,
} from "../types";

import { getLogger } from "../logger";

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
      getLogger().info(`write contents to "${this.fileRef.id}".`);
    }
    return this;
  }

  async move(newFile: FileRef) {
    this._fref = newFile;
    return this;
  }
}
