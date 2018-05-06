import * as path from "path";
import {
  DocumentRef,
  DocumentEntityCreateOptions,
  DocumentEntity,
  FileRef,
  SourceReader,
  SourceWriter,
  SourceRemover,
  FileMappingOptions,
  Formatter,
} from "./types";

import { BabylonDocumentEntity, DefaultDocumentEntity } from "./doc-entity";
import { Prettier } from "./prettier";

export type DefaultDocumentRefCreateOptioons = {
  projectRoot: string,
  fileRef: FileRef,
  reader: SourceReader,
  writer: SourceWriter,
  remover: SourceRemover,
  fileMappingOptions: FileMappingOptions,
  formatter: Formatter,
};

function createEntity(opt: DocumentEntityCreateOptions) {
  const ext = path.extname(opt.fileRef.id);
  switch (ext) {
    case ".js":
    case ".mjs":
    case ".jsx":
      return new BabylonDocumentEntity(opt);
    default:
      return new DefaultDocumentEntity(opt);
  }
}

export class DefaultDocumentRef implements DocumentRef {

  private _phantom?: FileRef;
  private _file: FileRef;

  constructor(private _opt: DefaultDocumentRefCreateOptioons) {
    this._file = _opt.fileRef;
  }

  private _doc?: DocumentEntity | null;

  getFile() {
    if (this._phantom) return this._phantom;
    return this._file;
  }

  getDoc() {
    if (this._doc) return this._doc;
    const {
      reader,
      writer,
      remover,
      ...rest
    } = this._opt;
    const ref = createEntity({ ...rest });
    ref.reader = reader;
    ref.writer = writer;
    this._doc = ref;
    return this._doc;
  }

  detach(): void {
    this._doc = null;
  }

  async commit() {
    if (this._phantom && this._file.id !== this._phantom.id) {
      await this._opt.remover.delete(this._file);
      await this.getDoc().move(this._phantom);
      await this.getDoc().flush(true);
      this._file = this._phantom;
      this._phantom = undefined;
    }
    if (this._doc) {
      await this._doc.flush();
    }
    return this;
  }

  async move(to: FileRef) {
    this._phantom = to;
    return this;
  }
}
