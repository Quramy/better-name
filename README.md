# better-name [![CircleCI](https://circleci.com/gh/Quramy/better-name.svg?style=svg)](https://circleci.com/gh/Quramy/better-name)

CLI tool to rename JavaScript(ES2015) module files.

If you have the following JavaScript files coupled with import/export dependencies and you want to refactor via moving the `target.js` to another directory.

```js
// src/core/index.js

import { someFn } from './target';

export default function main() {
  someFn();
}
```

```js
// src/core/target.js

export function someFn() {
  return 'test';
}
```

This CLI moves this keeping their dependencies. In other words, after `better-name src/core/target.js src/feat/dest.js`, the import declaration in the `core/index.js` file gets updated with the new dependencies:

```js
// src/core/index.js

import { someFn } from '../feat/dest';

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
better-name <fromFile> <toFile>
```

## License
MIT. See LICENSE file under the this repository.
