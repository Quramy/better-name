import {
  createProject,
  rename,
} from "./project";

function main() {
  const prj = createProject({
    rootDir: process.cwd()
  });
  if (process.argv.length < 3) return;
  rename(prj, process.argv[1], process.argv[2]);
}
