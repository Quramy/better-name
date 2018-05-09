import { FileRef, SourceWriter, Formatter } from "../types";
import { SourceReplacement, applyReplacementToSource } from "../functions";
import { getLogger } from "../logger";

export type OriginalSourceLocation<T> = {
  isOrigin: true;
  node: T;
};

export type SourceLocation<T> = {
  isOrigin: false;
  node: SourceLocation<T> | OriginalSourceLocation<T>;
};

export interface Mutation<T> {
  location: OriginalSourceLocation<T> | SourceLocation<T>;
  replacement: T;
  replacementText: string;
}

export abstract class AstDocumentEntity<T> {

  protected _fref: FileRef;
  protected _uncommitedMutations: Mutation<T>[] = [];
  protected _formatter: Formatter;

  abstract writer: SourceWriter;
  abstract get sourceText(): string | undefined;
  abstract clear(): this;
  abstract getReplacements(): SourceReplacement[];

  constructor({ fileRef, formatter } : { fileRef: FileRef, formatter: Formatter }) {
    this._fref = fileRef;
    this._formatter = formatter;
    this._uncommitedMutations = [];
  }

  async flush(force: boolean = false) {
    const replacements = this.getReplacements();
    if (!replacements.length && !force) return this;
    if (!this.sourceText) {
      throw new Error("Cannot flush because the source or AST is not set.");
    }
    const newSrc = await this._formatter.format(applyReplacementToSource(this.sourceText, this.getReplacements()));
    await this.writer.write(this._fref, newSrc);
    getLogger().info(`write contents to "${this._fref.id}".`);
    return this.clear();
  }

  async move(newFile: FileRef) {
    if (this._fref.path === newFile.path) {
      return this;
    }
    this._fref = newFile;
    return this;
  }

  protected _updateMutations(before: T, after: T, replacementText: string, isOrigin: (node: T) => boolean) {
    if (isOrigin(before)) {
      this._uncommitedMutations.push({
        location: {
          isOrigin: true,
          node: before,
        },
        replacement: after,
        replacementText,
      });
    } else {
      const mutationToBeUpdated = this._uncommitedMutations.find(({ replacement }) => replacement === before);
      if (mutationToBeUpdated) {
        mutationToBeUpdated.location = {
          isOrigin: false,
          node: mutationToBeUpdated.location,
        };
        mutationToBeUpdated.replacement = after;
        mutationToBeUpdated.replacementText = replacementText;
      }
    }
  }
}
