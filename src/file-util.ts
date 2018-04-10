import * as path from "path";
import * as fs from "fs";
import { FileRef, SourceReader, SourceWriter } from "./project";

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
      fs.writeFile(file.path, source, "utf-8", (err) => {
        if (err) return rej(err);
        res();
      });
    });
  }
}
