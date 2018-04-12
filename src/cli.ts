#!/usr/bin/env node

import { createDefaultProject } from "./project";
import { rename } from "./rename";

async function main() {
  if (process.argv.length < 4) return;
  const prj = await createDefaultProject({ rootDir: process.cwd() });
  await rename(prj, process.argv[2], process.argv[3]);
}

main();
