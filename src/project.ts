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
  FileMappingOptions,
} from "./types";

import { DefaultFileRef, FileSourceReader, FileSourceWriter, RimrafAdapter } from "./file-util";
import { shouldBeReplaced, shouldBeReplacedWithModuleMove } from "./functions";
import { BabylonDocmentEntity } from "./docEntity";

import {
  readRootImportConfig,
} from "./config-reader";

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

  getFileMappingOptions() {
    return this._config.fileMapping;
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
            fileMappingOptions: this._config.fileMapping,
          });
        }));
      });
    });
  }
}

export type AllProjectOptions = {
  rootDir: string;
  pattern: string;
  fileMapping: FileMappingOptions;
};

export const defaultProjectConfig = {
  pattern: "src/**/*.js",
  fileMapping: { },
}

export type ProjectOptions = $PartialOptional<AllProjectOptions, typeof defaultProjectConfig>;

export async function createProject<X extends DefaultProject>(k: typeof DefaultProject, configuration: ProjectOptions) {
  const { rootDir } = configuration;
  const rootImport = await readRootImportConfig(rootDir);
  const conf = { ...defaultProjectConfig, ...configuration }
  conf.fileMapping = {
    rootImport: rootImport,
  };
  const prj = new k({ 
    ...conf,
  }) as X;
  return prj;
}

export function createDefaultProject(configuration: ProjectOptions) {
  return createProject<DefaultProject>(DefaultProject, configuration);
}

export type DefaultDocumentRefCreateOptioons = {
  fileRef: FileRef,
  reader: SourceReader,
  writer: SourceWriter,
  remover: SourceRemover,
  fileMappingOptions: FileMappingOptions,
};

export class DefaultDocumentRef implements DocumentRef {

  constructor(private _opt: DefaultDocumentRefCreateOptioons) {
  }

  private _ref?: DocumentEntity | null;

  getRef() {
    if (this._ref) return this._ref;
    const {
      reader,
      writer,
      remover,
      ...rest
    } = this._opt;
    const ref = new BabylonDocmentEntity({ ...rest });
    ref.reader = reader;
    ref.writer = writer;
    ref.remover = remover;
    this._ref = ref;
    return this._ref;
  }

  detach(): void {
    this._ref = null;
  }

}
