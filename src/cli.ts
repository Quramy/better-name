#!/usr/bin/env node

import * as yargs from "yargs";
import { createDefaultProject } from "./project";
import { rename } from "./rename";

function getVersion(){
  try {
    return require("../package.json").version as string;
  } catch (err) {
    return "DEVELOPMENT";
  }
}

function createOptions() {
  yargs
    .usage("Usage: $0 [options] <from> <to>")
    .help()
    .option("h", { alias: "help" })
    .option("version", { alias: "v", desc: "Print version number." }).version(getVersion())
    .option("patterns", { alias: "p", desc: "Project file glob pattern.", array: true })
  ;
  return yargs.argv as {
    _: string[],
    patterns?: string[],
  };
}

async function main() {
  const argv = createOptions();
  if (argv._.length < 2) {
    yargs.showHelp();
    return;
  }
  let additionalConf = { } as { patterns?: string[] };
  if (argv.patterns && argv.patterns.length) additionalConf.patterns = argv.patterns;
  const prj = await createDefaultProject({ ...additionalConf, rootDir: process.cwd() });
  await rename(prj, argv._[0], argv._[1]);
}

main();
