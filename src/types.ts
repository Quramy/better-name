export type $DiffKey<T, U> = T extends U ? never : T;
export type $Diff<T, U> = Pick<T, $DiffKey<keyof T, keyof U>>;
export type $Optional<T> = { [P in keyof T]?: T[P] };
export type $PartialOptional<T, U> = $Diff<T, U> & $Optional<U>

export type FileId = string;

export interface FileRef {
  readonly id: FileId;
  readonly path: string;
}

export interface Project {
  getProjectDir(): string;
  getFileMappingOptions(): FileMappingOptions;
  getDocumentsList(): Promise<DocumentRef[]>;
  findOne(fileId: FileId): Promise<{ found: DocumentRef | undefined, rest: DocumentRef[] }>;
}

export interface DocumentRef {
  getFile(): FileRef;
  getDoc(): DocumentEntity;
  detach(): void;
  move(newFile: FileRef): Promise<this>;
}

export interface TransformOptions {
  from: string;
  to: string;
}

export interface DocumentEntity {
  readonly fileRef: FileRef;
  readonly isDirty: boolean;
  parse(): Promise<this>;
  transformPreceding(to: string): this;
  transformFollowing(opt: TransformOptions): this;
  flush(): Promise<this>;
  move(newFile: FileRef): Promise<this>;
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

export type RootImportConfig = {
  rootPathSuffix?: string;
  rootPathPrefix?: string;
};

export type FileMappingOptions = {
  rootImport?: RootImportConfig[];
}
