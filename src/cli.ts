#!/usr/bin/env node

import {
  createProject,
  rename,
} from "./project";

async function main() {
  const prj = createProject({
    rootDir: process.cwd()
  });
  if (process.argv.length < 4) return;
  await rename(prj, process.argv[2], process.argv[3]);
}

main();
