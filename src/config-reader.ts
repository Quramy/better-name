import * as fs from "fs";
import * as path from "path";

import {
  FileMappingOptions,
  RootImportConfig,
} from "./types";

import {
  exists,
  readFileAsJson,
} from "./file-util";

export type BabelrcType = {
  plugins?: (
    {
      0: string,
      1: any,
    } | {
      0: "babel-root-imoprt",
      1: RootImportConfig[],
    } | string
  )[];
};

export function extractRootImportConfigFromBabelrc(babelrc: BabelrcType): RootImportConfig[] {
  if (!babelrc.plugins) return [];
  let conf: RootImportConfig[] = [];
  babelrc.plugins.forEach(p => {
    if (typeof p === "string") return;
    if (p[0] !== "babel-root-import") return;
    conf = p[1];
  })
  return conf;
}

export async function readRootImportConfig(rootDir: string) {
  try {
    let ret: RootImportConfig[] = [];
    if (exists(rootDir, "package.json")) {
      const pkg = await readFileAsJson(rootDir, "package.json");
      if (pkg["rootImport"]) {
        return pkg["rootImport"] as RootImportConfig[];
      }
    }
    if (exists(rootDir, ".babelrc")) {
      const babelrc = await readFileAsJson(rootDir, ".babelrc");
      return extractRootImportConfigFromBabelrc(babelrc);
    } 
    return [] as RootImportConfig[];
  } catch(err) {
    return [] as RootImportConfig[];
  }
}
