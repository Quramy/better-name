import * as path from "path";
import * as fs from "fs";
import { IOptions } from "glob";

// FIXME
type GlobAllFn = (patterns: string[], opt: IOptions, cb: (err: any, files: string[]) => void) => void;
const globAll = require("glob-all") as GlobAllFn;

import {
  $PartialOptional,
  Project,
  DocumentRef,
  DocumentEntityCreateOptions,
  DocumentEntity,
  FileId,
  FileRef,
  SourceReader,
  SourceWriter,
  SourceRemover,
  FileMappingOptions,
  FindQuery,
} from "./types";

import { DefaultFileRef, FileSourceReader, FileSourceWriter, RimrafAdapter, NoopWriter, NoopRemover } from "./file-util";
import { DefaultDocumentRef } from "./doc-ref";

import {
  readRootImportConfig,
  readProjectConfig,
} from "./config-reader";
import { getLogger } from "./logger";
import { Prettier, noopPrettier } from "./formatter/prettier";

export class DefaultProject implements Project {
  private _docRefList?: DocumentRef[];
  protected reader: SourceReader;
  protected writer: SourceWriter;
  protected remover: SourceRemover;

  constructor(
    private _config: AllProjectOptions,
  ) {
    this.reader = new FileSourceReader();
    if (_config.test) {
      this.writer = new NoopWriter();
      this.remover = new NoopRemover();
    } else {
      this.writer = new FileSourceWriter();
      this.remover = new RimrafAdapter();
    }
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
      globAll(this._config.patterns, { cwd: this._config.rootDir }, (err, files) => {
        if (err) return reject(err);
        const formatter = this._config.prettier ? new Prettier({ projectRoot: this._config.rootDir }) : noopPrettier;
        const refs = files.map(f => {
          const fileRef = new DefaultFileRef(f, this._config.rootDir);
          return new DefaultDocumentRef({
            projectRoot: this._config.rootDir,
            fileRef,
            reader: this.reader,
            writer: this.writer,
            remover: this.remover,
            fileMappingOptions: this._config.fileMapping,
            formatter,
          });
        });
        this._docRefList = refs;
        resolve(refs);
      });
    });
  }

  async findOne(fileId: FileId) {
    const docs = await this.getDocumentsList();
    let found: DocumentRef | undefined = undefined;
    const rest: DocumentRef[] = [];
    docs.forEach(d => {
      if (d.getFile().id === fileId) {
        found = d;
      } else {
        rest.push(d);
      }
    });
    return { found, rest };
  }

  async find(query: FindQuery) {
    const docs = await this.getDocumentsList();
    const found = [] as DocumentRef[];
    const rest = [] as DocumentRef[];
    docs.forEach(d => {
      if (query.start && d.getFile().id.startsWith(query.start)) {
        found.push(d);
      } else {
        rest.push(d);
      }
    });
    return { found, rest };
  }

  async commit() {
    const docs = await this.getDocumentsList();
    await Promise.all(docs.map(doc => doc.commit()));
    return this;
  }
}

export type AllProjectOptions = {
  rootDir: string;
  patterns: string[];
  fileMapping: FileMappingOptions;
  prettier: boolean;
  test: boolean,
};

export const defaultProjectConfig = {
  patterns: ["src/**/*.{js,mjs,jsx,ts,tsx}", "!node_modules/**/*"],
  fileMapping: { } as FileMappingOptions,
  prettier: true,
  test: false,
};

export type ProjectOptions = $PartialOptional<AllProjectOptions, typeof defaultProjectConfig>;

export async function createProject<X extends DefaultProject>(k: typeof DefaultProject, configuration: ProjectOptions) {
  const { rootDir } = configuration;
  const ric = await readRootImportConfig(rootDir);
  const readConf = await readProjectConfig(rootDir);
  const conf = { ...defaultProjectConfig,  ...readConf, ...configuration };
  conf.fileMapping = {
    ...ric,
    ...conf.fileMapping,
  };
  getLogger().verbose("project configurations: ", conf);
  const prj = new k({
    ...conf,
  }) as X;
  return prj;
}

export function createDefaultProject(configuration: ProjectOptions) {
  return createProject<DefaultProject>(DefaultProject, configuration);
}
