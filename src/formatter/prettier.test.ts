import * as path from "path";
import * as assert from "assert";
import { Prettier } from "./prettier";

describe("prettier helper", () => {
  describe("#format", () => {

    it("should format correctly", async done => {
      const p = new Prettier({
        projectRoot: path.resolve(__dirname, "../../integration-test/test-fixtures/prettier_prj"),
      });
      const actual = await p.format(`const hoge = "HOGE"`);
      assert.equal(actual.trim(), `const hoge = 'HOGE';`);
      done();
    });

    it("should not format when enabled: false passed", async done => {
      const p = new Prettier({
        enabled: false,
        projectRoot: path.resolve(__dirname, "../integration-test/test-fixtures/prettier_prj"),
      });
      const actual = await p.format(`const hoge = "HOGE"`);
      assert.equal(actual.trim(), `const hoge = "HOGE"`);
      done();
    });

    it("should not format when invalid dir", async done => {
      const p = new Prettier({
        projectRoot: path.resolve(__dirname),
      });
      const actual = await p.format(`const hoge = "HOGE"`);
      assert.equal(actual.trim(), `const hoge = "HOGE"`);
      done();
    });
  });
});
