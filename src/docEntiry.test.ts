import { SourceReader, SourceWriter, createProject, BabylonDocmentEntity } from "./project";
import * as assert from "assert";

class TestSourceIO implements SourceReader, SourceWriter {
  constructor(public source: string) {
  }

  write(id: string, source: string): Promise<void> {
    this.source = source;
    return Promise.resolve();
  }

  read(id: string): Promise<string> {
    return Promise.resolve(this.source);
  }
}

describe("DocumentEntity", () => {
  describe("#transform", () => {
    it("should be replaced source", async done => {
      const io = new TestSourceIO(`import HogeHoge from './hogehoge';`)
      const docEntity = new BabylonDocmentEntity({ fileId: "test" });
      docEntity.reader = docEntity.writer = io;
      await docEntity.parse()
      docEntity.transform({ from: 'hogehoge', to: './fuga' });
      await docEntity.flush();
      assert.equal(io.source, `import HogeHoge from './fuga';`);
      done();
    });
  });
});
