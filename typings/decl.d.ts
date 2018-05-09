declare module "@babel/traverse" {
  import * as t from "babel-types";
  import { NodePath, TraverseOptions, Scope } from "babel-traverse";
  export * from "babel-traverse";
  export default function traverse(parent: t.Node | t.Node[], opts?: TraverseOptions, scope?: Scope, state?: any, parentPath?: NodePath): void;
}

declare module "@babel/types" {
  export * from "babel-types";
}
