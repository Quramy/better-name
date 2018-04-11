import { shouldBeReplaced, shouldBeReplacedWithModuleMove, ShouldBeReplacedResult, replaceRootImport } from "./functions";
import * as assert from "assert";

describe("replaceRootImport", () => {
  it("should replace module name with suffix", () => {
    const actual = replaceRootImport("~/hoge", "src/index.js", { rootPathSuffix: "src" });
    assert.equal(actual.moduleName, "./hoge");
    assert.equal(actual.decorateWithConfig("./fuga"), "~/fuga");
  });

  it("should replace module name with suffix when the module is in the other dir", () => {
    const actual = replaceRootImport("~/b/hoge", "src/a/index.js", { rootPathSuffix: "src" });
    assert.equal(actual.moduleName, "../b/hoge");
  });

  it("should replace module name with prefix", () => {
    const actual = replaceRootImport("@/hoge", "index.js", { rootPathPrefix: "@" });
    assert.equal(actual.moduleName, "./hoge");
    assert.equal(actual.decorateWithConfig("./fuga"), "@/fuga");
  });

  it("should replace module name with prefix and suffix", () => {
    const actual = replaceRootImport("#/hoge", "package-a/index.js", { rootPathPrefix: "#", rootPathSuffix: "common" });
    assert.equal(actual.moduleName, "../common/hoge");
    assert.equal(actual.decorateWithConfig("../shared/foo"), "../shared/foo");
  });

  it("should replace module name with suffix", () => {
    const actual = replaceRootImport("~/feat-b/hogehoge", "src/feat-a/fuga.js", { rootPathSuffix: "src" });
    assert.equal(actual.moduleName, "../feat-b/hogehoge");
    assert.equal(actual.decorateWithConfig("../feat-b/newHoge"), "~/feat-b/newHoge");
  });
});

describe("shouldBeReplaced", () => {
  it("should not hit when the target module is in node_modules", () => {
    assert.deepEqual(shouldBeReplaced({
      targetFileId: "fromDir/a",
      toFileId: "toDir/a",
      targetModuleName: "file",
    }), {
      hit: false,
    } as ShouldBeReplacedResult)
  });

  it("should not hit when the from/to are in the same dir", () => {
    assert.deepEqual(shouldBeReplaced({
      targetFileId: "dir/from",
      toFileId: "dir/to",
      targetModuleName: "file",
    }), {
      hit: false,
    } as ShouldBeReplacedResult)
  });

  it("should hit", () => {
    assert.deepEqual(shouldBeReplaced({
      targetFileId: "fromDir/a",
      toFileId: "toDir/a",
      targetModuleName: "./file",
    }), {
      hit: true,
      newModuleId: "../fromDir/file",
    } as ShouldBeReplacedResult)
  });
});

describe("shouldBeReplacedWithModuleMove", () => {
  it("exactly equal", () => {
    assert.deepEqual(shouldBeReplacedWithModuleMove({
      targetFileId: "a/b/c/fuga.js",
      targetModuleName: "./hogehoge",
      movingFileId: "a/b/c/hogehoge.js",
      toFileId: "a/b/c/newhoge.js",
    }), {
      hit: true,
      newModuleId: "./newhoge",
    } as ShouldBeReplacedResult);
  });

  it("extension: JSON", () => {
    assert.deepEqual(shouldBeReplacedWithModuleMove({
      targetFileId: "a/b/c/fuga.js",
      targetModuleName: "./hogehoge",
      movingFileId: "a/b/c/hogehoge.json",
      toFileId: "a/b/c/newhoge.json",
    }), {
      hit: true,
      newModuleId: "./newhoge",
    } as ShouldBeReplacedResult);
  });

  it("directory mismatch", () => {
    assert.deepEqual(shouldBeReplacedWithModuleMove({
      targetFileId: "/a/b/c/fuga.js",
      targetModuleName: "./hogehoge",
      movingFileId: "/a/b/hogehoge.js",
      toFileId: "/a/b/c/newhoge.js",
    }), { hit: false } as ShouldBeReplacedResult);
  });

  it("node_modules", () => {
    assert.deepEqual(shouldBeReplacedWithModuleMove({
      targetFileId: "a/b/c/fuga.js",
      targetModuleName: "hogehoge",
      movingFileId: "a/b/c/hogehoge.js",
      toFileId: "a/b/c/newhoge.js",
    }), { hit: false } as ShouldBeReplacedResult);
  });

  describe("options", () => {
    describe("rootImport", () => {
      assert.deepEqual(shouldBeReplacedWithModuleMove({
        targetFileId: "src/feat-a/fuga.js",
        targetModuleName: "~/feat-b/hogehoge",
        movingFileId: "src/feat-b/hogehoge.js",
        toFileId: "src/feat-b/newHoge.js",
        opt: {
          rootImport: [{ rootPathSuffix: "src" }],
        },
      }), {
        hit: true,
        newModuleId: "~/feat-b/newHoge",
      } as ShouldBeReplacedResult);
    });
  });
});
