import { FileRef, SourceReader, SourceWriter } from "./types";
import { createProject } from "./project";
import { BabylonDocmentEntity } from "./docEntity";
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
  describe("#transformPreceding", () => {
    it("should not replace source in the same dir move", async done => {
      const io = new TestSourceIO(`import HogeHoge from './hogehoge';`)
      const docEntity = new BabylonDocmentEntity({ fileRef: new DummyFile("fromFile") });
      docEntity.reader = docEntity.writer = io;
      await docEntity.parse();
      docEntity.transformPreceding("toFile");
      await docEntity.flush();
      assert.equal(io.source, `import HogeHoge from './hogehoge';`);
      done();
    });

    it("should replace source", async done => {
      const io = new TestSourceIO(`import HogeHoge from './hogehoge';`)
      const docEntity = new BabylonDocmentEntity({ fileRef: new DummyFile("fromDir/file") });
      docEntity.reader = docEntity.writer = io;
      await docEntity.parse();
      docEntity.transformPreceding("toDir/file");
      await docEntity.flush();
      assert.equal(io.source, `import HogeHoge from '../fromDir/hogehoge';`);
      done();
    });
  });

  describe("#transformFollowing", () => {
    it("should replace source", async done => {
      const io = new TestSourceIO(`import HogeHoge from './hogehoge';`)
      const docEntity = new BabylonDocmentEntity({ fileRef: new DummyFile("test") });
      docEntity.reader = docEntity.writer = io;
      await docEntity.parse();
      docEntity.transformFollowing({ from: 'hogehoge.js', to: 'fuga.js' });
      await docEntity.flush();
      assert.equal(io.source, `import HogeHoge from './fuga';`);
      done();
    });
  });
});
