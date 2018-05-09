import {
  Node,
  File as FileAst,
  ImportDeclaration,
  ExportAllDeclaration,
  ExportNamedDeclaration,
  stringLiteral,
  StringLiteral,
} from "@babel/types";
import { parse } from "babylon";
import traverse, { NodePath } from "@babel/traverse";

import {
  FileRef,
  SourceReader,
  SourceWriter,
  SourceRemover,
  DocumentEntity,
  TransformOptions,
  FileMappingOptions,
  Formatter,
} from "../types";

import { AstDocumentEntity } from "./ast-document";

import {
  ShouldBeReplacedResult,
  SourceReplacement,
  shouldBeReplaced,
  shouldBeReplacedWithModuleMove,
  range,
} from "../functions";
import { getLogger } from "../logger";

import { Prettier, noopPrettier } from "../formatter/prettier";

export class BabylonDocumentEntity extends AstDocumentEntity<Node> implements DocumentEntity {

  private _dirty: boolean = true;
  private _rawSource?: string;
  private _file?: FileAst;

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
    if (!this._rawSource) return;
    return this._rawSource;
  }

  async parse() {
    if (!this._dirty && this._rawSource) {
      return this;
    } else {
      this._rawSource = await this.reader.read(this.fileRef);
      try {
        this._file = parse(this._rawSource, {
          sourceType: "module",
          // TODO
          // arguments type mismatch
          plugins: [
            "jsx",
            "flow",
            "classConstructorCall",
            "classProperties",
            "asyncGenerators",
            "decorators",
            "doExpressions",
            "dynamicImport",
            "exportExtensions",
            "functionBind",
            "functionSent",
            "objectRestSpread",
            "exportDefaultFrom" as any,
          ],
        });
      } catch (e) {
        if (e.name === "SyntaxError") {
          getLogger().warn(this.fileRef.id + ": " + e.message);
          const hit = (e.message as string).match(/\((\d+):(\d+)\)\s*$/);
          if (hit && this._rawSource) {
            const l = Math.max(+hit[1] - 1, 1);
            const c = +hit[2] - 1;
            getLogger().warn(this._rawSource.split("\n").slice(l - 1, l).join("\n"));
            getLogger().warn(range(c).map(x => " ").join("") + "^");
          }
        } else {
          throw e;
        }
      }
      this._dirty = false;
      return this;
    }
  }

  transformPreceding(to: string) {
    return this._transformImports(s => shouldBeReplaced({
      targetModuleName: s.value,
      targetFileId: this.fileRef.id,
      toFileId: to,
    }));
  }

  transformFollowing({ from, to } : TransformOptions): this {
    return this._transformImports(s => shouldBeReplacedWithModuleMove({
      targetFileId: this.fileRef.id,
      targetModuleName: s.value,
      movingFileId: from,
      toFileId: to,
      opt: this.fileMappingOptions,
    }));
  }

  getReplacements(): SourceReplacement[] {
    return this._uncommitedMutations.map(({ location, replacementText }) => {
      for (; !location.isOrigin; location = location.node) { }
      const start = location.node.type === "StringLiteral" ? location.node.start + 1 : location.node.start;
      const end = location.node.type === "StringLiteral" ? location.node.end - 1 : location.node.end;
      return { start, end, replacementText } as SourceReplacement;
    });
  }

  clear() {
    this._rawSource = undefined;
    this._file = undefined;
    this._dirty = true;
    this._uncommitedMutations = [];
    return this;
  }

  private _transformImports(matcher: (sourceNode: StringLiteral) => ShouldBeReplacedResult) {
    if (!this._file) {
      return this;
    }
    let flag = false;
    let newModuleName: string;
    const pathHandler = (path: NodePath<ImportDeclaration | ExportAllDeclaration | ExportNamedDeclaration>) => {
      const { source } = path.node;
      if (!source) return;
      const result = matcher(source);
      if (result.hit) {
        flag = true;
        newModuleName = result.newModuleId;
        getLogger().info(`${this.fileRef.id}: replacement "${source.value}" to "${newModuleName}"`);
      }
    };
    traverse(this._file, {
      ImportDeclaration: pathHandler,
      ExportAllDeclaration: pathHandler,
      ExportNamedDeclaration: pathHandler,
      exit(path) {
        if (flag && path.isImportDeclaration()) flag = false;
      },
      StringLiteral: (path) => {
        if (flag && newModuleName) {
          const newNode = stringLiteral(newModuleName);
          this._updateMutations(path.node, newNode, newModuleName, node => !!node.loc);
          path.replaceWith(newNode);
          flag = false;
        }
      },
    });
    return this;
  }
}
