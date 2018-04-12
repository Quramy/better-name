import { FileRef, SourceWriter, SourceRemover, } from "../src/types";
import { DefaultProject, createProject, AllProjectOptions } from "../src/project";
import { rename } from "../src/rename";
import * as path from "path";

class FixtureWriter implements SourceWriter {
  contentsMap = new Map<string, string>();

  write(file: FileRef, source: string): Promise<void> {
    this.contentsMap.set(file.id, source);
    return Promise.resolve();
  }

  dump() {
    const keys = Array.from(this.contentsMap.keys()).sort();
    return keys.map(k => {
      return `
// id: ${k}

${this.contentsMap.get(k)}`;
    }).join("\n");
  }
}

class NoopRemover implements SourceRemover {
  delete() {
    return Promise.resolve();
  }
}

class TestProject extends DefaultProject {
  protected writer = new FixtureWriter();
  protected remover = new NoopRemover();

  getSnapshot() {
    return this.writer.dump();
  }
}

describe("integration test", () => {

  it("simple_babel_prj", async done => {
    const rootDir = path.join(__dirname, "test-fixtures/simple_babel_prj");
    const prj = await createProject<TestProject>(TestProject, { rootDir, pattern: "src/**/*.js" });
    try {
      await rename(prj, path.join(rootDir, "src/core/target.js"), path.join(rootDir, "src/feat/dest.js"));
      expect(prj.getSnapshot()).toMatchSnapshot();
      done();
    } catch (err) {
      done(err);
    }
  });

  it("simple_babel_prj(keep filename)", async done => {
    const rootDir = path.join(__dirname, "test-fixtures/simple_babel_prj");
    const prj = await createProject<TestProject>(TestProject, { rootDir, pattern: "src/**/*.js" });
    try {
      await rename(prj, path.join(rootDir, "src/core/target.js"), path.join(rootDir, "src/feat"));
      expect(prj.getSnapshot()).toMatchSnapshot();
      done();
    } catch (err) {
      done(err);
    }
  });

  it("babel_root_import_prj", async done => {
    const rootDir = path.join(__dirname, "test-fixtures/babel_root_import_prj");
    const prj = await createProject<TestProject>(TestProject, {
      rootDir, pattern: "src/**/*.js",
    });
    expect(prj.getFileMappingOptions().rootImport).toBeTruthy();
    try {
      await rename(prj, path.join(rootDir, "src/common/util.js"), path.join(rootDir, "src/feat-b/util.js"));
      expect(prj.getSnapshot()).toMatchSnapshot();
      done();
    } catch (err) {
      done(err);
    }
  });
});
