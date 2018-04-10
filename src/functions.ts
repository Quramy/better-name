
import * as fs from "fs";
import * as path from "path";

const defaultExtensions = ["js", "json", "jsx"];

export type ShouldBeReplacedResult = {
  hit: false,
} | {
  hit: true,
  newModuleId: string,
};

export type RootImportConfig = {
  rootPathSuffix?: string;
  rootPathPrefix?: string;
};

export function replaceRootImport(moduleName: string, fileId: string, prjRoot: string, config: RootImportConfig) {
  const prefix = (config.rootPathPrefix || "~") + "/";
  const suffix = config.rootPathSuffix || "";
  if (!moduleName.startsWith(prefix)) {
    return {
      moduleName,
      decorateWithConfig: (name: string) => name,
    };
  }
  const absModuleName = prjRoot + "/" + suffix + "/" + moduleName.slice(prefix.length)
  const dir = path.dirname(fileId);
  const rel = path.relative(dir, absModuleName);
  const decorate = (name: string) => {
    const resolved = prefix + path.relative(prjRoot + "/" + suffix, prjRoot + "/" + path.relative(prjRoot, dir) + "/" + name);
    return /\/\.\.\//.test(resolved) ? name : resolved;
  };
  return {
    moduleName: rel.startsWith(".") ? rel : "./" + rel,
    decorateWithConfig: decorate,
  };
}

export function shouldBeReplaced({
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
  opt?: {
    prjRoot?: string,
    rootImport?: RootImportConfig[],
  },
}) : ShouldBeReplacedResult {
  let decorate = (name: string) => name;
  if (opt.rootImport && opt.rootImport.length) {
    if (!opt.prjRoot) {
      throw new Error("Set prjRoot if using rootImport");
    } else {
      const result = opt.rootImport.reduce((acc, conf) => {
        return { ...replaceRootImport(targetModuleName, targetFileId, opt.prjRoot || "", conf) };
      }, { moduleName: targetModuleName, decorateWithConfig: (name: string) => name });
      targetModuleName = result.moduleName;
      decorate = result.decorateWithConfig;
    }
  }
  if (!/^\./.test(targetModuleName)) return { hit: false };
  const dir = path.dirname(targetFileId)
  const filePrefix = path.resolve(dir, targetModuleName);
  const extensions = defaultExtensions;
  const foundMoudle = extensions.map(ext => filePrefix + "." + ext).find(fileId => fileId === movingFileId);
  if (!foundMoudle) return { hit: false };
  const newModulePath = path.parse(path.relative(dir, toFileId));
  const suffix = extensions.some(ext => "." + ext === newModulePath.ext) ? newModulePath.name : newModulePath.base;
  const prefix = newModulePath.dir === "" ? "." : newModulePath.dir;
  return {
    hit: true,
    newModuleId: decorate(prefix + "/" + suffix),
  };
}
