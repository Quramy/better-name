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
    .option("pattern", { alias: "p", desc: "Project file glob pattern." })
    .option("test", { boolean: true, desc: "Run test mode.", default: false })
  ;
  return yargs.argv as {
    _: string[],
    pattern?: string,
    verbose?: boolean,
    quiet?: boolean,
    prettier?: boolean,
    test?: boolean,
  };
}

async function main() {
  const argv = createOptions();
  const logger = getLogger();
  if (argv._.length < 2) {
    yargs.showHelp();
    return;
  }
  const additionalConf = { } as { patterns?: string[], prettier?: boolean, test?: boolean };
  if (argv.quiet) {
    logger._level = "silent";
  } else if(argv.verbose) {
    logger._level = "verbose";
  }
  if (argv.pattern) additionalConf.patterns = [argv.pattern];
  if (!argv.prettier) additionalConf.prettier = false;
  if (argv.test) additionalConf.test = true;
  const prj = await createDefaultProject({ ...additionalConf, rootDir: process.cwd() });
  await rename(prj, argv._[0], argv._[1]);
}

setupLogger();
main();
