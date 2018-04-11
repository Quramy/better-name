import { FileRef, SourceWriter, SourceRemover, } from "./types";
import { DefaultProject } from "./project";
import { rename } from "./rename";
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

describe("Integration", () => {
  it("simple_babel_prj", async done => {
    const rootDir = path.join(__dirname, "../test-fixtures/simple_babel_prj");
    const prj = new TestProject({
      rootDir,
      pattern: "src/**/*.js",
    });
    try {
      await rename(prj, path.join(rootDir, "src/core/target.js"), path.join(rootDir, "src/feat/dest.js"));
      expect(prj.getSnapshot()).toMatchSnapshot();
      done();
    } catch (err) {
      done(err);
    }
  });
});
