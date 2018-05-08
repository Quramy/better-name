import * as assert from "assert";
import { TypeScriptDocumentEntity } from "./typescript-document";
import { DummyFile, TestSourceIO } from "./testing";

describe("TypeScriptDocumentEntity", () => {

  describe("#transformPreceding", () => {
    it("should not replace source in the same dir move", async done => {
      const io = new TestSourceIO(`import HogeHoge from './hogehoge';`);
      const docEntity = new TypeScriptDocumentEntity({ fileRef: new DummyFile("fromFile") });
      docEntity.reader = docEntity.writer = io;
      await docEntity.parse();
      docEntity.transformPreceding("toFile");
      await docEntity.flush();
      assert.equal(io.source, `import HogeHoge from './hogehoge';`);
      done();
    });

    it("should replace source", async done => {
      const io = new TestSourceIO(`
import HogeHoge from './hogehoge';
export * from './hogehoge';
export { default } from './hogehoge';
      `);
      const docEntity = new TypeScriptDocumentEntity({ fileRef: new DummyFile("fromDir/file") });
      docEntity.reader = docEntity.writer = io;
      await docEntity.parse();
      docEntity.transformPreceding("toDir/file");
      await docEntity.flush();
      assert.equal(io.source.trim(), `
import HogeHoge from "../fromDir/hogehoge";
export * from "../fromDir/hogehoge";
export { default } from "../fromDir/hogehoge";
      `.trim());
      done();
    });
  });

  describe("#transformFollowing", () => {
    it("should replace source", async done => {
      const io = new TestSourceIO(`
import HogeHoge from './hogehoge';
export * from './hogehoge';
export { default } from './hogehoge';
      `);
      const docEntity = new TypeScriptDocumentEntity({ fileRef: new DummyFile("test") });
      docEntity.reader = docEntity.writer = io;
      await docEntity.parse();
      docEntity.transformFollowing({ from: "hogehoge.ts", to: "fuga.ts" });
      await docEntity.flush();
      assert.equal(io.source.trim(), `
import HogeHoge from "./fuga";
export * from "./fuga";
export { default } from "./fuga";
      `.trim());
      done();
    });
  });
});
