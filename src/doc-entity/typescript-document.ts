import * as ts from "typescript";

import {
  DocumentEntity,
  FileRef,
  SourceReader,
  SourceWriter,
  TransformOptions,
  Formatter,
  FileMappingOptions,
} from "../types";
import { noopPrettier } from "../formatter/prettier";
import { getLogger } from "../logger";
import {
  ShouldBeReplacedResult,
  SourceReplacement,
  shouldBeReplaced,
  shouldBeReplacedWithModuleMove,
  applyReplacementToSource,
} from "../functions";

type OriginalSourceLocation<T> = {
  isOrigin: true;
  node: T;
};

type SourceLocation<T> = {
  isOrigin: false;
  node: SourceLocation<T> | OriginalSourceLocation<T>;
};

interface Mutation<T> {
  location: OriginalSourceLocation<T> | SourceLocation<T>;
  replacement: T;
  replacementText: string;
}

export class TypeScriptDocumentEntity implements DocumentEntity {
  private _fref: FileRef;
  private _dirty: boolean = true;
  private _source?: ts.SourceFile;
  private _uncommitedMutations: Mutation<ts.Node>[] = [];
  private _formatter: Formatter;

  reader!: SourceReader;
  writer!: SourceWriter;

  readonly fileMappingOptions: FileMappingOptions;

  constructor ({
    fileRef,
    fileMappingOptions = { },
    formatter,
  }: {
    fileRef: FileRef,
    fileMappingOptions?: FileMappingOptions,
    formatter?: Formatter,
  }) {
    this._fref= fileRef;
    this.fileMappingOptions = fileMappingOptions;
    this._formatter = formatter || noopPrettier;
  }

  get fileRef() {
    return this._fref;
  }

  get isDirty() {
    return this._dirty;
  }

  get sourceText() {
    if (!this._source) return;
    return this._source.text;
  }

  async parse() {
    if (!this._dirty) {
      return this;
    }
    // TODO handle syntax error if thorwn
    const sourceString = await this.reader.read(this.fileRef);
    this._source = ts.createSourceFile(this.fileRef.id, sourceString, ts.ScriptTarget.Latest, true);
    this._dirty = false;
    return this;
  }

  transformPreceding(to: string): this {
    if (!this._source) return this;
    const transformationResult = ts.transform(this._source, [this._createTransformerFactory((expression: ts.StringLiteral) => shouldBeReplaced({
      targetModuleName: expression.text,
      targetFileId: this.fileRef.id,
      toFileId: to,
    }))]);
    if (transformationResult.transformed && transformationResult.transformed.length > 0) {
      this._source = transformationResult.transformed[0];
    }
    return this;
  }

  transformFollowing(opt: TransformOptions): this {
    if (!this._source) return this;
    const { from, to } = opt;
    const transformationResult = ts.transform(this._source, [this._createTransformerFactory((expression: ts.StringLiteral) => shouldBeReplacedWithModuleMove({
      targetFileId: this.fileRef.id,
      targetModuleName: expression.text,
      movingFileId: from,
      toFileId: to,
      extensions: [".ts", ".tsx", ".d.ts"], // TODO --allowjs
      // opt: this.fileMappingOptions, // TODO using tsconfig paths mapping
    }))]);
    if (transformationResult.transformed && transformationResult.transformed.length > 0) {
      this._source = transformationResult.transformed[0];
    }
    return this;
  }

  getReplacements(): SourceReplacement[] {
    return this._uncommitedMutations.map(({ location, replacementText }) => {
      for (; !location.isOrigin; location = location.node) { }
      const start = ts.isStringLiteral(location.node) ? location.node.getStart() + 1 : location.node.getStart();
      const end = ts.isStringLiteral(location.node) ? location.node.getEnd() - 1 : location.node.getEnd();
      return { start, end, replacementText } as SourceReplacement;
    });
  }

  clear() {
    this._source = undefined;
    this._dirty = true;
    this._uncommitedMutations = [];
    return this;
  }

  async flush(force: boolean = false) {
    const replacements = this.getReplacements();
    if (!replacements.length && !force) return this;
    if (!this.sourceText) {
      throw new Error("Cannot flush because the source or AST is not set.");
    }
    const newSrc = await this._formatter.format(applyReplacementToSource(this.sourceText, this.getReplacements()));
    await this.writer.write(this.fileRef, newSrc);
    getLogger().info(`write contents to "${this.fileRef.id}".`);
    return this.clear();
  }

  async move(newFile: FileRef) {
    if (this._fref.path === newFile.path) {
      return this;
    }
    this._fref = newFile;
    return this;
  }

  private _updateMurations(before: ts.Node, after: ts.Node, replacementText: string) {
    if (before.parent) {
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

  private _createTransformerFactory(matcher: (sourceNode: ts.StringLiteral) => ShouldBeReplacedResult): ts.TransformerFactory<ts.SourceFile> {
    return (ctx: ts.TransformationContext) => {
      const visitNode = (node: ts.Node): ts.Node => {
        if (ts.isImportDeclaration(node)) {
          const expression = node.moduleSpecifier;
          if (ts.isStringLiteral(expression)) {
            const matchReulst = matcher(expression);
            if (matchReulst.hit) {
              const newNode = ts.createLiteral(matchReulst.newModuleId);
              this._updateMurations(expression, newNode, matchReulst.newModuleId);
              getLogger().info(`${this.fileRef.id}: replacement "${expression.text}" to "${matchReulst.newModuleId}"`);
              return ts.updateImportDeclaration(node, node.decorators, node.modifiers, node.importClause, newNode);
            }
          }
        } else if(ts.isExportDeclaration(node) && node.moduleSpecifier) {
          const expression = node.moduleSpecifier;
          if (ts.isStringLiteral(expression)) {
            const matchReulst = matcher(expression);
            if (matchReulst.hit) {
              const newNode = ts.createLiteral(matchReulst.newModuleId);
              this._updateMurations(expression, newNode, matchReulst.newModuleId);
              getLogger().info(`${this.fileRef.id}: replacement "${expression.text}" to "${matchReulst.newModuleId}"`);
              return ts.updateExportDeclaration(node, node.decorators, node.modifiers, node.exportClause, newNode);
            }
          }
        }
        return ts.visitEachChild(node, visitNode, ctx);
      };

      return (source: ts.SourceFile) => ts.updateSourceFileNode(source, ts.visitNodes(source.statements, visitNode));
    };
  }
}
