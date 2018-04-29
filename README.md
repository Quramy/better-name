# better-name
[![CircleCI](https://circleci.com/gh/Quramy/better-name.svg?style=svg)](https://circleci.com/gh/Quramy/better-name)
[![Coverage Status](https://coveralls.io/repos/github/Quramy/better-name/badge.svg?branch=master)](https://coveralls.io/github/Quramy/better-name?branch=master)
[![npm version](https://badge.fury.io/js/better-name.svg)](https://badge.fury.io/js/better-name)

A CLI to rename JavaScript(ES2015) module files.

If you have the following JavaScript files coupled with import/export dependencies and you want to refactor via moving the `target.js` to another directory.

```js
// src/index.js

import { someFn } from './oldFile';

export default function main() {
  someFn();
}
```

```js
// src/oldFile.js

export function someFn() {
  return 'test';
}
```

This CLI moves this keeping their dependencies. In other words, after `better-name src/oldFile.js src/feat/newFile.js`, the import declaration in the `index.js` file gets updated with the new dependencies:

```js
// src/index.js

import { someFn } from './feat/newFile';

export default function main() {
  someFn();
}
```

## Install

```sh
npm -g install better-name
```

## Usage

```sh
better-name [options] <fromFile> <toFile>
```

Exec `better-name --help` if you want more details :smile:

### Configure

#### Project file patterns

By default, this CLI searches files to be replaced via `src/**/*.{js,jsx,mjs}` glob pattern.
You can customize the glob pattern with --patterns` option or configuring in package.json:

```js
  /* package.json */
  "betterName": {
    "patterns": [
      "src/javascript/**/*.{js,jsx}",
      "src/styles/**/*.css"
    ]
  },
```

#### Format with Prettier
This CLI format your code after replace import declarations if your project has Prettier config file(.prettierrc, .prettierrc.js,,,).
You can turn off this behavior passing `--no-prettier` options to CLI.

I strongly recommend to enable Prettier format because this CLI uses babylon for parsing and replacing import declarations and sometimes the replacing procedure breaks your sorucecode's indenting or quatations.

#### Root import
Root path mapping using [babel-plugin-root-import](https://github.com/entwicklerstube/babel-plugin-root-import) is supported.
Path mapping configuration is loaded automaticcaly if your .babelrc has `babel-plugin-root-import` section.

You also can configure path mapping via package.json such as:

```js
  /* package.json */
  "betterName": {
    "rootImport": [{
      "rootPathPrefix": "~",
      "rootPathSuffix": "src/js"
    }, {
      "rootPathPrefix": "@",
      "rootPathSuffix": "other-src/js"
    }, {
      "rootPathPrefix": "#",
      "rootPathSuffix": "../../src/in/parent"
    }]
  }
```

## Remarks
### Available file types
This CLI can replace import declarations in .js, .jsx, or .mjs.

And this CLI allows non-JavaScript import such as:


```js
/* some.component.jsx */

import styles from './some.component.css';

// ...
```

However, non-JavaScript import(i.e. `@import` in CSS) could not be replaced.

## License
MIT. See LICENSE file under the this repository.
