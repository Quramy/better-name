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

import { AstDocumentEntity } from "./ast-document";

import { noopPrettier } from "../formatter/prettier";

import {
  ShouldBeReplacedResult,
  SourceReplacement,
  shouldBeReplaced,
  shouldBeReplacedWithModuleMove,
} from "../functions";
import { getLogger } from "../logger";

export class TypeScriptDocumentEntity extends AstDocumentEntity<ts.Node> implements DocumentEntity {
  private _dirty: boolean = true;
  private _source?: ts.SourceFile;

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
    super({ fileRef, formatter: formatter || noopPrettier });
    this.fileMappingOptions = fileMappingOptions;
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

  private _createTransformerFactory(matcher: (sourceNode: ts.StringLiteral) => ShouldBeReplacedResult): ts.TransformerFactory<ts.SourceFile> {
    return (ctx: ts.TransformationContext) => {
      const visitNode = (node: ts.Node): ts.Node => {
        if (ts.isImportDeclaration(node)) {
          const expression = node.moduleSpecifier;
          if (ts.isStringLiteral(expression)) {
            const matchReulst = matcher(expression);
            if (matchReulst.hit) {
              const newNode = ts.createLiteral(matchReulst.newModuleId);
              this._updateMutations(expression, newNode, matchReulst.newModuleId, node => !!node.parent);
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
              this._updateMutations(expression, newNode, matchReulst.newModuleId, node => !!node.parent);
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
