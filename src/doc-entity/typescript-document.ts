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
import { noopPrettier } from "../prettier";
import { getLogger } from "../logger";
import { ShouldBeReplacedResult, shouldBeReplaced, shouldBeReplacedWithModuleMove } from "../functions";

function createSourceReplaceTransformerFactory(matcher: (sourceNode: ts.StringLiteral) => ShouldBeReplacedResult, cb: () => any = () => 0): ts.TransformerFactory<ts.SourceFile> {
  return (ctx: ts.TransformationContext) => {
    function visitNode(node: ts.Node): ts.Node {
      if (ts.isImportDeclaration(node)) {
        const expression = node.moduleSpecifier;
        if (ts.isStringLiteral(expression)) {
          const matchReulst = matcher(expression);
          if (matchReulst.hit) {
            cb();
            return ts.updateImportDeclaration(node, node.decorators, node.modifiers, node.importClause, ts.createLiteral(matchReulst.newModuleId));
          }
        }
      } else if(ts.isExportDeclaration(node) && node.moduleSpecifier) {
        const expression = node.moduleSpecifier;
        if (ts.isStringLiteral(expression)) {
          const matchReulst = matcher(expression);
          if (matchReulst.hit) {
            cb();
            return ts.updateExportDeclaration(node, node.decorators, node.modifiers, node.exportClause, ts.createLiteral(matchReulst.newModuleId));
          }
        }
      }
      return ts.visitEachChild(node, visitNode, ctx);
    }

    return (source: ts.SourceFile) => ts.updateSourceFileNode(source, ts.visitNodes(source.statements, visitNode));
  };
}

export class TypeScriptDocumentEntity implements DocumentEntity {
  private _fref: FileRef;

  private _touched: boolean = false;
  private _dirty: boolean = true;
  private _rawSource?: string;
  private _source?: ts.SourceFile;
  private _printer?: ts.Printer;
  private _formatter: Formatter;

  reader!: SourceReader;
  writer!: SourceWriter;

  readonly fileMappingOptions: FileMappingOptions;

  constructor ({
    projectRoot = "",
    fileRef,
    fileMappingOptions = { },
    formatter,
  }: {
    projectRoot?: string,
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
    const transformationResult = ts.transform(this._source, [createSourceReplaceTransformerFactory((expression: ts.StringLiteral) => shouldBeReplaced({
      targetModuleName: expression.text,
      targetFileId: this.fileRef.id,
      toFileId: to,
    }), () => this._touched = true)]);
    if (transformationResult.transformed && transformationResult.transformed.length > 0) {
      this._source = transformationResult.transformed[0];
    }
    return this;
  }

  transformFollowing(opt: TransformOptions): this {
    if (!this._source) return this;
    const { from, to } = opt;
    const transformationResult = ts.transform(this._source, [createSourceReplaceTransformerFactory((expression: ts.StringLiteral) => shouldBeReplacedWithModuleMove({
      targetFileId: this.fileRef.id,
      targetModuleName: expression.text,
      movingFileId: from,
      toFileId: to,
      extensions: [".ts", ".tsx", ".d.ts"], // TODO --allowjs
      // opt: this.fileMappingOptions, // TODO using tsconfig paths mapping
    }), () => this._touched = true)]);
    if (transformationResult.transformed && transformationResult.transformed.length > 0) {
      this._source = transformationResult.transformed[0];
    }
    return this;
  }

  async flush(force: boolean = false) {
    if (!this._touched && !force) return this;
    if (!this._source) {
      throw new Error("Cannot flush because the source or AST is not set.");
    }
    if (!this._printer) {
      this._printer = ts.createPrinter();
    }
    const newSrc = await this._formatter.format(this._printer.printFile(this._source));
    await this.writer.write(this.fileRef, newSrc);
    getLogger().info(`write contents to "${this.fileRef.id}".`);
    this._touched = false;
    return this;
  }

  async move(newFile: FileRef) {
    if (this._fref.path === newFile.path) {
      return this;
    }
    this._fref = newFile;
    return this;
  }
}
