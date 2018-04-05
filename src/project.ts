import { parse } from "babylon";
import * as glob from "glob";

export type $DiffKey<T, U> = T extends U ? never : T;
export type $Diff<T, U> = Pick<T, $DiffKey<keyof T, keyof U>>;
export type $Optional<T> = { [P in keyof T]?: T[P] };
export type $PartialOptional<T, U> = $Diff<T, U> & $Optional<U>

export interface Project {
  getProjectDir(): string;
  getDocumentsList(): Promise<DocumentRef[]>;
}

export interface DocumentRef {
  readonly ref?: DocumentEntity;
  detach(): void;
}

export interface DocumentEntity {
  readonly isDirty: boolean;
  parse(): this;
  replacePath(): this;
  flush(): Promise<void>;
}

export class DefaultProject implements Project {
  private _docRefList?: DocumentRef[];

  constructor(
    private _config: AllProjectOptions,
  ) {
  }

  getProjectDir() {
    return this._config.rootDir;
  }

  async getDocumentsList() {
    if (this._docRefList) {
      return Promise.resolve(this._docRefList);
    }
    return new Promise<DocumentRef[]>((resolve, reject) => {
      glob(this._config.pattern, (err, files) => {
        if (err) return reject(err);
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

export class EstreeDocumentEntity implements DocumentEntity {
  get isDirty() {
    // TODO
    return false;
  }
  parse(): this {
    throw new Error("Method not implemented.");
  }
  replacePath(): this {
    throw new Error("Method not implemented.");
  }
  flush(): Promise<void> {
    throw new Error("Method not implemented.");
  }
}
