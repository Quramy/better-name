import { shouldBeReplaced, ShouldBeReplacedResult, replaceRootImport } from "./functions";
import * as assert from "assert";

describe("replaceRootImport", () => {
  it("should replace module name with suffix", () => {
    const actual = replaceRootImport("~/hoge", "/local/src/index.js", "/local", { rootPathSuffix: "src" });
    assert.equal(actual.moduleName, "./hoge");
    assert.equal(actual.decorateWithConfig("./fuga"), "~/fuga");
  });

  it("should replace module name with suffix when the module is in the other dir", () => {
    const actual = replaceRootImport("~/b/hoge", "/local/src/a/index.js", "/local", { rootPathSuffix: "src" });
    assert.equal(actual.moduleName, "../b/hoge");
  });

  it("should replace module name with prefix", () => {
    const actual = replaceRootImport("@/hoge", "/local/index.js", "/local", { rootPathPrefix: "@" });
    assert.equal(actual.moduleName, "./hoge");
    assert.equal(actual.decorateWithConfig("./fuga"), "@/fuga");
  });

  it("should replace module name with prefix and suffix", () => {
    const actual = replaceRootImport("#/hoge", "/local/package-a/index.js", "/local", { rootPathPrefix: "#", rootPathSuffix: "common" });
    assert.equal(actual.moduleName, "../common/hoge");
    assert.equal(actual.decorateWithConfig("../shared/foo"), "../shared/foo");
  });

  it("should replace module name with suffix", () => {
    const actual = replaceRootImport("~/feat-b/hogehoge", "/local/project-root/src/feat-a/fuga.js", "/local/project-root", { rootPathSuffix: "src" });
    assert.equal(actual.moduleName, "../feat-b/hogehoge");
    assert.equal(actual.decorateWithConfig("../feat-b/newHoge"), "~/feat-b/newHoge");
  });
});

describe("shouldBeReplaced", () => {
  it("exactly equal", () => {
    assert.deepEqual(shouldBeReplaced({
      targetFileId: "/a/b/c/fuga.js",
      targetModuleName: "./hogehoge",
      movingFileId: "/a/b/c/hogehoge.js",
      toFileId: "/a/b/c/newhoge.js",
    }), {
      hit: true,
      newModuleId: "./newhoge",
    } as ShouldBeReplacedResult);
  });

  it("extension: JSON", () => {
    assert.deepEqual(shouldBeReplaced({
      targetFileId: "/a/b/c/fuga.js",
      targetModuleName: "./hogehoge",
      movingFileId: "/a/b/c/hogehoge.json",
      toFileId: "/a/b/c/newhoge.json",
    }), {
      hit: true,
      newModuleId: "./newhoge",
    } as ShouldBeReplacedResult);
  });

  it("directory mismatch", () => {
    assert.deepEqual(shouldBeReplaced({
      targetFileId: "/a/b/c/fuga.js",
      targetModuleName: "./hogehoge",
      movingFileId: "/a/b/hogehoge.js",
      toFileId: "/a/b/c/newhoge.js",
    }), { hit: false } as ShouldBeReplacedResult);
  });

  it("node_modules", () => {
    assert.deepEqual(shouldBeReplaced({
      targetFileId: "/a/b/c/fuga.js",
      targetModuleName: "hogehoge",
      movingFileId: "/a/b/c/hogehoge.js",
      toFileId: "/a/b/c/newhoge.js",
    }), { hit: false } as ShouldBeReplacedResult);
  });

  describe("options", () => {
    describe("rootImport", () => {
      assert.deepEqual(shouldBeReplaced({
        targetFileId: "/local/project-root/src/feat-a/fuga.js",
        targetModuleName: "~/feat-b/hogehoge",
        movingFileId: "/local/project-root/src/feat-b/hogehoge.js",
        toFileId: "/local/project-root/src/feat-b/newHoge.js",
        opt: {
          prjRoot: "/local/project-root",
          rootImport: [{ rootPathSuffix: "src" }],
        },
      }), {
        hit: true,
        newModuleId: "~/feat-b/newHoge",
      } as ShouldBeReplacedResult);
    });
  });
});
