export type $DiffKey<T, U> = T extends U ? never : T;
export type $Diff<T, U> = Pick<T, $DiffKey<keyof T, keyof U>>;
export type $Optional<T> = { [P in keyof T]?: T[P] };
export type $PartialOptional<T, U> = $Diff<T, U> & $Optional<U>;

export type FileId = string;

export interface FileRef {
  readonly id: FileId;
  readonly path: string;
}

export interface SourceReader {
  read(file: FileRef): Promise<string>;
}

export interface SourceWriter {
  write(file: FileRef, source: string): Promise<void>;
}

export interface SourceRemover {
  delete(file: FileRef): Promise<void>;
}

export interface DocumentRef {
  getFile(): FileRef;
  getDoc(): DocumentEntity;
  detach(): void;
  move(newFile: FileRef): Promise<this>;
  commit(): Promise<this>;
}

export interface TransformOptions {
  from: string;
  to: string;
}

export interface DocumentEntityCreateOptions {
  projectRoot: string;
  fileRef: FileRef;
  fileMappingOptions?: FileMappingOptions;
  enabledPrettier: boolean;
}

export interface DocumentEntity {
  readonly fileRef: FileRef;
  readonly isDirty: boolean;
  reader: SourceReader;
  writer: SourceWriter;
  parse(): Promise<this>;
  transformPreceding(to: string): this;
  transformFollowing(opt: TransformOptions): this;
  flush(force?: boolean): Promise<this>;
  move(newFile: FileRef): Promise<this>;
}

export type RootImportConfig = {
  rootPathSuffix?: string;
  rootPathPrefix?: string;
};

export type FileMappingOptions = {
  rootImport?: RootImportConfig[];
};

export type FindQuery = {
  start: string;
};

export interface Project {
  getProjectDir(): string;
  getFileMappingOptions(): FileMappingOptions;
  getDocumentsList(): Promise<DocumentRef[]>;
  findOne(fileId: FileId): Promise<{ found: DocumentRef | undefined, rest: DocumentRef[] }>;
  find(query: FindQuery): Promise<{ found: DocumentRef[], rest: DocumentRef[] }>;
  commit(): Promise<this>;
}

export type LogLevel = "verbose" | "info" | "silent";

export interface Logger {
  info(msg: string): this;
  warn(msg: string): this;
  error(msg: string | Error): this;
  verbose(msg: string, ...objects: any[]): this;
}
