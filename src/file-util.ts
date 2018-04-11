import * as path from "path";
import * as fs from "fs";
import * as mkdirp from "mkdirp";
import * as rimraf from "rimraf";
import { FileRef, SourceReader, SourceWriter, SourceRemover } from "./types";

function toFileId(filePath: string) {
  return filePath.replace(/\\/g, "/");
}

export class DefaultFileRef implements FileRef {

  readonly id: string;
  readonly path: string;

  constructor(filePath: string, root?: string) {
    this.path = root ? path.resolve(root, filePath) : filePath;
    this.id = toFileId(root && path.isAbsolute(filePath) ? path.relative(root, filePath) : filePath);
  }
}

export class FileSourceReader implements SourceReader {
  read(file: FileRef): Promise<string> {
    return new Promise((res, rej) => {
      fs.readFile(file.path, "utf-8", (err, content) => {
        if (err) return rej(err);
        res(content);
      });
    });
  }
}

export class FileSourceWriter implements SourceWriter {
  write(file: FileRef, source: string): Promise<void> {
    return new Promise((res, rej) => {
      mkdirp.sync(path.dirname(file.path));
      fs.writeFile(file.path, source, "utf-8", (err) => {
        if (err) return rej(err);
        res();
      });
    });
  }
}

export class RimrafAdapter implements SourceRemover {
  delete(file: FileRef): Promise<void>{
    return new Promise((res, rej) => {
      rimraf(file.path, (err) => {
        if (err) return rej(err);
        res();
      })
    });
  }
}
