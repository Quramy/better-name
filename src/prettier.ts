import {
  Options,
  resolveConfig,
  format,
} from "prettier";
import { getLogger } from "./logger";

export type PrettierOptions = {
  projectRoot: string,
  enabled?: boolean,
};

export class Prettier {
  private _enabled: boolean = true;
  private readonly _projectRoot: string;
  private _options?: Options;

  constructor({ projectRoot, enabled = true }: PrettierOptions) {
    this._enabled = !!enabled;
    this._projectRoot = projectRoot;
  }

  async readConfig() {
    if (!this._options) {
      const opt = await resolveConfig(this._projectRoot);
      if (!opt) {
        this._enabled = false;
        return null;
      }
      this._options = opt;
      return this._options;
    }
  }

  async format(code: string) {
    if (!this._enabled) return code;
    const options = await this.readConfig();
    getLogger().verbose("options", options);
    if (!options) return code;
    return await format(code, options);
  }
}
