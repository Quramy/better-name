import * as glob from "glob";
import * as path from "path";
import * as fs from "fs";

import {
  $PartialOptional,
  Project,
  DocumentRef,
  DocumentEntity,
  FileRef,
  SourceReader,
  SourceWriter,
  SourceRemover,
} from "./types";

import { DefaultFileRef, FileSourceReader, FileSourceWriter, RimrafAdapter } from "./file-util";
import { shouldBeReplaced, shouldBeReplacedWithModuleMove } from "./functions";
import { BabylonDocmentEntity } from "./docEntity";

export class DefaultProject implements Project {
  private _docRefList?: DocumentRef[];
  protected reader: SourceReader = new FileSourceReader();
  protected writer: SourceWriter = new FileSourceWriter();
  protected remover: SourceRemover = new RimrafAdapter();

  constructor(
    private _config: AllProjectOptions,
  ) {
  }

  getProjectDir() {
    return this._config.rootDir;
  }

  getDocumentsList() {
    if (this._docRefList) {
      return Promise.resolve(this._docRefList);
    }
    return new Promise<DocumentRef[]>((resolve, reject) => {
      glob(this._config.pattern, { cwd: this._config.rootDir }, (err, files) => {
        if (err) return reject(err);
        resolve(files.map(f => {
          const fileRef = new DefaultFileRef(f, this._config.rootDir);
          return new DefaultDocumentRef({
            fileRef,
            reader: this.reader,
            writer: this.writer,
            remover: this.remover,
          });
        }));
      });
    });
  }
}

export type AllProjectOptions = {
  rootDir: string;
  pattern: string;
};

export const defaultProjectConfig = {
  pattern: "src/**/*.js",
}

export type ProjectOptions = $PartialOptional<AllProjectOptions, typeof defaultProjectConfig>;

export function createProject(configuration: ProjectOptions) {
  const conf = { ...defaultProjectConfig, ...configuration }
  return new DefaultProject(conf);
}

export type DefaultDocumentRefCreateOptioons = {
  fileRef: FileRef,
  reader: SourceReader,
  writer: SourceWriter,
  remover: SourceRemover,
};

export class DefaultDocumentRef implements DocumentRef {

  constructor(private _opt: DefaultDocumentRefCreateOptioons) {
  }

  private _ref?: DocumentEntity | null;

  getRef() {
    if (this._ref) return this._ref;
    const ref = new BabylonDocmentEntity({ fileRef: this._opt.fileRef});
    ref.reader = this._opt.reader;
    ref.writer = this._opt.writer;
    ref.remover = this._opt.remover;
    this._ref = ref;
    return this._ref;
  }

  detach(): void {
    this._ref = null;
  }

}
