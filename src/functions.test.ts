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
    } as ShouldBeReplacedResult);
  });

  it("should not hit when the from/to are in the same dir", () => {
    assert.deepEqual(shouldBeReplaced({
      targetFileId: "dir/from",
      toFileId: "dir/to",
      targetModuleName: "file",
    }), {
      hit: false,
    } as ShouldBeReplacedResult);
  });

  it("should hit", () => {
    assert.deepEqual(shouldBeReplaced({
      targetFileId: "fromDir/a",
      toFileId: "toDir/a",
      targetModuleName: "./file",
    }), {
      hit: true,
      newModuleId: "../fromDir/file",
    } as ShouldBeReplacedResult);
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

  it("to deep dir", () => {
    assert.deepEqual(shouldBeReplacedWithModuleMove({
      targetFileId: "a/b/c/fuga.js",
      targetModuleName: "./hogehoge",
      movingFileId: "a/b/c/hogehoge.js",
      toFileId: "a/b/c/newhoge/hogehoge.js",
    }), {
      hit: true,
      newModuleId: "./newhoge/hogehoge",
    } as ShouldBeReplacedResult);
  });

  it("extension: JSX", () => {
    assert.deepEqual(shouldBeReplacedWithModuleMove({
      targetFileId: "a/b/c/fuga.js",
      targetModuleName: "./hogehoge",
      movingFileId: "a/b/c/hogehoge.jsx",
      toFileId: "a/b/c/newhoge.jsx",
    }), {
      hit: true,
      newModuleId: "./newhoge",
    } as ShouldBeReplacedResult);
  });

  it("extension: explicit load", () => {
    assert.deepEqual(shouldBeReplacedWithModuleMove({
      targetFileId: "a/b/c/fuga.js",
      targetModuleName: "./hogehoge.json",
      movingFileId: "a/b/c/hogehoge.json",
      toFileId: "a/b/c/newhoge.json",
    }), {
      hit: true,
      newModuleId: "./newhoge.json",
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

  it("should treat module name correctly when old name ends with 'index.js' ", () => {
    assert.deepEqual(shouldBeReplacedWithModuleMove({
      targetFileId: "a/b/c/fuga.js",
      targetModuleName: "./hogehoge",
      movingFileId: "a/b/c/hogehoge/index.js",
      toFileId: "a/b/c/newhoge.js",
    }), {
      hit: true,
      newModuleId: "./newhoge",
    } as ShouldBeReplacedResult);
  });

  it("should treat module name correctly when the new name ends with 'index.js' ", () => {
    assert.deepEqual(shouldBeReplacedWithModuleMove({
      targetFileId: "a/b/c/fuga.js",
      targetModuleName: "./hogehoge",
      movingFileId: "a/b/c/hogehoge.js",
      toFileId: "a/b/c/newhoge/index.js",
    }), {
      hit: true,
      newModuleId: "./newhoge",
    } as ShouldBeReplacedResult);
  });

  describe("options", () => {
    describe("rootImport", () => {
      it("should replace correctly", () => {
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

      it("should replace with complex conf", () => {
        assert.deepEqual(shouldBeReplacedWithModuleMove({
          targetFileId: "some-package/src/page/containers/index.jsx",
          targetModuleName: "~/ui/components/Button",
          movingFileId: "common/src/ui/components/Button/index.js",
          toFileId: "common/src/ui/components/AwesomeButton/index.js",
          opt: {
            rootImport: [
              { "rootPathSuffix": "common/src" },
              { "rootPathPrefix": "#", "rootPathSuffix": "common" },
            ]
          },
        }), {
          hit: true,
          newModuleId: "~/ui/components/AwesomeButton",
        } as ShouldBeReplacedResult);
      });
    });
  });
});
