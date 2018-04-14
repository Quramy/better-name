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
import { shouldBeReplaced, shouldBeReplacedWithModuleMove } from "./functions";
import { BabylonDocumentEntity, DefaultDocumentEntity } from "./docEntity";

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

export type DefaultDocumentRefCreateOptioons = {
  fileRef: FileRef,
  reader: SourceReader,
  writer: SourceWriter,
  remover: SourceRemover,
  fileMappingOptions: FileMappingOptions,
};

function createEntity(opt: DocumentEntityCreateOptions) {
  const ext = path.extname(opt.fileRef.id);
  switch (ext) {
    case ".js":
    case ".mjs":
    case ".jsx":
      return new BabylonDocumentEntity(opt);
    default:
      return new DefaultDocumentEntity(opt);
  }
}

export class DefaultDocumentRef implements DocumentRef {

  private _file: FileRef;

  constructor(private _opt: DefaultDocumentRefCreateOptioons) {
    this._file = _opt.fileRef;
  }

  private _doc?: DocumentEntity | null;

  getFile() {
    return this._file;
  }

  getDoc() {
    if (this._doc) return this._doc;
    const {
      reader,
      writer,
      remover,
      ...rest
    } = this._opt;
    const ref = createEntity({ ...rest });
    ref.reader = reader;
    ref.writer = writer;
    this._doc = ref;
    return this._doc;
  }

  detach(): void {
    this._doc = null;
  }

  async move(to:FileRef) {
    await this._opt.remover.delete(this._file);
    await this.getDoc().move(to);
    this._file = to;
    await this.getDoc().flush(true);
    return this;
  }
}
