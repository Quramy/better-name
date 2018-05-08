
import { SourceReader, SourceWriter, FileRef } from "../../types";

export class TestSourceIO implements SourceReader, SourceWriter {
  constructor(public source: string) {
  }

  write(file: FileRef, source: string): Promise<void> {
    this.source = source;
    return Promise.resolve();
  }

  read(file: FileRef): Promise<string> {
    return Promise.resolve(this.source);
  }
}

export class DummyFile implements FileRef {
  constructor(public id: string) { }
  get path() {
    return "";
  }
}

