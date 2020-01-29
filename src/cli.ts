#!/usr/bin/env node

import * as yargs from "yargs";
import { createDefaultProject, ProjectOptions } from "./project";
import { rename } from "./rename";
import { setupLogger, getLogger } from "./logger";
import { FileMappingOptions } from "./types";

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
    .option("p", { alias: "pattern", desc: "Project file glob pattern." })
    .option("q", { alias: "quiet", desc: "Suppress logging messages", boolean: true, default: false })
    .option("prettier", { boolean: true, desc: "Format with prettier", default: false })
    .option("version", { desc: "Print version number." }).version(getVersion())
    .option("normalize-root-import", { desc: "Don't use root-import prefixed module source path after replacing. This option makes sense with using babel-root-import.", boolean: true, default: false })
    .option("test", { boolean: true, desc: "Run test mode.", default: false })
  ;
  return yargs.argv as {
    _: string[],
    pattern?: string,
    verbose?: boolean,
    quiet?: boolean,
    prettier?: boolean,
    test?: boolean,
    normalizeRootImport?: boolean,
  };
}

async function main() {
  const argv = createOptions();
  const logger = getLogger();
  if (argv._.length < 2) {
    yargs.showHelp();
    return;
  }
  const additionalConf = {
    fileMapping: { normalizeRootImport: false } as FileMappingOptions,
  } as ProjectOptions;
  if (argv.quiet) {
    logger._level = "silent";
  } else if(argv.verbose) {
    logger._level = "verbose";
  }
  if (argv.pattern) {
    if (typeof argv.pattern === "string") {
      additionalConf.patterns = [argv.pattern];
    } else if (Array.isArray(argv.pattern)) {
      additionalConf.patterns = argv.pattern;
    }
  }
  if (argv.prettier) additionalConf.prettier = true;
  if (argv.test) additionalConf.test = true;
  if (argv.normalizeRootImport) additionalConf.fileMapping!.normalizeRootImport = true;
  const prj = await createDefaultProject({ ...additionalConf, rootDir: process.cwd() });
  await rename(prj, argv._[0], argv._[1]);
}

setupLogger();
main();
