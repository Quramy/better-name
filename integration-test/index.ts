import { FileRef, SourceWriter, SourceRemover, } from "../src/types";
import { DefaultProject, createProject, AllProjectOptions } from "../src/project";
import { FileSourceReader } from "../src/file-util";
import { rename } from "../src/rename";
import * as path from "path";

class FixtureIo extends FileSourceReader implements SourceWriter, SourceRemover {
  contentsMap = new Map<string, string>();

  write(file: FileRef, source: string): Promise<void> {
    this.contentsMap.set(file.id, source);
    return Promise.resolve();
  }

  read(file: FileRef) {
    if (this.contentsMap.has(file.id)) {
      return Promise.resolve(this.contentsMap.get(file.id) as string);
    } else {
      return super.read(file);
    }
  }

  delete(file: FileRef) {
    this.contentsMap.delete(file.id);
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

class TestProject extends DefaultProject {
  io: FixtureIo;

  constructor(args: any) {
    super(args);
    const fixtureIo = new FixtureIo();
    this.io = fixtureIo;
    this.reader = fixtureIo;
    this.writer = fixtureIo;
    this.remover = fixtureIo;
  }

  getSnapshot() {
    return this.io.dump();
  }
}

describe("integration test", () => {

  it("simple_babel_prj", async done => {
    const rootDir = path.join(__dirname, "test-fixtures/simple_babel_prj");
    const prj = await createProject<TestProject>(TestProject, { rootDir });
    try {
      await rename(prj, path.join(rootDir, "src/core/target.js"), path.join(rootDir, "src/feat/dest.js"));
      expect(prj.getSnapshot()).toMatchSnapshot();
      done();
    } catch (err) {
      done(err);
    }
  });

  it("simple_ts_prj", async done => {
    const rootDir = path.join(__dirname, "test-fixtures/simple_ts_prj");
    const prj = await createProject<TestProject>(TestProject, { rootDir });
    try {
      await rename(prj, path.join(rootDir, "src/core/target.ts"), path.join(rootDir, "src/feat/dest.ts"));
      expect(prj.getSnapshot()).toMatchSnapshot();
      done();
    } catch (err) {
      done(err);
    }
  });


  it("simple_babel_prj(keep filename)", async done => {
    const rootDir = path.join(__dirname, "test-fixtures/simple_babel_prj");
    const prj = await createProject<TestProject>(TestProject, { rootDir });
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
    const prj = await createProject<TestProject>(TestProject, { rootDir });
    expect(prj.getFileMappingOptions().rootImport).toBeTruthy();
    try {
      await rename(prj, path.join(rootDir, "src/common/util.js"), path.join(rootDir, "src/feat-b/util.js"));
      expect(prj.getSnapshot()).toMatchSnapshot();
      done();
    } catch (err) {
      done(err);
    }
  });

  it("babel_root_import_prj_flatten", async done => {
    const rootDir = path.join(__dirname, "test-fixtures/babel_root_import_prj_flatten");
    const prj = await createProject<TestProject>(TestProject, { rootDir });
    expect(prj.getFileMappingOptions().rootImport).toBeTruthy();
    try {
      await rename(prj, path.join(rootDir, "src/common/util.js"), path.join(rootDir, "src/feat-b/util.js"));
      expect(prj.getSnapshot()).toMatchSnapshot();
      done();
    } catch (err) {
      done(err);
    }
  });

  it("css_modules_prj", async done => {
    const rootDir = path.join(__dirname, "test-fixtures/css_modules_prj");
    const prj = await createProject<TestProject>(TestProject, { rootDir });
    try {
      await rename(prj, "src/components/Hoge", "src/components/Fuga");
      expect(prj.getSnapshot()).toMatchSnapshot();
      done();
    } catch (err) {
      done(err);
    }
  });
});
