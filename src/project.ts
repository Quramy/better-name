import * as path from "path";
import * as fs from "fs";
import { IOptions } from "glob";

// FIXME
type GlobAllFn = (patterns: string[], opt: IOptions, cb: (err: any, files: string[]) => void) => void
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

import { DefaultFileRef, FileSourceReader, FileSourceWriter, RimrafAdapter } from "./file-util";
import { DefaultDocumentRef } from "./doc-ref";

import {
  readRootImportConfig,
  readProjectConfig,
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
      globAll(this._config.patterns, { cwd: this._config.rootDir }, (err, files) => {
        if (err) return reject(err);
        const refs = files.map(f => {
          const fileRef = new DefaultFileRef(f, this._config.rootDir);
          return new DefaultDocumentRef({
            fileRef,
            reader: this.reader,
            writer: this.writer,
            remover: this.remover,
            fileMappingOptions: this._config.fileMapping,
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
};

export const defaultProjectConfig = {
  patterns: ["src/**/*.{js,mjs,jsx}", "!node_modules/**/*"],
  fileMapping: { },
}

export type ProjectOptions = $PartialOptional<AllProjectOptions, typeof defaultProjectConfig>;

export async function createProject<X extends DefaultProject>(k: typeof DefaultProject, configuration: ProjectOptions) {
  const { rootDir } = configuration;
  const rootImport = await readRootImportConfig(rootDir);
  const readConf = await readProjectConfig(rootDir);
  const conf = { ...defaultProjectConfig,  ...readConf, ...configuration }
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
