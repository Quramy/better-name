#!/usr/bin/env node

import * as yargs from "yargs";
import { createDefaultProject } from "./project";
import { rename } from "./rename";
import { setupLogger, getLogger } from "./logger";

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
    .option("v", { alias: "verbose", desc: "Display debug logging messages.", boolean: true, default: false })
    .option("q", { alias: "quiet", desc: "Suppress logging messages", boolean: true, default: false })
    .option("prettier", { boolean: true, desc: "Format with prettier", default: true })
    .option("version", { alias: "v", desc: "Print version number." }).version(getVersion())
    .option("patterns", { alias: "p", desc: "Project file glob pattern.", array: true })
  ;
  return yargs.argv as {
    _: string[],
    patterns?: string[],
    verbose?: boolean,
    quiet?: boolean,
    prettier?: boolean,
  };
}

async function main() {
  const argv = createOptions();
  const logger = getLogger();
  if (argv._.length < 2) {
    yargs.showHelp();
    return;
  }
  let additionalConf = { } as { patterns?: string[], prettier?: boolean };
  if (argv.quiet) {
    logger._level = "silent";
  } else if(argv.verbose) {
    logger._level = "verbose";
  }
  if (argv.patterns && argv.patterns.length) additionalConf.patterns = argv.patterns;
  if (!argv.prettier) additionalConf.prettier = false;
  const prj = await createDefaultProject({ ...additionalConf, rootDir: process.cwd() });
  await rename(prj, argv._[0], argv._[1]);
}

setupLogger();
main();
