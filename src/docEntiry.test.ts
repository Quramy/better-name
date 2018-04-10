import { FileRef, SourceReader, SourceWriter, createProject, BabylonDocmentEntity } from "./project";
import * as assert from "assert";

class TestSourceIO implements SourceReader, SourceWriter {
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

class DummyFile implements FileRef {
  constructor(public id: string) { }
  get path() {
    return "";
  }
}

describe("DocumentEntity", () => {
  describe("#transform", () => {
    it("should be replaced source", async done => {
      const io = new TestSourceIO(`import HogeHoge from './hogehoge';`)
      const docEntity = new BabylonDocmentEntity({ fileRef: new DummyFile("/prj/test") });
      docEntity.reader = docEntity.writer = io;
      await docEntity.parse()
      docEntity.transform({ from: '/prj/hogehoge.js', to: '/prj/fuga.js' });
      await docEntity.flush();
      assert.equal(io.source, `import HogeHoge from './fuga';`);
      done();
    });
  });
});
