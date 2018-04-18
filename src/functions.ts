import * as fs from "fs";
import { posix as path } from "path";
import {
  RootImportConfig,
  FileMappingOptions,
} from "./types";

const defaultExtensions = [".js", ".mjs", ".jsx"];

export type ShouldBeReplacedResult = {
  hit: false,
} | {
  hit: true,
  newModuleId: string,
};

export function replaceRootImport(moduleName: string, fileId: string, config: RootImportConfig) {
  const prefix = (config.rootPathPrefix || "~") + "/";
  const suffix = config.rootPathSuffix || "";
  if (!moduleName.startsWith(prefix)) {
    return {
      moduleName,
      decorateWithConfig: (name: string) => name,
    };
  }
  const moduleFileId = path.join(suffix, moduleName.slice(prefix.length))
  const dir = path.dirname(fileId);
  const rel = path.relative(dir, moduleFileId);
  const decorate = (name: string) => {
    const resolved = prefix + path.relative(suffix, path.normalize(path.join(dir, name)));
    return /\/\.\.\//.test(resolved) ? name : resolved;
  };
  return {
    moduleName: rel.startsWith(".") ? rel : "./" + rel,
    decorateWithConfig: decorate,
  };
}

export function shouldBeReplaced({
  targetFileId,
  toFileId,
  targetModuleName,
} : {
  targetFileId: string,
  toFileId: string,
  targetModuleName: string,
}) : ShouldBeReplacedResult {
  if (!/^\./.test(targetModuleName)) return { hit: false };
  const fromDir = path.dirname(targetFileId), toDir = path.dirname(toFileId);
  if (fromDir === toDir) return { hit: false };
  const newModulePath = path.normalize(path.relative(toDir, path.join(fromDir, targetModuleName)));
  return {
    hit: true,
    newModuleId: newModulePath.startsWith(".") ? newModulePath : "./" + newModulePath,
  };
}

export function shouldBeReplacedWithModuleMove({
  targetFileId,
  targetModuleName,
  movingFileId,
  toFileId,
  opt = { },
} : {
  targetFileId: string,
  targetModuleName: string,
  movingFileId: string,
  toFileId: string,
  opt?: FileMappingOptions,
}) : ShouldBeReplacedResult {
  let decorate = (name: string) => name;
  if (opt.rootImport && opt.rootImport.length) {
    const result = opt.rootImport.reduce((acc, conf) => {
      return { ...replaceRootImport(targetModuleName, targetFileId, conf) };
    }, { moduleName: targetModuleName, decorateWithConfig: (name: string) => name });
    targetModuleName = result.moduleName;
    decorate = result.decorateWithConfig;
  }
  if (!/^\./.test(targetModuleName)) return { hit: false };
  const dir = path.dirname(targetFileId)
  const filePrefix = path.normalize(path.join(dir, targetModuleName));
  const extensions = defaultExtensions;
  let foundMoudle: string | undefined;
  if (path.extname(filePrefix) === "") {
    foundMoudle = [...extensions, ...extensions.map(ext => "/index" + ext)].map(ext => filePrefix + ext).find(fileId => fileId === movingFileId);
  } else if(filePrefix === movingFileId) {
    foundMoudle = filePrefix;
  }
  if (!foundMoudle) return { hit: false };
  const newModulePath = path.parse(path.relative(dir, toFileId));
  const suffix = extensions.some(ext => ext === newModulePath.ext) ? newModulePath.name : newModulePath.base;
  const prefix = newModulePath.dir === "" ? "." : newModulePath.dir.startsWith(".") ? newModulePath.dir : "." + "/" + newModulePath.dir;
  return {
    hit: true,
    newModuleId: (decorate(prefix + "/" + suffix)).replace(/\/index$/, ""),
  };
}
