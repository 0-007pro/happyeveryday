/**
 * 插件预加载入口（CJS 格式）。
 * openclaw 框架通过 require() 加载插件，因此需要 .cjs 后缀。
 */
"use strict";

const _pluginModule = require("./dist/index.js");
const _default = _pluginModule.default;
const merged = Object.assign({}, _pluginModule);
if (_default && typeof _default === "object") {
  for (const key of Object.keys(_default)) {
    if (!(key in merged)) {
      merged[key] = _default[key];
    }
  }
}

module.exports = merged;
