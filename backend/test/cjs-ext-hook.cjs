/**
 * Node.js CJS require hook: rewrite `.js` → `.ts` for relative imports.
 *
 * WHY: Production source files use `.js` extensions in import paths per the
 * Node.js ESM convention (TypeScript's `moduleResolution: NodeNext` or
 * `bundler` recommendation). When running under ts-node in CJS mode,
 * Node's CJS loader cannot find `foo.js` when only `foo.ts` exists.
 *
 * This hook intercepts `Module._resolveFilename` before tsconfig-paths and
 * rewrites `./foo.js` → `./foo` so ts-node's CJS extension handler resolves
 * the .ts source file correctly.
 *
 * This hook is loaded during `start:dev` and `test:integration`.
 * It has no effect on compiled production builds (`node dist/main.js`).
 */
'use strict';

const Module = require('module');
const path = require('path');
const fs = require('fs');

if (Module._cjsExtHookInstalled) {
  return;
}
Module._cjsExtHookInstalled = true;

const original = Module._resolveFilename.bind(Module);

Module._resolveFilename = function (request, parent, isMain, options) {
  // Only rewrite relative imports with a .js extension.
  if (request.startsWith('.') && request.endsWith('.js')) {
    const withoutExt = request.slice(0, -3); // strip '.js'
    // If the .ts version exists relative to the parent, rewrite.
    if (parent && parent.filename) {
      const dir = path.dirname(parent.filename);
      const tsCandidate = path.resolve(dir, withoutExt + '.ts');
      if (fs.existsSync(tsCandidate)) {
        return original(withoutExt, parent, isMain, options);
      }
      const tsIndexCandidate = path.resolve(dir, withoutExt, 'index.ts');
      if (fs.existsSync(tsIndexCandidate)) {
        return original(withoutExt, parent, isMain, options);
      }
    }
  }
  return original(request, parent, isMain, options);
};
