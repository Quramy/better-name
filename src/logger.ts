import { Logger, LogLevel } from "./types";

export class ConsoleLogger implements Logger{

  _level: LogLevel;

  constructor(lv?: LogLevel) {
    this._level = lv || "info";
  }

  warn(msg: string) {
    return this.info(msg);
  }

  info(msg: string) {
    if (this._level !== "silent") {
      // tslint:disable-next-line no-console
      console.log(msg);
    }
    return this;
  }

  error(obj: string | Error) {
    if (this._level !== "silent") {
      // tslint:disable-next-line no-console
      console.error(obj);
    }
    return this;
  }

  verbose(msg: string, ...objects: any[]) {
    if (this._level === "verbose") {
      // tslint:disable-next-line no-console
      console.log(msg);
      if (objects && objects.length) {
        objects.forEach(obj => {
          // tslint:disable-next-line no-console
          console.log(JSON.stringify(obj, null, 2));
        });
      }
    }
    return this;
  }
}

let _logger = new ConsoleLogger("silent");

export function offLogger() {
  _logger._level = "silent";
}

export function setupLogger() {
  _logger = new ConsoleLogger;
}

export function getLogger() {
  return _logger;
}
