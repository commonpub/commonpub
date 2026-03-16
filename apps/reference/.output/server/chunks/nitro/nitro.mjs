import process from 'node:process';globalThis._importMeta_=globalThis._importMeta_||{url:"file:///_entry.js",env:process.env};import { relations, eq, and, sql, desc, inArray, ilike, asc } from 'drizzle-orm';
import { pgEnum, pgTable, timestamp, varchar, jsonb, text, boolean, uuid, integer, unique, primaryKey, numeric, alias } from 'drizzle-orm/pg-core';
import { generateKeyPair, exportSPKI, exportPKCS8 } from 'jose';
import http, { Server as Server$1 } from 'node:http';
import https, { Server } from 'node:https';
import { EventEmitter } from 'node:events';
import { Buffer as Buffer$1 } from 'node:buffer';
import { promises, existsSync } from 'node:fs';
import { resolve as resolve$1, dirname as dirname$1, join } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { username } from 'better-auth/plugins';

const suspectProtoRx = /"(?:_|\\u0{2}5[Ff]){2}(?:p|\\u0{2}70)(?:r|\\u0{2}72)(?:o|\\u0{2}6[Ff])(?:t|\\u0{2}74)(?:o|\\u0{2}6[Ff])(?:_|\\u0{2}5[Ff]){2}"\s*:/;
const suspectConstructorRx = /"(?:c|\\u0063)(?:o|\\u006[Ff])(?:n|\\u006[Ee])(?:s|\\u0073)(?:t|\\u0074)(?:r|\\u0072)(?:u|\\u0075)(?:c|\\u0063)(?:t|\\u0074)(?:o|\\u006[Ff])(?:r|\\u0072)"\s*:/;
const JsonSigRx = /^\s*["[{]|^\s*-?\d{1,16}(\.\d{1,17})?([Ee][+-]?\d+)?\s*$/;
function jsonParseTransform(key, value) {
  if (key === "__proto__" || key === "constructor" && value && typeof value === "object" && "prototype" in value) {
    warnKeyDropped(key);
    return;
  }
  return value;
}
function warnKeyDropped(key) {
  console.warn(`[destr] Dropping "${key}" key to prevent prototype pollution.`);
}
function destr(value, options = {}) {
  if (typeof value !== "string") {
    return value;
  }
  if (value[0] === '"' && value[value.length - 1] === '"' && value.indexOf("\\") === -1) {
    return value.slice(1, -1);
  }
  const _value = value.trim();
  if (_value.length <= 9) {
    switch (_value.toLowerCase()) {
      case "true": {
        return true;
      }
      case "false": {
        return false;
      }
      case "undefined": {
        return void 0;
      }
      case "null": {
        return null;
      }
      case "nan": {
        return Number.NaN;
      }
      case "infinity": {
        return Number.POSITIVE_INFINITY;
      }
      case "-infinity": {
        return Number.NEGATIVE_INFINITY;
      }
    }
  }
  if (!JsonSigRx.test(value)) {
    if (options.strict) {
      throw new SyntaxError("[destr] Invalid JSON");
    }
    return value;
  }
  try {
    if (suspectProtoRx.test(value) || suspectConstructorRx.test(value)) {
      if (options.strict) {
        throw new Error("[destr] Possible prototype pollution");
      }
      return JSON.parse(value, jsonParseTransform);
    }
    return JSON.parse(value);
  } catch (error) {
    if (options.strict) {
      throw error;
    }
    return value;
  }
}

const HASH_RE = /#/g;
const AMPERSAND_RE = /&/g;
const SLASH_RE = /\//g;
const EQUAL_RE = /=/g;
const IM_RE = /\?/g;
const PLUS_RE = /\+/g;
const ENC_CARET_RE = /%5e/gi;
const ENC_BACKTICK_RE = /%60/gi;
const ENC_PIPE_RE = /%7c/gi;
const ENC_SPACE_RE = /%20/gi;
const ENC_SLASH_RE = /%2f/gi;
const ENC_ENC_SLASH_RE = /%252f/gi;
function encode(text) {
  return encodeURI("" + text).replace(ENC_PIPE_RE, "|");
}
function encodeQueryValue(input) {
  return encode(typeof input === "string" ? input : JSON.stringify(input)).replace(PLUS_RE, "%2B").replace(ENC_SPACE_RE, "+").replace(HASH_RE, "%23").replace(AMPERSAND_RE, "%26").replace(ENC_BACKTICK_RE, "`").replace(ENC_CARET_RE, "^").replace(SLASH_RE, "%2F");
}
function encodeQueryKey(text) {
  return encodeQueryValue(text).replace(EQUAL_RE, "%3D");
}
function encodePath(text) {
  return encode(text).replace(HASH_RE, "%23").replace(IM_RE, "%3F").replace(ENC_ENC_SLASH_RE, "%2F").replace(AMPERSAND_RE, "%26").replace(PLUS_RE, "%2B");
}
function decode(text = "") {
  try {
    return decodeURIComponent("" + text);
  } catch {
    return "" + text;
  }
}
function decodePath(text) {
  return decode(text.replace(ENC_SLASH_RE, "%252F"));
}
function decodeQueryKey(text) {
  return decode(text.replace(PLUS_RE, " "));
}
function decodeQueryValue(text) {
  return decode(text.replace(PLUS_RE, " "));
}

function parseQuery(parametersString = "") {
  const object = /* @__PURE__ */ Object.create(null);
  if (parametersString[0] === "?") {
    parametersString = parametersString.slice(1);
  }
  for (const parameter of parametersString.split("&")) {
    const s = parameter.match(/([^=]+)=?(.*)/) || [];
    if (s.length < 2) {
      continue;
    }
    const key = decodeQueryKey(s[1]);
    if (key === "__proto__" || key === "constructor") {
      continue;
    }
    const value = decodeQueryValue(s[2] || "");
    if (object[key] === void 0) {
      object[key] = value;
    } else if (Array.isArray(object[key])) {
      object[key].push(value);
    } else {
      object[key] = [object[key], value];
    }
  }
  return object;
}
function encodeQueryItem(key, value) {
  if (typeof value === "number" || typeof value === "boolean") {
    value = String(value);
  }
  if (!value) {
    return encodeQueryKey(key);
  }
  if (Array.isArray(value)) {
    return value.map(
      (_value) => `${encodeQueryKey(key)}=${encodeQueryValue(_value)}`
    ).join("&");
  }
  return `${encodeQueryKey(key)}=${encodeQueryValue(value)}`;
}
function stringifyQuery(query) {
  return Object.keys(query).filter((k) => query[k] !== void 0).map((k) => encodeQueryItem(k, query[k])).filter(Boolean).join("&");
}

const PROTOCOL_STRICT_REGEX = /^[\s\w\0+.-]{2,}:([/\\]{1,2})/;
const PROTOCOL_REGEX = /^[\s\w\0+.-]{2,}:([/\\]{2})?/;
const PROTOCOL_RELATIVE_REGEX = /^([/\\]\s*){2,}[^/\\]/;
const PROTOCOL_SCRIPT_RE = /^[\s\0]*(blob|data|javascript|vbscript):$/i;
const TRAILING_SLASH_RE = /\/$|\/\?|\/#/;
const JOIN_LEADING_SLASH_RE = /^\.?\//;
function hasProtocol(inputString, opts = {}) {
  if (typeof opts === "boolean") {
    opts = { acceptRelative: opts };
  }
  if (opts.strict) {
    return PROTOCOL_STRICT_REGEX.test(inputString);
  }
  return PROTOCOL_REGEX.test(inputString) || (opts.acceptRelative ? PROTOCOL_RELATIVE_REGEX.test(inputString) : false);
}
function isScriptProtocol(protocol) {
  return !!protocol && PROTOCOL_SCRIPT_RE.test(protocol);
}
function hasTrailingSlash(input = "", respectQueryAndFragment) {
  if (!respectQueryAndFragment) {
    return input.endsWith("/");
  }
  return TRAILING_SLASH_RE.test(input);
}
function withoutTrailingSlash(input = "", respectQueryAndFragment) {
  if (!respectQueryAndFragment) {
    return (hasTrailingSlash(input) ? input.slice(0, -1) : input) || "/";
  }
  if (!hasTrailingSlash(input, true)) {
    return input || "/";
  }
  let path = input;
  let fragment = "";
  const fragmentIndex = input.indexOf("#");
  if (fragmentIndex !== -1) {
    path = input.slice(0, fragmentIndex);
    fragment = input.slice(fragmentIndex);
  }
  const [s0, ...s] = path.split("?");
  const cleanPath = s0.endsWith("/") ? s0.slice(0, -1) : s0;
  return (cleanPath || "/") + (s.length > 0 ? `?${s.join("?")}` : "") + fragment;
}
function withTrailingSlash(input = "", respectQueryAndFragment) {
  if (!respectQueryAndFragment) {
    return input.endsWith("/") ? input : input + "/";
  }
  if (hasTrailingSlash(input, true)) {
    return input || "/";
  }
  let path = input;
  let fragment = "";
  const fragmentIndex = input.indexOf("#");
  if (fragmentIndex !== -1) {
    path = input.slice(0, fragmentIndex);
    fragment = input.slice(fragmentIndex);
    if (!path) {
      return fragment;
    }
  }
  const [s0, ...s] = path.split("?");
  return s0 + "/" + (s.length > 0 ? `?${s.join("?")}` : "") + fragment;
}
function hasLeadingSlash(input = "") {
  return input.startsWith("/");
}
function withLeadingSlash(input = "") {
  return hasLeadingSlash(input) ? input : "/" + input;
}
function withBase(input, base) {
  if (isEmptyURL(base) || hasProtocol(input)) {
    return input;
  }
  const _base = withoutTrailingSlash(base);
  if (input.startsWith(_base)) {
    const nextChar = input[_base.length];
    if (!nextChar || nextChar === "/" || nextChar === "?") {
      return input;
    }
  }
  return joinURL(_base, input);
}
function withoutBase(input, base) {
  if (isEmptyURL(base)) {
    return input;
  }
  const _base = withoutTrailingSlash(base);
  if (!input.startsWith(_base)) {
    return input;
  }
  const nextChar = input[_base.length];
  if (nextChar && nextChar !== "/" && nextChar !== "?") {
    return input;
  }
  const trimmed = input.slice(_base.length);
  return trimmed[0] === "/" ? trimmed : "/" + trimmed;
}
function withQuery(input, query) {
  const parsed = parseURL(input);
  const mergedQuery = { ...parseQuery(parsed.search), ...query };
  parsed.search = stringifyQuery(mergedQuery);
  return stringifyParsedURL(parsed);
}
function getQuery$1(input) {
  return parseQuery(parseURL(input).search);
}
function isEmptyURL(url) {
  return !url || url === "/";
}
function isNonEmptyURL(url) {
  return url && url !== "/";
}
function joinURL(base, ...input) {
  let url = base || "";
  for (const segment of input.filter((url2) => isNonEmptyURL(url2))) {
    if (url) {
      const _segment = segment.replace(JOIN_LEADING_SLASH_RE, "");
      url = withTrailingSlash(url) + _segment;
    } else {
      url = segment;
    }
  }
  return url;
}
function joinRelativeURL(..._input) {
  const JOIN_SEGMENT_SPLIT_RE = /\/(?!\/)/;
  const input = _input.filter(Boolean);
  const segments = [];
  let segmentsDepth = 0;
  for (const i of input) {
    if (!i || i === "/") {
      continue;
    }
    for (const [sindex, s] of i.split(JOIN_SEGMENT_SPLIT_RE).entries()) {
      if (!s || s === ".") {
        continue;
      }
      if (s === "..") {
        if (segments.length === 1 && hasProtocol(segments[0])) {
          continue;
        }
        segments.pop();
        segmentsDepth--;
        continue;
      }
      if (sindex === 1 && segments[segments.length - 1]?.endsWith(":/")) {
        segments[segments.length - 1] += "/" + s;
        continue;
      }
      segments.push(s);
      segmentsDepth++;
    }
  }
  let url = segments.join("/");
  if (segmentsDepth >= 0) {
    if (input[0]?.startsWith("/") && !url.startsWith("/")) {
      url = "/" + url;
    } else if (input[0]?.startsWith("./") && !url.startsWith("./")) {
      url = "./" + url;
    }
  } else {
    url = "../".repeat(-1 * segmentsDepth) + url;
  }
  if (input[input.length - 1]?.endsWith("/") && !url.endsWith("/")) {
    url += "/";
  }
  return url;
}

const protocolRelative = Symbol.for("ufo:protocolRelative");
function parseURL(input = "", defaultProto) {
  const _specialProtoMatch = input.match(
    /^[\s\0]*(blob:|data:|javascript:|vbscript:)(.*)/i
  );
  if (_specialProtoMatch) {
    const [, _proto, _pathname = ""] = _specialProtoMatch;
    return {
      protocol: _proto.toLowerCase(),
      pathname: _pathname,
      href: _proto + _pathname,
      auth: "",
      host: "",
      search: "",
      hash: ""
    };
  }
  if (!hasProtocol(input, { acceptRelative: true })) {
    return parsePath(input);
  }
  const [, protocol = "", auth, hostAndPath = ""] = input.replace(/\\/g, "/").match(/^[\s\0]*([\w+.-]{2,}:)?\/\/([^/@]+@)?(.*)/) || [];
  let [, host = "", path = ""] = hostAndPath.match(/([^#/?]*)(.*)?/) || [];
  if (protocol === "file:") {
    path = path.replace(/\/(?=[A-Za-z]:)/, "");
  }
  const { pathname, search, hash } = parsePath(path);
  return {
    protocol: protocol.toLowerCase(),
    auth: auth ? auth.slice(0, Math.max(0, auth.length - 1)) : "",
    host,
    pathname,
    search,
    hash,
    [protocolRelative]: !protocol
  };
}
function parsePath(input = "") {
  const [pathname = "", search = "", hash = ""] = (input.match(/([^#?]*)(\?[^#]*)?(#.*)?/) || []).splice(1);
  return {
    pathname,
    search,
    hash
  };
}
function stringifyParsedURL(parsed) {
  const pathname = parsed.pathname || "";
  const search = parsed.search ? (parsed.search.startsWith("?") ? "" : "?") + parsed.search : "";
  const hash = parsed.hash || "";
  const auth = parsed.auth ? parsed.auth + "@" : "";
  const host = parsed.host || "";
  const proto = parsed.protocol || parsed[protocolRelative] ? (parsed.protocol || "") + "//" : "";
  return proto + auth + host + pathname + search + hash;
}

const NODE_TYPES = {
  NORMAL: 0,
  WILDCARD: 1,
  PLACEHOLDER: 2
};

function createRouter$1(options = {}) {
  const ctx = {
    options,
    rootNode: createRadixNode(),
    staticRoutesMap: {}
  };
  const normalizeTrailingSlash = (p) => options.strictTrailingSlash ? p : p.replace(/\/$/, "") || "/";
  if (options.routes) {
    for (const path in options.routes) {
      insert(ctx, normalizeTrailingSlash(path), options.routes[path]);
    }
  }
  return {
    ctx,
    lookup: (path) => lookup(ctx, normalizeTrailingSlash(path)),
    insert: (path, data) => insert(ctx, normalizeTrailingSlash(path), data),
    remove: (path) => remove(ctx, normalizeTrailingSlash(path))
  };
}
function lookup(ctx, path) {
  const staticPathNode = ctx.staticRoutesMap[path];
  if (staticPathNode) {
    return staticPathNode.data;
  }
  const sections = path.split("/");
  const params = {};
  let paramsFound = false;
  let wildcardNode = null;
  let node = ctx.rootNode;
  let wildCardParam = null;
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    if (node.wildcardChildNode !== null) {
      wildcardNode = node.wildcardChildNode;
      wildCardParam = sections.slice(i).join("/");
    }
    const nextNode = node.children.get(section);
    if (nextNode === void 0) {
      if (node && node.placeholderChildren.length > 1) {
        const remaining = sections.length - i;
        node = node.placeholderChildren.find((c) => c.maxDepth === remaining) || null;
      } else {
        node = node.placeholderChildren[0] || null;
      }
      if (!node) {
        break;
      }
      if (node.paramName) {
        params[node.paramName] = section;
      }
      paramsFound = true;
    } else {
      node = nextNode;
    }
  }
  if ((node === null || node.data === null) && wildcardNode !== null) {
    node = wildcardNode;
    params[node.paramName || "_"] = wildCardParam;
    paramsFound = true;
  }
  if (!node) {
    return null;
  }
  if (paramsFound) {
    return {
      ...node.data,
      params: paramsFound ? params : void 0
    };
  }
  return node.data;
}
function insert(ctx, path, data) {
  let isStaticRoute = true;
  const sections = path.split("/");
  let node = ctx.rootNode;
  let _unnamedPlaceholderCtr = 0;
  const matchedNodes = [node];
  for (const section of sections) {
    let childNode;
    if (childNode = node.children.get(section)) {
      node = childNode;
    } else {
      const type = getNodeType(section);
      childNode = createRadixNode({ type, parent: node });
      node.children.set(section, childNode);
      if (type === NODE_TYPES.PLACEHOLDER) {
        childNode.paramName = section === "*" ? `_${_unnamedPlaceholderCtr++}` : section.slice(1);
        node.placeholderChildren.push(childNode);
        isStaticRoute = false;
      } else if (type === NODE_TYPES.WILDCARD) {
        node.wildcardChildNode = childNode;
        childNode.paramName = section.slice(
          3
          /* "**:" */
        ) || "_";
        isStaticRoute = false;
      }
      matchedNodes.push(childNode);
      node = childNode;
    }
  }
  for (const [depth, node2] of matchedNodes.entries()) {
    node2.maxDepth = Math.max(matchedNodes.length - depth, node2.maxDepth || 0);
  }
  node.data = data;
  if (isStaticRoute === true) {
    ctx.staticRoutesMap[path] = node;
  }
  return node;
}
function remove(ctx, path) {
  let success = false;
  const sections = path.split("/");
  let node = ctx.rootNode;
  for (const section of sections) {
    node = node.children.get(section);
    if (!node) {
      return success;
    }
  }
  if (node.data) {
    const lastSection = sections.at(-1) || "";
    node.data = null;
    if (Object.keys(node.children).length === 0 && node.parent) {
      node.parent.children.delete(lastSection);
      node.parent.wildcardChildNode = null;
      node.parent.placeholderChildren = [];
    }
    success = true;
  }
  return success;
}
function createRadixNode(options = {}) {
  return {
    type: options.type || NODE_TYPES.NORMAL,
    maxDepth: 0,
    parent: options.parent || null,
    children: /* @__PURE__ */ new Map(),
    data: options.data || null,
    paramName: options.paramName || null,
    wildcardChildNode: null,
    placeholderChildren: []
  };
}
function getNodeType(str) {
  if (str.startsWith("**")) {
    return NODE_TYPES.WILDCARD;
  }
  if (str[0] === ":" || str === "*") {
    return NODE_TYPES.PLACEHOLDER;
  }
  return NODE_TYPES.NORMAL;
}

function toRouteMatcher(router) {
  const table = _routerNodeToTable("", router.ctx.rootNode);
  return _createMatcher(table, router.ctx.options.strictTrailingSlash);
}
function _createMatcher(table, strictTrailingSlash) {
  return {
    ctx: { table },
    matchAll: (path) => _matchRoutes(path, table, strictTrailingSlash)
  };
}
function _createRouteTable() {
  return {
    static: /* @__PURE__ */ new Map(),
    wildcard: /* @__PURE__ */ new Map(),
    dynamic: /* @__PURE__ */ new Map()
  };
}
function _matchRoutes(path, table, strictTrailingSlash) {
  if (strictTrailingSlash !== true && path.endsWith("/")) {
    path = path.slice(0, -1) || "/";
  }
  const matches = [];
  for (const [key, value] of _sortRoutesMap(table.wildcard)) {
    if (path === key || path.startsWith(key + "/")) {
      matches.push(value);
    }
  }
  for (const [key, value] of _sortRoutesMap(table.dynamic)) {
    if (path.startsWith(key + "/")) {
      const subPath = "/" + path.slice(key.length).split("/").splice(2).join("/");
      matches.push(..._matchRoutes(subPath, value));
    }
  }
  const staticMatch = table.static.get(path);
  if (staticMatch) {
    matches.push(staticMatch);
  }
  return matches.filter(Boolean);
}
function _sortRoutesMap(m) {
  return [...m.entries()].sort((a, b) => a[0].length - b[0].length);
}
function _routerNodeToTable(initialPath, initialNode) {
  const table = _createRouteTable();
  function _addNode(path, node) {
    if (path) {
      if (node.type === NODE_TYPES.NORMAL && !(path.includes("*") || path.includes(":"))) {
        if (node.data) {
          table.static.set(path, node.data);
        }
      } else if (node.type === NODE_TYPES.WILDCARD) {
        table.wildcard.set(path.replace("/**", ""), node.data);
      } else if (node.type === NODE_TYPES.PLACEHOLDER) {
        const subTable = _routerNodeToTable("", node);
        if (node.data) {
          subTable.static.set("/", node.data);
        }
        table.dynamic.set(path.replace(/\/\*|\/:\w+/, ""), subTable);
        return;
      }
    }
    for (const [childPath, child] of node.children.entries()) {
      _addNode(`${path}/${childPath}`.replace("//", "/"), child);
    }
  }
  _addNode(initialPath, initialNode);
  return table;
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== null && prototype !== Object.prototype && Object.getPrototypeOf(prototype) !== null) {
    return false;
  }
  if (Symbol.iterator in value) {
    return false;
  }
  if (Symbol.toStringTag in value) {
    return Object.prototype.toString.call(value) === "[object Module]";
  }
  return true;
}

function _defu(baseObject, defaults, namespace = ".", merger) {
  if (!isPlainObject(defaults)) {
    return _defu(baseObject, {}, namespace, merger);
  }
  const object = Object.assign({}, defaults);
  for (const key in baseObject) {
    if (key === "__proto__" || key === "constructor") {
      continue;
    }
    const value = baseObject[key];
    if (value === null || value === void 0) {
      continue;
    }
    if (merger && merger(object, key, value, namespace)) {
      continue;
    }
    if (Array.isArray(value) && Array.isArray(object[key])) {
      object[key] = [...value, ...object[key]];
    } else if (isPlainObject(value) && isPlainObject(object[key])) {
      object[key] = _defu(
        value,
        object[key],
        (namespace ? `${namespace}.` : "") + key.toString(),
        merger
      );
    } else {
      object[key] = value;
    }
  }
  return object;
}
function createDefu(merger) {
  return (...arguments_) => (
    // eslint-disable-next-line unicorn/no-array-reduce
    arguments_.reduce((p, c) => _defu(p, c, "", merger), {})
  );
}
const defu = createDefu();
const defuFn = createDefu((object, key, currentValue) => {
  if (object[key] !== void 0 && typeof currentValue === "function") {
    object[key] = currentValue(object[key]);
    return true;
  }
});

function o(n){throw new Error(`${n} is not implemented yet!`)}let i$1 = class i extends EventEmitter{__unenv__={};readableEncoding=null;readableEnded=true;readableFlowing=false;readableHighWaterMark=0;readableLength=0;readableObjectMode=false;readableAborted=false;readableDidRead=false;closed=false;errored=null;readable=false;destroyed=false;static from(e,t){return new i(t)}constructor(e){super();}_read(e){}read(e){}setEncoding(e){return this}pause(){return this}resume(){return this}isPaused(){return  true}unpipe(e){return this}unshift(e,t){}wrap(e){return this}push(e,t){return  false}_destroy(e,t){this.removeAllListeners();}destroy(e){return this.destroyed=true,this._destroy(e),this}pipe(e,t){return {}}compose(e,t){throw new Error("Method not implemented.")}[Symbol.asyncDispose](){return this.destroy(),Promise.resolve()}async*[Symbol.asyncIterator](){throw o("Readable.asyncIterator")}iterator(e){throw o("Readable.iterator")}map(e,t){throw o("Readable.map")}filter(e,t){throw o("Readable.filter")}forEach(e,t){throw o("Readable.forEach")}reduce(e,t,r){throw o("Readable.reduce")}find(e,t){throw o("Readable.find")}findIndex(e,t){throw o("Readable.findIndex")}some(e,t){throw o("Readable.some")}toArray(e){throw o("Readable.toArray")}every(e,t){throw o("Readable.every")}flatMap(e,t){throw o("Readable.flatMap")}drop(e,t){throw o("Readable.drop")}take(e,t){throw o("Readable.take")}asIndexedPairs(e){throw o("Readable.asIndexedPairs")}};let l$1 = class l extends EventEmitter{__unenv__={};writable=true;writableEnded=false;writableFinished=false;writableHighWaterMark=0;writableLength=0;writableObjectMode=false;writableCorked=0;closed=false;errored=null;writableNeedDrain=false;writableAborted=false;destroyed=false;_data;_encoding="utf8";constructor(e){super();}pipe(e,t){return {}}_write(e,t,r){if(this.writableEnded){r&&r();return}if(this._data===void 0)this._data=e;else {const s=typeof this._data=="string"?Buffer$1.from(this._data,this._encoding||t||"utf8"):this._data,a=typeof e=="string"?Buffer$1.from(e,t||this._encoding||"utf8"):e;this._data=Buffer$1.concat([s,a]);}this._encoding=t,r&&r();}_writev(e,t){}_destroy(e,t){}_final(e){}write(e,t,r){const s=typeof t=="string"?this._encoding:"utf8",a=typeof t=="function"?t:typeof r=="function"?r:void 0;return this._write(e,s,a),true}setDefaultEncoding(e){return this}end(e,t,r){const s=typeof e=="function"?e:typeof t=="function"?t:typeof r=="function"?r:void 0;if(this.writableEnded)return s&&s(),this;const a=e===s?void 0:e;if(a){const u=t===s?void 0:t;this.write(a,u,s);}return this.writableEnded=true,this.writableFinished=true,this.emit("close"),this.emit("finish"),this}cork(){}uncork(){}destroy(e){return this.destroyed=true,delete this._data,this.removeAllListeners(),this}compose(e,t){throw new Error("Method not implemented.")}[Symbol.asyncDispose](){return Promise.resolve()}};const c$1=class c{allowHalfOpen=true;_destroy;constructor(e=new i$1,t=new l$1){Object.assign(this,e),Object.assign(this,t),this._destroy=m(e._destroy,t._destroy);}};function _(){return Object.assign(c$1.prototype,i$1.prototype),Object.assign(c$1.prototype,l$1.prototype),c$1}function m(...n){return function(...e){for(const t of n)t(...e);}}const g=_();class A extends g{__unenv__={};bufferSize=0;bytesRead=0;bytesWritten=0;connecting=false;destroyed=false;pending=false;localAddress="";localPort=0;remoteAddress="";remoteFamily="";remotePort=0;autoSelectFamilyAttemptedAddresses=[];readyState="readOnly";constructor(e){super();}write(e,t,r){return  false}connect(e,t,r){return this}end(e,t,r){return this}setEncoding(e){return this}pause(){return this}resume(){return this}setTimeout(e,t){return this}setNoDelay(e){return this}setKeepAlive(e,t){return this}address(){return {}}unref(){return this}ref(){return this}destroySoon(){this.destroy();}resetAndDestroy(){const e=new Error("ERR_SOCKET_CLOSED");return e.code="ERR_SOCKET_CLOSED",this.destroy(e),this}}class y extends i$1{aborted=false;httpVersion="1.1";httpVersionMajor=1;httpVersionMinor=1;complete=true;connection;socket;headers={};trailers={};method="GET";url="/";statusCode=200;statusMessage="";closed=false;errored=null;readable=false;constructor(e){super(),this.socket=this.connection=e||new A;}get rawHeaders(){const e=this.headers,t=[];for(const r in e)if(Array.isArray(e[r]))for(const s of e[r])t.push(r,s);else t.push(r,e[r]);return t}get rawTrailers(){return []}setTimeout(e,t){return this}get headersDistinct(){return p(this.headers)}get trailersDistinct(){return p(this.trailers)}}function p(n){const e={};for(const[t,r]of Object.entries(n))t&&(e[t]=(Array.isArray(r)?r:[r]).filter(Boolean));return e}class w extends l$1{statusCode=200;statusMessage="";upgrading=false;chunkedEncoding=false;shouldKeepAlive=false;useChunkedEncodingByDefault=false;sendDate=false;finished=false;headersSent=false;strictContentLength=false;connection=null;socket=null;req;_headers={};constructor(e){super(),this.req=e;}assignSocket(e){e._httpMessage=this,this.socket=e,this.connection=e,this.emit("socket",e),this._flush();}_flush(){this.flushHeaders();}detachSocket(e){}writeContinue(e){}writeHead(e,t,r){e&&(this.statusCode=e),typeof t=="string"&&(this.statusMessage=t,t=void 0);const s=r||t;if(s&&!Array.isArray(s))for(const a in s)this.setHeader(a,s[a]);return this.headersSent=true,this}writeProcessing(){}setTimeout(e,t){return this}appendHeader(e,t){e=e.toLowerCase();const r=this._headers[e],s=[...Array.isArray(r)?r:[r],...Array.isArray(t)?t:[t]].filter(Boolean);return this._headers[e]=s.length>1?s:s[0],this}setHeader(e,t){return this._headers[e.toLowerCase()]=t,this}setHeaders(e){for(const[t,r]of Object.entries(e))this.setHeader(t,r);return this}getHeader(e){return this._headers[e.toLowerCase()]}getHeaders(){return this._headers}getHeaderNames(){return Object.keys(this._headers)}hasHeader(e){return e.toLowerCase()in this._headers}removeHeader(e){delete this._headers[e.toLowerCase()];}addTrailers(e){}flushHeaders(){}writeEarlyHints(e,t){typeof t=="function"&&t();}}const E=(()=>{const n=function(){};return n.prototype=Object.create(null),n})();function R(n={}){const e=new E,t=Array.isArray(n)||H(n)?n:Object.entries(n);for(const[r,s]of t)if(s){if(e[r]===void 0){e[r]=s;continue}e[r]=[...Array.isArray(e[r])?e[r]:[e[r]],...Array.isArray(s)?s:[s]];}return e}function H(n){return typeof n?.entries=="function"}function v(n={}){if(n instanceof Headers)return n;const e=new Headers;for(const[t,r]of Object.entries(n))if(r!==void 0){if(Array.isArray(r)){for(const s of r)e.append(t,String(s));continue}e.set(t,String(r));}return e}const S=new Set([101,204,205,304]);async function b(n,e){const t=new y,r=new w(t);t.url=e.url?.toString()||"/";let s;if(!t.url.startsWith("/")){const d=new URL(t.url);s=d.host,t.url=d.pathname+d.search+d.hash;}t.method=e.method||"GET",t.headers=R(e.headers||{}),t.headers.host||(t.headers.host=e.host||s||"localhost"),t.connection.encrypted=t.connection.encrypted||e.protocol==="https",t.body=e.body||null,t.__unenv__=e.context,await n(t,r);let a=r._data;(S.has(r.statusCode)||t.method.toUpperCase()==="HEAD")&&(a=null,delete r._headers["content-length"]);const u={status:r.statusCode,statusText:r.statusMessage,headers:r._headers,body:a};return t.destroy(),r.destroy(),u}async function C(n,e,t={}){try{const r=await b(n,{url:e,...t});return new Response(r.body,{status:r.status,statusText:r.statusText,headers:v(r.headers)})}catch(r){return new Response(r.toString(),{status:Number.parseInt(r.statusCode||r.code)||500,statusText:r.statusText})}}

function hasProp(obj, prop) {
  try {
    return prop in obj;
  } catch {
    return false;
  }
}

class H3Error extends Error {
  static __h3_error__ = true;
  statusCode = 500;
  fatal = false;
  unhandled = false;
  statusMessage;
  data;
  cause;
  constructor(message, opts = {}) {
    super(message, opts);
    if (opts.cause && !this.cause) {
      this.cause = opts.cause;
    }
  }
  toJSON() {
    const obj = {
      message: this.message,
      statusCode: sanitizeStatusCode(this.statusCode, 500)
    };
    if (this.statusMessage) {
      obj.statusMessage = sanitizeStatusMessage(this.statusMessage);
    }
    if (this.data !== void 0) {
      obj.data = this.data;
    }
    return obj;
  }
}
function createError$1(input) {
  if (typeof input === "string") {
    return new H3Error(input);
  }
  if (isError(input)) {
    return input;
  }
  const err = new H3Error(input.message ?? input.statusMessage ?? "", {
    cause: input.cause || input
  });
  if (hasProp(input, "stack")) {
    try {
      Object.defineProperty(err, "stack", {
        get() {
          return input.stack;
        }
      });
    } catch {
      try {
        err.stack = input.stack;
      } catch {
      }
    }
  }
  if (input.data) {
    err.data = input.data;
  }
  if (input.statusCode) {
    err.statusCode = sanitizeStatusCode(input.statusCode, err.statusCode);
  } else if (input.status) {
    err.statusCode = sanitizeStatusCode(input.status, err.statusCode);
  }
  if (input.statusMessage) {
    err.statusMessage = input.statusMessage;
  } else if (input.statusText) {
    err.statusMessage = input.statusText;
  }
  if (err.statusMessage) {
    const originalMessage = err.statusMessage;
    const sanitizedMessage = sanitizeStatusMessage(err.statusMessage);
    if (sanitizedMessage !== originalMessage) {
      console.warn(
        "[h3] Please prefer using `message` for longer error messages instead of `statusMessage`. In the future, `statusMessage` will be sanitized by default."
      );
    }
  }
  if (input.fatal !== void 0) {
    err.fatal = input.fatal;
  }
  if (input.unhandled !== void 0) {
    err.unhandled = input.unhandled;
  }
  return err;
}
function sendError(event, error, debug) {
  if (event.handled) {
    return;
  }
  const h3Error = isError(error) ? error : createError$1(error);
  const responseBody = {
    statusCode: h3Error.statusCode,
    statusMessage: h3Error.statusMessage,
    stack: [],
    data: h3Error.data
  };
  if (debug) {
    responseBody.stack = (h3Error.stack || "").split("\n").map((l) => l.trim());
  }
  if (event.handled) {
    return;
  }
  const _code = Number.parseInt(h3Error.statusCode);
  setResponseStatus(event, _code, h3Error.statusMessage);
  event.node.res.setHeader("content-type", MIMES.json);
  event.node.res.end(JSON.stringify(responseBody, void 0, 2));
}
function isError(input) {
  return input?.constructor?.__h3_error__ === true;
}

function getQuery(event) {
  return getQuery$1(event.path || "");
}
function getRouterParams(event, opts = {}) {
  let params = event.context.params || {};
  if (opts.decode) {
    params = { ...params };
    for (const key in params) {
      params[key] = decode(params[key]);
    }
  }
  return params;
}
function getRouterParam(event, name, opts = {}) {
  const params = getRouterParams(event, opts);
  return params[name];
}
function getMethod(event, defaultMethod = "GET") {
  return (event.node.req.method || defaultMethod).toUpperCase();
}
function isMethod(event, expected, allowHead) {
  if (typeof expected === "string") {
    if (event.method === expected) {
      return true;
    }
  } else if (expected.includes(event.method)) {
    return true;
  }
  return false;
}
function assertMethod(event, expected, allowHead) {
  if (!isMethod(event, expected)) {
    throw createError$1({
      statusCode: 405,
      statusMessage: "HTTP method is not allowed."
    });
  }
}
function getRequestHeaders(event) {
  const _headers = {};
  for (const key in event.node.req.headers) {
    const val = event.node.req.headers[key];
    _headers[key] = Array.isArray(val) ? val.filter(Boolean).join(", ") : val;
  }
  return _headers;
}
function getRequestHeader(event, name) {
  const headers = getRequestHeaders(event);
  const value = headers[name.toLowerCase()];
  return value;
}
function getRequestHost(event, opts = {}) {
  if (opts.xForwardedHost) {
    const _header = event.node.req.headers["x-forwarded-host"];
    const xForwardedHost = (_header || "").split(",").shift()?.trim();
    if (xForwardedHost) {
      return xForwardedHost;
    }
  }
  return event.node.req.headers.host || "localhost";
}
function getRequestProtocol(event, opts = {}) {
  if (opts.xForwardedProto !== false && event.node.req.headers["x-forwarded-proto"] === "https") {
    return "https";
  }
  return event.node.req.connection?.encrypted ? "https" : "http";
}
function getRequestURL(event, opts = {}) {
  const host = getRequestHost(event, opts);
  const protocol = getRequestProtocol(event, opts);
  const path = (event.node.req.originalUrl || event.path).replace(
    /^[/\\]+/g,
    "/"
  );
  return new URL(path, `${protocol}://${host}`);
}
function toWebRequest(event) {
  return event.web?.request || new Request(getRequestURL(event), {
    // @ts-ignore Undici option
    duplex: "half",
    method: event.method,
    headers: event.headers,
    body: getRequestWebStream(event)
  });
}

const RawBodySymbol = Symbol.for("h3RawBody");
const ParsedBodySymbol = Symbol.for("h3ParsedBody");
const PayloadMethods$1 = ["PATCH", "POST", "PUT", "DELETE"];
function readRawBody(event, encoding = "utf8") {
  assertMethod(event, PayloadMethods$1);
  const _rawBody = event._requestBody || event.web?.request?.body || event.node.req[RawBodySymbol] || event.node.req.rawBody || event.node.req.body;
  if (_rawBody) {
    const promise2 = Promise.resolve(_rawBody).then((_resolved) => {
      if (Buffer.isBuffer(_resolved)) {
        return _resolved;
      }
      if (typeof _resolved.pipeTo === "function") {
        return new Promise((resolve, reject) => {
          const chunks = [];
          _resolved.pipeTo(
            new WritableStream({
              write(chunk) {
                chunks.push(chunk);
              },
              close() {
                resolve(Buffer.concat(chunks));
              },
              abort(reason) {
                reject(reason);
              }
            })
          ).catch(reject);
        });
      } else if (typeof _resolved.pipe === "function") {
        return new Promise((resolve, reject) => {
          const chunks = [];
          _resolved.on("data", (chunk) => {
            chunks.push(chunk);
          }).on("end", () => {
            resolve(Buffer.concat(chunks));
          }).on("error", reject);
        });
      }
      if (_resolved.constructor === Object) {
        return Buffer.from(JSON.stringify(_resolved));
      }
      if (_resolved instanceof URLSearchParams) {
        return Buffer.from(_resolved.toString());
      }
      if (_resolved instanceof FormData) {
        return new Response(_resolved).bytes().then((uint8arr) => Buffer.from(uint8arr));
      }
      return Buffer.from(_resolved);
    });
    return encoding ? promise2.then((buff) => buff.toString(encoding)) : promise2;
  }
  if (!Number.parseInt(event.node.req.headers["content-length"] || "") && !/\bchunked\b/i.test(
    String(event.node.req.headers["transfer-encoding"] ?? "")
  )) {
    return Promise.resolve(void 0);
  }
  const promise = event.node.req[RawBodySymbol] = new Promise(
    (resolve, reject) => {
      const bodyData = [];
      event.node.req.on("error", (err) => {
        reject(err);
      }).on("data", (chunk) => {
        bodyData.push(chunk);
      }).on("end", () => {
        resolve(Buffer.concat(bodyData));
      });
    }
  );
  const result = encoding ? promise.then((buff) => buff.toString(encoding)) : promise;
  return result;
}
async function readBody(event, options = {}) {
  const request = event.node.req;
  if (hasProp(request, ParsedBodySymbol)) {
    return request[ParsedBodySymbol];
  }
  const contentType = request.headers["content-type"] || "";
  const body = await readRawBody(event);
  let parsed;
  if (contentType === "application/json") {
    parsed = _parseJSON(body, options.strict ?? true);
  } else if (contentType.startsWith("application/x-www-form-urlencoded")) {
    parsed = _parseURLEncodedBody(body);
  } else if (contentType.startsWith("text/")) {
    parsed = body;
  } else {
    parsed = _parseJSON(body, options.strict ?? false);
  }
  request[ParsedBodySymbol] = parsed;
  return parsed;
}
function getRequestWebStream(event) {
  if (!PayloadMethods$1.includes(event.method)) {
    return;
  }
  const bodyStream = event.web?.request?.body || event._requestBody;
  if (bodyStream) {
    return bodyStream;
  }
  const _hasRawBody = RawBodySymbol in event.node.req || "rawBody" in event.node.req || "body" in event.node.req || "__unenv__" in event.node.req;
  if (_hasRawBody) {
    return new ReadableStream({
      async start(controller) {
        const _rawBody = await readRawBody(event, false);
        if (_rawBody) {
          controller.enqueue(_rawBody);
        }
        controller.close();
      }
    });
  }
  return new ReadableStream({
    start: (controller) => {
      event.node.req.on("data", (chunk) => {
        controller.enqueue(chunk);
      });
      event.node.req.on("end", () => {
        controller.close();
      });
      event.node.req.on("error", (err) => {
        controller.error(err);
      });
    }
  });
}
function _parseJSON(body = "", strict) {
  if (!body) {
    return void 0;
  }
  try {
    return destr(body, { strict });
  } catch {
    throw createError$1({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Invalid JSON body"
    });
  }
}
function _parseURLEncodedBody(body) {
  const form = new URLSearchParams(body);
  const parsedForm = /* @__PURE__ */ Object.create(null);
  for (const [key, value] of form.entries()) {
    if (hasProp(parsedForm, key)) {
      if (!Array.isArray(parsedForm[key])) {
        parsedForm[key] = [parsedForm[key]];
      }
      parsedForm[key].push(value);
    } else {
      parsedForm[key] = value;
    }
  }
  return parsedForm;
}

function handleCacheHeaders(event, opts) {
  const cacheControls = ["public", ...opts.cacheControls || []];
  let cacheMatched = false;
  if (opts.maxAge !== void 0) {
    cacheControls.push(`max-age=${+opts.maxAge}`, `s-maxage=${+opts.maxAge}`);
  }
  if (opts.modifiedTime) {
    const modifiedTime = new Date(opts.modifiedTime);
    const ifModifiedSince = event.node.req.headers["if-modified-since"];
    event.node.res.setHeader("last-modified", modifiedTime.toUTCString());
    if (ifModifiedSince && new Date(ifModifiedSince) >= modifiedTime) {
      cacheMatched = true;
    }
  }
  if (opts.etag) {
    event.node.res.setHeader("etag", opts.etag);
    const ifNonMatch = event.node.req.headers["if-none-match"];
    if (ifNonMatch === opts.etag) {
      cacheMatched = true;
    }
  }
  event.node.res.setHeader("cache-control", cacheControls.join(", "));
  if (cacheMatched) {
    event.node.res.statusCode = 304;
    if (!event.handled) {
      event.node.res.end();
    }
    return true;
  }
  return false;
}

const MIMES = {
  html: "text/html",
  json: "application/json"
};

const DISALLOWED_STATUS_CHARS = /[^\u0009\u0020-\u007E]/g;
function sanitizeStatusMessage(statusMessage = "") {
  return statusMessage.replace(DISALLOWED_STATUS_CHARS, "");
}
function sanitizeStatusCode(statusCode, defaultStatusCode = 200) {
  if (!statusCode) {
    return defaultStatusCode;
  }
  if (typeof statusCode === "string") {
    statusCode = Number.parseInt(statusCode, 10);
  }
  if (statusCode < 100 || statusCode > 999) {
    return defaultStatusCode;
  }
  return statusCode;
}
function splitCookiesString(cookiesString) {
  if (Array.isArray(cookiesString)) {
    return cookiesString.flatMap((c) => splitCookiesString(c));
  }
  if (typeof cookiesString !== "string") {
    return [];
  }
  const cookiesStrings = [];
  let pos = 0;
  let start;
  let ch;
  let lastComma;
  let nextStart;
  let cookiesSeparatorFound;
  const skipWhitespace = () => {
    while (pos < cookiesString.length && /\s/.test(cookiesString.charAt(pos))) {
      pos += 1;
    }
    return pos < cookiesString.length;
  };
  const notSpecialChar = () => {
    ch = cookiesString.charAt(pos);
    return ch !== "=" && ch !== ";" && ch !== ",";
  };
  while (pos < cookiesString.length) {
    start = pos;
    cookiesSeparatorFound = false;
    while (skipWhitespace()) {
      ch = cookiesString.charAt(pos);
      if (ch === ",") {
        lastComma = pos;
        pos += 1;
        skipWhitespace();
        nextStart = pos;
        while (pos < cookiesString.length && notSpecialChar()) {
          pos += 1;
        }
        if (pos < cookiesString.length && cookiesString.charAt(pos) === "=") {
          cookiesSeparatorFound = true;
          pos = nextStart;
          cookiesStrings.push(cookiesString.slice(start, lastComma));
          start = pos;
        } else {
          pos = lastComma + 1;
        }
      } else {
        pos += 1;
      }
    }
    if (!cookiesSeparatorFound || pos >= cookiesString.length) {
      cookiesStrings.push(cookiesString.slice(start));
    }
  }
  return cookiesStrings;
}

const defer = typeof setImmediate === "undefined" ? (fn) => fn() : setImmediate;
function send(event, data, type) {
  if (type) {
    defaultContentType(event, type);
  }
  return new Promise((resolve) => {
    defer(() => {
      if (!event.handled) {
        event.node.res.end(data);
      }
      resolve();
    });
  });
}
function sendNoContent(event, code) {
  if (event.handled) {
    return;
  }
  if (!code && event.node.res.statusCode !== 200) {
    code = event.node.res.statusCode;
  }
  const _code = sanitizeStatusCode(code, 204);
  if (_code === 204) {
    event.node.res.removeHeader("content-length");
  }
  event.node.res.writeHead(_code);
  event.node.res.end();
}
function setResponseStatus(event, code, text) {
  if (code) {
    event.node.res.statusCode = sanitizeStatusCode(
      code,
      event.node.res.statusCode
    );
  }
  if (text) {
    event.node.res.statusMessage = sanitizeStatusMessage(text);
  }
}
function getResponseStatus(event) {
  return event.node.res.statusCode;
}
function getResponseStatusText(event) {
  return event.node.res.statusMessage;
}
function defaultContentType(event, type) {
  if (type && event.node.res.statusCode !== 304 && !event.node.res.getHeader("content-type")) {
    event.node.res.setHeader("content-type", type);
  }
}
function sendRedirect(event, location, code = 302) {
  event.node.res.statusCode = sanitizeStatusCode(
    code,
    event.node.res.statusCode
  );
  event.node.res.setHeader("location", location);
  const encodedLoc = location.replace(/"/g, "%22");
  const html = `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=${encodedLoc}"></head></html>`;
  return send(event, html, MIMES.html);
}
function getResponseHeader(event, name) {
  return event.node.res.getHeader(name);
}
function setResponseHeaders(event, headers) {
  for (const [name, value] of Object.entries(headers)) {
    event.node.res.setHeader(
      name,
      value
    );
  }
}
const setHeaders = setResponseHeaders;
function setResponseHeader(event, name, value) {
  event.node.res.setHeader(name, value);
}
function appendResponseHeader(event, name, value) {
  let current = event.node.res.getHeader(name);
  if (!current) {
    event.node.res.setHeader(name, value);
    return;
  }
  if (!Array.isArray(current)) {
    current = [current.toString()];
  }
  event.node.res.setHeader(name, [...current, value]);
}
function removeResponseHeader(event, name) {
  return event.node.res.removeHeader(name);
}
function isStream(data) {
  if (!data || typeof data !== "object") {
    return false;
  }
  if (typeof data.pipe === "function") {
    if (typeof data._read === "function") {
      return true;
    }
    if (typeof data.abort === "function") {
      return true;
    }
  }
  if (typeof data.pipeTo === "function") {
    return true;
  }
  return false;
}
function isWebResponse(data) {
  return typeof Response !== "undefined" && data instanceof Response;
}
function sendStream(event, stream) {
  if (!stream || typeof stream !== "object") {
    throw new Error("[h3] Invalid stream provided.");
  }
  event.node.res._data = stream;
  if (!event.node.res.socket) {
    event._handled = true;
    return Promise.resolve();
  }
  if (hasProp(stream, "pipeTo") && typeof stream.pipeTo === "function") {
    return stream.pipeTo(
      new WritableStream({
        write(chunk) {
          event.node.res.write(chunk);
        }
      })
    ).then(() => {
      event.node.res.end();
    });
  }
  if (hasProp(stream, "pipe") && typeof stream.pipe === "function") {
    return new Promise((resolve, reject) => {
      stream.pipe(event.node.res);
      if (stream.on) {
        stream.on("end", () => {
          event.node.res.end();
          resolve();
        });
        stream.on("error", (error) => {
          reject(error);
        });
      }
      event.node.res.on("close", () => {
        if (stream.abort) {
          stream.abort();
        }
      });
    });
  }
  throw new Error("[h3] Invalid or incompatible stream provided.");
}
function sendWebResponse(event, response) {
  for (const [key, value] of response.headers) {
    if (key === "set-cookie") {
      event.node.res.appendHeader(key, splitCookiesString(value));
    } else {
      event.node.res.setHeader(key, value);
    }
  }
  if (response.status) {
    event.node.res.statusCode = sanitizeStatusCode(
      response.status,
      event.node.res.statusCode
    );
  }
  if (response.statusText) {
    event.node.res.statusMessage = sanitizeStatusMessage(response.statusText);
  }
  if (response.redirected) {
    event.node.res.setHeader("location", response.url);
  }
  if (!response.body) {
    event.node.res.end();
    return;
  }
  return sendStream(event, response.body);
}

const PayloadMethods = /* @__PURE__ */ new Set(["PATCH", "POST", "PUT", "DELETE"]);
const ignoredHeaders = /* @__PURE__ */ new Set([
  "transfer-encoding",
  "accept-encoding",
  "connection",
  "keep-alive",
  "upgrade",
  "expect",
  "host",
  "accept"
]);
async function proxyRequest(event, target, opts = {}) {
  let body;
  let duplex;
  if (PayloadMethods.has(event.method)) {
    if (opts.streamRequest) {
      body = getRequestWebStream(event);
      duplex = "half";
    } else {
      body = await readRawBody(event, false).catch(() => void 0);
    }
  }
  const method = opts.fetchOptions?.method || event.method;
  const fetchHeaders = mergeHeaders$1(
    getProxyRequestHeaders(event, { host: target.startsWith("/") }),
    opts.fetchOptions?.headers,
    opts.headers
  );
  return sendProxy(event, target, {
    ...opts,
    fetchOptions: {
      method,
      body,
      duplex,
      ...opts.fetchOptions,
      headers: fetchHeaders
    }
  });
}
async function sendProxy(event, target, opts = {}) {
  let response;
  try {
    response = await _getFetch(opts.fetch)(target, {
      headers: opts.headers,
      ignoreResponseError: true,
      // make $ofetch.raw transparent
      ...opts.fetchOptions
    });
  } catch (error) {
    throw createError$1({
      status: 502,
      statusMessage: "Bad Gateway",
      cause: error
    });
  }
  event.node.res.statusCode = sanitizeStatusCode(
    response.status,
    event.node.res.statusCode
  );
  event.node.res.statusMessage = sanitizeStatusMessage(response.statusText);
  const cookies = [];
  for (const [key, value] of response.headers.entries()) {
    if (key === "content-encoding") {
      continue;
    }
    if (key === "content-length") {
      continue;
    }
    if (key === "set-cookie") {
      cookies.push(...splitCookiesString(value));
      continue;
    }
    event.node.res.setHeader(key, value);
  }
  if (cookies.length > 0) {
    event.node.res.setHeader(
      "set-cookie",
      cookies.map((cookie) => {
        if (opts.cookieDomainRewrite) {
          cookie = rewriteCookieProperty(
            cookie,
            opts.cookieDomainRewrite,
            "domain"
          );
        }
        if (opts.cookiePathRewrite) {
          cookie = rewriteCookieProperty(
            cookie,
            opts.cookiePathRewrite,
            "path"
          );
        }
        return cookie;
      })
    );
  }
  if (opts.onResponse) {
    await opts.onResponse(event, response);
  }
  if (response._data !== void 0) {
    return response._data;
  }
  if (event.handled) {
    return;
  }
  if (opts.sendStream === false) {
    const data = new Uint8Array(await response.arrayBuffer());
    return event.node.res.end(data);
  }
  if (response.body) {
    for await (const chunk of response.body) {
      event.node.res.write(chunk);
    }
  }
  return event.node.res.end();
}
function getProxyRequestHeaders(event, opts) {
  const headers = /* @__PURE__ */ Object.create(null);
  const reqHeaders = getRequestHeaders(event);
  for (const name in reqHeaders) {
    if (!ignoredHeaders.has(name) || name === "host" && opts?.host) {
      headers[name] = reqHeaders[name];
    }
  }
  return headers;
}
function fetchWithEvent(event, req, init, options) {
  return _getFetch(options?.fetch)(req, {
    ...init,
    context: init?.context || event.context,
    headers: {
      ...getProxyRequestHeaders(event, {
        host: typeof req === "string" && req.startsWith("/")
      }),
      ...init?.headers
    }
  });
}
function _getFetch(_fetch) {
  if (_fetch) {
    return _fetch;
  }
  if (globalThis.fetch) {
    return globalThis.fetch;
  }
  throw new Error(
    "fetch is not available. Try importing `node-fetch-native/polyfill` for Node.js."
  );
}
function rewriteCookieProperty(header, map, property) {
  const _map = typeof map === "string" ? { "*": map } : map;
  return header.replace(
    new RegExp(`(;\\s*${property}=)([^;]+)`, "gi"),
    (match, prefix, previousValue) => {
      let newValue;
      if (previousValue in _map) {
        newValue = _map[previousValue];
      } else if ("*" in _map) {
        newValue = _map["*"];
      } else {
        return match;
      }
      return newValue ? prefix + newValue : "";
    }
  );
}
function mergeHeaders$1(defaults, ...inputs) {
  const _inputs = inputs.filter(Boolean);
  if (_inputs.length === 0) {
    return defaults;
  }
  const merged = new Headers(defaults);
  for (const input of _inputs) {
    const entries = Array.isArray(input) ? input : typeof input.entries === "function" ? input.entries() : Object.entries(input);
    for (const [key, value] of entries) {
      if (value !== void 0) {
        merged.set(key, value);
      }
    }
  }
  return merged;
}

class H3Event {
  "__is_event__" = true;
  // Context
  node;
  // Node
  web;
  // Web
  context = {};
  // Shared
  // Request
  _method;
  _path;
  _headers;
  _requestBody;
  // Response
  _handled = false;
  // Hooks
  _onBeforeResponseCalled;
  _onAfterResponseCalled;
  constructor(req, res) {
    this.node = { req, res };
  }
  // --- Request ---
  get method() {
    if (!this._method) {
      this._method = (this.node.req.method || "GET").toUpperCase();
    }
    return this._method;
  }
  get path() {
    return this._path || this.node.req.url || "/";
  }
  get headers() {
    if (!this._headers) {
      this._headers = _normalizeNodeHeaders(this.node.req.headers);
    }
    return this._headers;
  }
  // --- Respoonse ---
  get handled() {
    return this._handled || this.node.res.writableEnded || this.node.res.headersSent;
  }
  respondWith(response) {
    return Promise.resolve(response).then(
      (_response) => sendWebResponse(this, _response)
    );
  }
  // --- Utils ---
  toString() {
    return `[${this.method}] ${this.path}`;
  }
  toJSON() {
    return this.toString();
  }
  // --- Deprecated ---
  /** @deprecated Please use `event.node.req` instead. */
  get req() {
    return this.node.req;
  }
  /** @deprecated Please use `event.node.res` instead. */
  get res() {
    return this.node.res;
  }
}
function isEvent(input) {
  return hasProp(input, "__is_event__");
}
function createEvent(req, res) {
  return new H3Event(req, res);
}
function _normalizeNodeHeaders(nodeHeaders) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(nodeHeaders)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(name, item);
      }
    } else if (value) {
      headers.set(name, value);
    }
  }
  return headers;
}

function defineEventHandler(handler) {
  if (typeof handler === "function") {
    handler.__is_handler__ = true;
    return handler;
  }
  const _hooks = {
    onRequest: _normalizeArray(handler.onRequest),
    onBeforeResponse: _normalizeArray(handler.onBeforeResponse)
  };
  const _handler = (event) => {
    return _callHandler(event, handler.handler, _hooks);
  };
  _handler.__is_handler__ = true;
  _handler.__resolve__ = handler.handler.__resolve__;
  _handler.__websocket__ = handler.websocket;
  return _handler;
}
function _normalizeArray(input) {
  return input ? Array.isArray(input) ? input : [input] : void 0;
}
async function _callHandler(event, handler, hooks) {
  if (hooks.onRequest) {
    for (const hook of hooks.onRequest) {
      await hook(event);
      if (event.handled) {
        return;
      }
    }
  }
  const body = await handler(event);
  const response = { body };
  if (hooks.onBeforeResponse) {
    for (const hook of hooks.onBeforeResponse) {
      await hook(event, response);
    }
  }
  return response.body;
}
const eventHandler = defineEventHandler;
function isEventHandler(input) {
  return hasProp(input, "__is_handler__");
}
function toEventHandler(input, _, _route) {
  if (!isEventHandler(input)) {
    console.warn(
      "[h3] Implicit event handler conversion is deprecated. Use `eventHandler()` or `fromNodeMiddleware()` to define event handlers.",
      _route && _route !== "/" ? `
     Route: ${_route}` : "",
      `
     Handler: ${input}`
    );
  }
  return input;
}
function defineLazyEventHandler(factory) {
  let _promise;
  let _resolved;
  const resolveHandler = () => {
    if (_resolved) {
      return Promise.resolve(_resolved);
    }
    if (!_promise) {
      _promise = Promise.resolve(factory()).then((r) => {
        const handler2 = r.default || r;
        if (typeof handler2 !== "function") {
          throw new TypeError(
            "Invalid lazy handler result. It should be a function:",
            handler2
          );
        }
        _resolved = { handler: toEventHandler(r.default || r) };
        return _resolved;
      });
    }
    return _promise;
  };
  const handler = eventHandler((event) => {
    if (_resolved) {
      return _resolved.handler(event);
    }
    return resolveHandler().then((r) => r.handler(event));
  });
  handler.__resolve__ = resolveHandler;
  return handler;
}
const lazyEventHandler = defineLazyEventHandler;

function createApp(options = {}) {
  const stack = [];
  const handler = createAppEventHandler(stack, options);
  const resolve = createResolver(stack);
  handler.__resolve__ = resolve;
  const getWebsocket = cachedFn(() => websocketOptions(resolve, options));
  const app = {
    // @ts-expect-error
    use: (arg1, arg2, arg3) => use(app, arg1, arg2, arg3),
    resolve,
    handler,
    stack,
    options,
    get websocket() {
      return getWebsocket();
    }
  };
  return app;
}
function use(app, arg1, arg2, arg3) {
  if (Array.isArray(arg1)) {
    for (const i of arg1) {
      use(app, i, arg2, arg3);
    }
  } else if (Array.isArray(arg2)) {
    for (const i of arg2) {
      use(app, arg1, i, arg3);
    }
  } else if (typeof arg1 === "string") {
    app.stack.push(
      normalizeLayer({ ...arg3, route: arg1, handler: arg2 })
    );
  } else if (typeof arg1 === "function") {
    app.stack.push(normalizeLayer({ ...arg2, handler: arg1 }));
  } else {
    app.stack.push(normalizeLayer({ ...arg1 }));
  }
  return app;
}
function createAppEventHandler(stack, options) {
  const spacing = options.debug ? 2 : void 0;
  return eventHandler(async (event) => {
    event.node.req.originalUrl = event.node.req.originalUrl || event.node.req.url || "/";
    const _reqPath = event._path || event.node.req.url || "/";
    let _layerPath;
    if (options.onRequest) {
      await options.onRequest(event);
    }
    for (const layer of stack) {
      if (layer.route.length > 1) {
        if (!_reqPath.startsWith(layer.route)) {
          continue;
        }
        _layerPath = _reqPath.slice(layer.route.length) || "/";
      } else {
        _layerPath = _reqPath;
      }
      if (layer.match && !layer.match(_layerPath, event)) {
        continue;
      }
      event._path = _layerPath;
      event.node.req.url = _layerPath;
      const val = await layer.handler(event);
      const _body = val === void 0 ? void 0 : await val;
      if (_body !== void 0) {
        const _response = { body: _body };
        if (options.onBeforeResponse) {
          event._onBeforeResponseCalled = true;
          await options.onBeforeResponse(event, _response);
        }
        await handleHandlerResponse(event, _response.body, spacing);
        if (options.onAfterResponse) {
          event._onAfterResponseCalled = true;
          await options.onAfterResponse(event, _response);
        }
        return;
      }
      if (event.handled) {
        if (options.onAfterResponse) {
          event._onAfterResponseCalled = true;
          await options.onAfterResponse(event, void 0);
        }
        return;
      }
    }
    if (!event.handled) {
      throw createError$1({
        statusCode: 404,
        statusMessage: `Cannot find any path matching ${event.path || "/"}.`
      });
    }
    if (options.onAfterResponse) {
      event._onAfterResponseCalled = true;
      await options.onAfterResponse(event, void 0);
    }
  });
}
function createResolver(stack) {
  return async (path) => {
    let _layerPath;
    for (const layer of stack) {
      if (layer.route === "/" && !layer.handler.__resolve__) {
        continue;
      }
      if (!path.startsWith(layer.route)) {
        continue;
      }
      _layerPath = path.slice(layer.route.length) || "/";
      if (layer.match && !layer.match(_layerPath, void 0)) {
        continue;
      }
      let res = { route: layer.route, handler: layer.handler };
      if (res.handler.__resolve__) {
        const _res = await res.handler.__resolve__(_layerPath);
        if (!_res) {
          continue;
        }
        res = {
          ...res,
          ..._res,
          route: joinURL(res.route || "/", _res.route || "/")
        };
      }
      return res;
    }
  };
}
function normalizeLayer(input) {
  let handler = input.handler;
  if (handler.handler) {
    handler = handler.handler;
  }
  if (input.lazy) {
    handler = lazyEventHandler(handler);
  } else if (!isEventHandler(handler)) {
    handler = toEventHandler(handler, void 0, input.route);
  }
  return {
    route: withoutTrailingSlash(input.route),
    match: input.match,
    handler
  };
}
function handleHandlerResponse(event, val, jsonSpace) {
  if (val === null) {
    return sendNoContent(event);
  }
  if (val) {
    if (isWebResponse(val)) {
      return sendWebResponse(event, val);
    }
    if (isStream(val)) {
      return sendStream(event, val);
    }
    if (val.buffer) {
      return send(event, val);
    }
    if (val.arrayBuffer && typeof val.arrayBuffer === "function") {
      return val.arrayBuffer().then((arrayBuffer) => {
        return send(event, Buffer.from(arrayBuffer), val.type);
      });
    }
    if (val instanceof Error) {
      throw createError$1(val);
    }
    if (typeof val.end === "function") {
      return true;
    }
  }
  const valType = typeof val;
  if (valType === "string") {
    return send(event, val, MIMES.html);
  }
  if (valType === "object" || valType === "boolean" || valType === "number") {
    return send(event, JSON.stringify(val, void 0, jsonSpace), MIMES.json);
  }
  if (valType === "bigint") {
    return send(event, val.toString(), MIMES.json);
  }
  throw createError$1({
    statusCode: 500,
    statusMessage: `[h3] Cannot send ${valType} as response.`
  });
}
function cachedFn(fn) {
  let cache;
  return () => {
    if (!cache) {
      cache = fn();
    }
    return cache;
  };
}
function websocketOptions(evResolver, appOptions) {
  return {
    ...appOptions.websocket,
    async resolve(info) {
      const url = info.request?.url || info.url || "/";
      const { pathname } = typeof url === "string" ? parseURL(url) : url;
      const resolved = await evResolver(pathname);
      return resolved?.handler?.__websocket__ || {};
    }
  };
}

const RouterMethods = [
  "connect",
  "delete",
  "get",
  "head",
  "options",
  "post",
  "put",
  "trace",
  "patch"
];
function createRouter(opts = {}) {
  const _router = createRouter$1({});
  const routes = {};
  let _matcher;
  const router = {};
  const addRoute = (path, handler, method) => {
    let route = routes[path];
    if (!route) {
      routes[path] = route = { path, handlers: {} };
      _router.insert(path, route);
    }
    if (Array.isArray(method)) {
      for (const m of method) {
        addRoute(path, handler, m);
      }
    } else {
      route.handlers[method] = toEventHandler(handler, void 0, path);
    }
    return router;
  };
  router.use = router.add = (path, handler, method) => addRoute(path, handler, method || "all");
  for (const method of RouterMethods) {
    router[method] = (path, handle) => router.add(path, handle, method);
  }
  const matchHandler = (path = "/", method = "get") => {
    const qIndex = path.indexOf("?");
    if (qIndex !== -1) {
      path = path.slice(0, Math.max(0, qIndex));
    }
    const matched = _router.lookup(path);
    if (!matched || !matched.handlers) {
      return {
        error: createError$1({
          statusCode: 404,
          name: "Not Found",
          statusMessage: `Cannot find any route matching ${path || "/"}.`
        })
      };
    }
    let handler = matched.handlers[method] || matched.handlers.all;
    if (!handler) {
      if (!_matcher) {
        _matcher = toRouteMatcher(_router);
      }
      const _matches = _matcher.matchAll(path).reverse();
      for (const _match of _matches) {
        if (_match.handlers[method]) {
          handler = _match.handlers[method];
          matched.handlers[method] = matched.handlers[method] || handler;
          break;
        }
        if (_match.handlers.all) {
          handler = _match.handlers.all;
          matched.handlers.all = matched.handlers.all || handler;
          break;
        }
      }
    }
    if (!handler) {
      return {
        error: createError$1({
          statusCode: 405,
          name: "Method Not Allowed",
          statusMessage: `Method ${method} is not allowed on this route.`
        })
      };
    }
    return { matched, handler };
  };
  const isPreemptive = opts.preemptive || opts.preemtive;
  router.handler = eventHandler((event) => {
    const match = matchHandler(
      event.path,
      event.method.toLowerCase()
    );
    if ("error" in match) {
      if (isPreemptive) {
        throw match.error;
      } else {
        return;
      }
    }
    event.context.matchedRoute = match.matched;
    const params = match.matched.params || {};
    event.context.params = params;
    return Promise.resolve(match.handler(event)).then((res) => {
      if (res === void 0 && isPreemptive) {
        return null;
      }
      return res;
    });
  });
  router.handler.__resolve__ = async (path) => {
    path = withLeadingSlash(path);
    const match = matchHandler(path);
    if ("error" in match) {
      return;
    }
    let res = {
      route: match.matched.path,
      handler: match.handler
    };
    if (match.handler.__resolve__) {
      const _res = await match.handler.__resolve__(path);
      if (!_res) {
        return;
      }
      res = { ...res, ..._res };
    }
    return res;
  };
  return router;
}
function toNodeListener(app) {
  const toNodeHandle = async function(req, res) {
    const event = createEvent(req, res);
    try {
      await app.handler(event);
    } catch (_error) {
      const error = createError$1(_error);
      if (!isError(_error)) {
        error.unhandled = true;
      }
      setResponseStatus(event, error.statusCode, error.statusMessage);
      if (app.options.onError) {
        await app.options.onError(error, event);
      }
      if (event.handled) {
        return;
      }
      if (error.unhandled || error.fatal) {
        console.error("[h3]", error.fatal ? "[fatal]" : "[unhandled]", error);
      }
      if (app.options.onBeforeResponse && !event._onBeforeResponseCalled) {
        await app.options.onBeforeResponse(event, { body: error });
      }
      await sendError(event, error, !!app.options.debug);
      if (app.options.onAfterResponse && !event._onAfterResponseCalled) {
        await app.options.onAfterResponse(event, { body: error });
      }
    }
  };
  return toNodeHandle;
}

function flatHooks(configHooks, hooks = {}, parentName) {
  for (const key in configHooks) {
    const subHook = configHooks[key];
    const name = parentName ? `${parentName}:${key}` : key;
    if (typeof subHook === "object" && subHook !== null) {
      flatHooks(subHook, hooks, name);
    } else if (typeof subHook === "function") {
      hooks[name] = subHook;
    }
  }
  return hooks;
}
const defaultTask = { run: (function_) => function_() };
const _createTask = () => defaultTask;
const createTask = typeof console.createTask !== "undefined" ? console.createTask : _createTask;
function serialTaskCaller(hooks, args) {
  const name = args.shift();
  const task = createTask(name);
  return hooks.reduce(
    (promise, hookFunction) => promise.then(() => task.run(() => hookFunction(...args))),
    Promise.resolve()
  );
}
function parallelTaskCaller(hooks, args) {
  const name = args.shift();
  const task = createTask(name);
  return Promise.all(hooks.map((hook) => task.run(() => hook(...args))));
}
function callEachWith(callbacks, arg0) {
  for (const callback of [...callbacks]) {
    callback(arg0);
  }
}

class Hookable {
  constructor() {
    this._hooks = {};
    this._before = void 0;
    this._after = void 0;
    this._deprecatedMessages = void 0;
    this._deprecatedHooks = {};
    this.hook = this.hook.bind(this);
    this.callHook = this.callHook.bind(this);
    this.callHookWith = this.callHookWith.bind(this);
  }
  hook(name, function_, options = {}) {
    if (!name || typeof function_ !== "function") {
      return () => {
      };
    }
    const originalName = name;
    let dep;
    while (this._deprecatedHooks[name]) {
      dep = this._deprecatedHooks[name];
      name = dep.to;
    }
    if (dep && !options.allowDeprecated) {
      let message = dep.message;
      if (!message) {
        message = `${originalName} hook has been deprecated` + (dep.to ? `, please use ${dep.to}` : "");
      }
      if (!this._deprecatedMessages) {
        this._deprecatedMessages = /* @__PURE__ */ new Set();
      }
      if (!this._deprecatedMessages.has(message)) {
        console.warn(message);
        this._deprecatedMessages.add(message);
      }
    }
    if (!function_.name) {
      try {
        Object.defineProperty(function_, "name", {
          get: () => "_" + name.replace(/\W+/g, "_") + "_hook_cb",
          configurable: true
        });
      } catch {
      }
    }
    this._hooks[name] = this._hooks[name] || [];
    this._hooks[name].push(function_);
    return () => {
      if (function_) {
        this.removeHook(name, function_);
        function_ = void 0;
      }
    };
  }
  hookOnce(name, function_) {
    let _unreg;
    let _function = (...arguments_) => {
      if (typeof _unreg === "function") {
        _unreg();
      }
      _unreg = void 0;
      _function = void 0;
      return function_(...arguments_);
    };
    _unreg = this.hook(name, _function);
    return _unreg;
  }
  removeHook(name, function_) {
    if (this._hooks[name]) {
      const index = this._hooks[name].indexOf(function_);
      if (index !== -1) {
        this._hooks[name].splice(index, 1);
      }
      if (this._hooks[name].length === 0) {
        delete this._hooks[name];
      }
    }
  }
  deprecateHook(name, deprecated) {
    this._deprecatedHooks[name] = typeof deprecated === "string" ? { to: deprecated } : deprecated;
    const _hooks = this._hooks[name] || [];
    delete this._hooks[name];
    for (const hook of _hooks) {
      this.hook(name, hook);
    }
  }
  deprecateHooks(deprecatedHooks) {
    Object.assign(this._deprecatedHooks, deprecatedHooks);
    for (const name in deprecatedHooks) {
      this.deprecateHook(name, deprecatedHooks[name]);
    }
  }
  addHooks(configHooks) {
    const hooks = flatHooks(configHooks);
    const removeFns = Object.keys(hooks).map(
      (key) => this.hook(key, hooks[key])
    );
    return () => {
      for (const unreg of removeFns.splice(0, removeFns.length)) {
        unreg();
      }
    };
  }
  removeHooks(configHooks) {
    const hooks = flatHooks(configHooks);
    for (const key in hooks) {
      this.removeHook(key, hooks[key]);
    }
  }
  removeAllHooks() {
    for (const key in this._hooks) {
      delete this._hooks[key];
    }
  }
  callHook(name, ...arguments_) {
    arguments_.unshift(name);
    return this.callHookWith(serialTaskCaller, name, ...arguments_);
  }
  callHookParallel(name, ...arguments_) {
    arguments_.unshift(name);
    return this.callHookWith(parallelTaskCaller, name, ...arguments_);
  }
  callHookWith(caller, name, ...arguments_) {
    const event = this._before || this._after ? { name, args: arguments_, context: {} } : void 0;
    if (this._before) {
      callEachWith(this._before, event);
    }
    const result = caller(
      name in this._hooks ? [...this._hooks[name]] : [],
      arguments_
    );
    if (result instanceof Promise) {
      return result.finally(() => {
        if (this._after && event) {
          callEachWith(this._after, event);
        }
      });
    }
    if (this._after && event) {
      callEachWith(this._after, event);
    }
    return result;
  }
  beforeEach(function_) {
    this._before = this._before || [];
    this._before.push(function_);
    return () => {
      if (this._before !== void 0) {
        const index = this._before.indexOf(function_);
        if (index !== -1) {
          this._before.splice(index, 1);
        }
      }
    };
  }
  afterEach(function_) {
    this._after = this._after || [];
    this._after.push(function_);
    return () => {
      if (this._after !== void 0) {
        const index = this._after.indexOf(function_);
        if (index !== -1) {
          this._after.splice(index, 1);
        }
      }
    };
  }
}
function createHooks() {
  return new Hookable();
}

const s$1=globalThis.Headers,i=globalThis.AbortController,l=globalThis.fetch||(()=>{throw new Error("[node-fetch-native] Failed to fetch: `globalThis.fetch` is not available!")});

class FetchError extends Error {
  constructor(message, opts) {
    super(message, opts);
    this.name = "FetchError";
    if (opts?.cause && !this.cause) {
      this.cause = opts.cause;
    }
  }
}
function createFetchError(ctx) {
  const errorMessage = ctx.error?.message || ctx.error?.toString() || "";
  const method = ctx.request?.method || ctx.options?.method || "GET";
  const url = ctx.request?.url || String(ctx.request) || "/";
  const requestStr = `[${method}] ${JSON.stringify(url)}`;
  const statusStr = ctx.response ? `${ctx.response.status} ${ctx.response.statusText}` : "<no response>";
  const message = `${requestStr}: ${statusStr}${errorMessage ? ` ${errorMessage}` : ""}`;
  const fetchError = new FetchError(
    message,
    ctx.error ? { cause: ctx.error } : void 0
  );
  for (const key of ["request", "options", "response"]) {
    Object.defineProperty(fetchError, key, {
      get() {
        return ctx[key];
      }
    });
  }
  for (const [key, refKey] of [
    ["data", "_data"],
    ["status", "status"],
    ["statusCode", "status"],
    ["statusText", "statusText"],
    ["statusMessage", "statusText"]
  ]) {
    Object.defineProperty(fetchError, key, {
      get() {
        return ctx.response && ctx.response[refKey];
      }
    });
  }
  return fetchError;
}

const payloadMethods = new Set(
  Object.freeze(["PATCH", "POST", "PUT", "DELETE"])
);
function isPayloadMethod(method = "GET") {
  return payloadMethods.has(method.toUpperCase());
}
function isJSONSerializable(value) {
  if (value === void 0) {
    return false;
  }
  const t = typeof value;
  if (t === "string" || t === "number" || t === "boolean" || t === null) {
    return true;
  }
  if (t !== "object") {
    return false;
  }
  if (Array.isArray(value)) {
    return true;
  }
  if (value.buffer) {
    return false;
  }
  if (value instanceof FormData || value instanceof URLSearchParams) {
    return false;
  }
  return value.constructor && value.constructor.name === "Object" || typeof value.toJSON === "function";
}
const textTypes = /* @__PURE__ */ new Set([
  "image/svg",
  "application/xml",
  "application/xhtml",
  "application/html"
]);
const JSON_RE = /^application\/(?:[\w!#$%&*.^`~-]*\+)?json(;.+)?$/i;
function detectResponseType(_contentType = "") {
  if (!_contentType) {
    return "json";
  }
  const contentType = _contentType.split(";").shift() || "";
  if (JSON_RE.test(contentType)) {
    return "json";
  }
  if (contentType === "text/event-stream") {
    return "stream";
  }
  if (textTypes.has(contentType) || contentType.startsWith("text/")) {
    return "text";
  }
  return "blob";
}
function resolveFetchOptions(request, input, defaults, Headers) {
  const headers = mergeHeaders(
    input?.headers ?? request?.headers,
    defaults?.headers,
    Headers
  );
  let query;
  if (defaults?.query || defaults?.params || input?.params || input?.query) {
    query = {
      ...defaults?.params,
      ...defaults?.query,
      ...input?.params,
      ...input?.query
    };
  }
  return {
    ...defaults,
    ...input,
    query,
    params: query,
    headers
  };
}
function mergeHeaders(input, defaults, Headers) {
  if (!defaults) {
    return new Headers(input);
  }
  const headers = new Headers(defaults);
  if (input) {
    for (const [key, value] of Symbol.iterator in input || Array.isArray(input) ? input : new Headers(input)) {
      headers.set(key, value);
    }
  }
  return headers;
}
async function callHooks(context, hooks) {
  if (hooks) {
    if (Array.isArray(hooks)) {
      for (const hook of hooks) {
        await hook(context);
      }
    } else {
      await hooks(context);
    }
  }
}

const retryStatusCodes = /* @__PURE__ */ new Set([
  408,
  // Request Timeout
  409,
  // Conflict
  425,
  // Too Early (Experimental)
  429,
  // Too Many Requests
  500,
  // Internal Server Error
  502,
  // Bad Gateway
  503,
  // Service Unavailable
  504
  // Gateway Timeout
]);
const nullBodyResponses = /* @__PURE__ */ new Set([101, 204, 205, 304]);
function createFetch(globalOptions = {}) {
  const {
    fetch = globalThis.fetch,
    Headers = globalThis.Headers,
    AbortController = globalThis.AbortController
  } = globalOptions;
  async function onError(context) {
    const isAbort = context.error && context.error.name === "AbortError" && !context.options.timeout || false;
    if (context.options.retry !== false && !isAbort) {
      let retries;
      if (typeof context.options.retry === "number") {
        retries = context.options.retry;
      } else {
        retries = isPayloadMethod(context.options.method) ? 0 : 1;
      }
      const responseCode = context.response && context.response.status || 500;
      if (retries > 0 && (Array.isArray(context.options.retryStatusCodes) ? context.options.retryStatusCodes.includes(responseCode) : retryStatusCodes.has(responseCode))) {
        const retryDelay = typeof context.options.retryDelay === "function" ? context.options.retryDelay(context) : context.options.retryDelay || 0;
        if (retryDelay > 0) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        }
        return $fetchRaw(context.request, {
          ...context.options,
          retry: retries - 1
        });
      }
    }
    const error = createFetchError(context);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(error, $fetchRaw);
    }
    throw error;
  }
  const $fetchRaw = async function $fetchRaw2(_request, _options = {}) {
    const context = {
      request: _request,
      options: resolveFetchOptions(
        _request,
        _options,
        globalOptions.defaults,
        Headers
      ),
      response: void 0,
      error: void 0
    };
    if (context.options.method) {
      context.options.method = context.options.method.toUpperCase();
    }
    if (context.options.onRequest) {
      await callHooks(context, context.options.onRequest);
      if (!(context.options.headers instanceof Headers)) {
        context.options.headers = new Headers(
          context.options.headers || {}
          /* compat */
        );
      }
    }
    if (typeof context.request === "string") {
      if (context.options.baseURL) {
        context.request = withBase(context.request, context.options.baseURL);
      }
      if (context.options.query) {
        context.request = withQuery(context.request, context.options.query);
        delete context.options.query;
      }
      if ("query" in context.options) {
        delete context.options.query;
      }
      if ("params" in context.options) {
        delete context.options.params;
      }
    }
    if (context.options.body && isPayloadMethod(context.options.method)) {
      if (isJSONSerializable(context.options.body)) {
        const contentType = context.options.headers.get("content-type");
        if (typeof context.options.body !== "string") {
          context.options.body = contentType === "application/x-www-form-urlencoded" ? new URLSearchParams(
            context.options.body
          ).toString() : JSON.stringify(context.options.body);
        }
        if (!contentType) {
          context.options.headers.set("content-type", "application/json");
        }
        if (!context.options.headers.has("accept")) {
          context.options.headers.set("accept", "application/json");
        }
      } else if (
        // ReadableStream Body
        "pipeTo" in context.options.body && typeof context.options.body.pipeTo === "function" || // Node.js Stream Body
        typeof context.options.body.pipe === "function"
      ) {
        if (!("duplex" in context.options)) {
          context.options.duplex = "half";
        }
      }
    }
    let abortTimeout;
    if (!context.options.signal && context.options.timeout) {
      const controller = new AbortController();
      abortTimeout = setTimeout(() => {
        const error = new Error(
          "[TimeoutError]: The operation was aborted due to timeout"
        );
        error.name = "TimeoutError";
        error.code = 23;
        controller.abort(error);
      }, context.options.timeout);
      context.options.signal = controller.signal;
    }
    try {
      context.response = await fetch(
        context.request,
        context.options
      );
    } catch (error) {
      context.error = error;
      if (context.options.onRequestError) {
        await callHooks(
          context,
          context.options.onRequestError
        );
      }
      return await onError(context);
    } finally {
      if (abortTimeout) {
        clearTimeout(abortTimeout);
      }
    }
    const hasBody = (context.response.body || // https://github.com/unjs/ofetch/issues/324
    // https://github.com/unjs/ofetch/issues/294
    // https://github.com/JakeChampion/fetch/issues/1454
    context.response._bodyInit) && !nullBodyResponses.has(context.response.status) && context.options.method !== "HEAD";
    if (hasBody) {
      const responseType = (context.options.parseResponse ? "json" : context.options.responseType) || detectResponseType(context.response.headers.get("content-type") || "");
      switch (responseType) {
        case "json": {
          const data = await context.response.text();
          const parseFunction = context.options.parseResponse || destr;
          context.response._data = parseFunction(data);
          break;
        }
        case "stream": {
          context.response._data = context.response.body || context.response._bodyInit;
          break;
        }
        default: {
          context.response._data = await context.response[responseType]();
        }
      }
    }
    if (context.options.onResponse) {
      await callHooks(
        context,
        context.options.onResponse
      );
    }
    if (!context.options.ignoreResponseError && context.response.status >= 400 && context.response.status < 600) {
      if (context.options.onResponseError) {
        await callHooks(
          context,
          context.options.onResponseError
        );
      }
      return await onError(context);
    }
    return context.response;
  };
  const $fetch = async function $fetch2(request, options) {
    const r = await $fetchRaw(request, options);
    return r._data;
  };
  $fetch.raw = $fetchRaw;
  $fetch.native = (...args) => fetch(...args);
  $fetch.create = (defaultOptions = {}, customGlobalOptions = {}) => createFetch({
    ...globalOptions,
    ...customGlobalOptions,
    defaults: {
      ...globalOptions.defaults,
      ...customGlobalOptions.defaults,
      ...defaultOptions
    }
  });
  return $fetch;
}

function createNodeFetch() {
  const useKeepAlive = JSON.parse(process.env.FETCH_KEEP_ALIVE || "false");
  if (!useKeepAlive) {
    return l;
  }
  const agentOptions = { keepAlive: true };
  const httpAgent = new http.Agent(agentOptions);
  const httpsAgent = new https.Agent(agentOptions);
  const nodeFetchOptions = {
    agent(parsedURL) {
      return parsedURL.protocol === "http:" ? httpAgent : httpsAgent;
    }
  };
  return function nodeFetchWithKeepAlive(input, init) {
    return l(input, { ...nodeFetchOptions, ...init });
  };
}
const fetch = globalThis.fetch ? (...args) => globalThis.fetch(...args) : createNodeFetch();
const Headers$1 = globalThis.Headers || s$1;
const AbortController = globalThis.AbortController || i;
const ofetch = createFetch({ fetch, Headers: Headers$1, AbortController });
const $fetch = ofetch;

function wrapToPromise(value) {
  if (!value || typeof value.then !== "function") {
    return Promise.resolve(value);
  }
  return value;
}
function asyncCall(function_, ...arguments_) {
  try {
    return wrapToPromise(function_(...arguments_));
  } catch (error) {
    return Promise.reject(error);
  }
}
function isPrimitive(value) {
  const type = typeof value;
  return value === null || type !== "object" && type !== "function";
}
function isPureObject(value) {
  const proto = Object.getPrototypeOf(value);
  return !proto || proto.isPrototypeOf(Object);
}
function stringify(value) {
  if (isPrimitive(value)) {
    return String(value);
  }
  if (isPureObject(value) || Array.isArray(value)) {
    return JSON.stringify(value);
  }
  if (typeof value.toJSON === "function") {
    return stringify(value.toJSON());
  }
  throw new Error("[unstorage] Cannot stringify value!");
}
const BASE64_PREFIX = "base64:";
function serializeRaw(value) {
  if (typeof value === "string") {
    return value;
  }
  return BASE64_PREFIX + base64Encode(value);
}
function deserializeRaw(value) {
  if (typeof value !== "string") {
    return value;
  }
  if (!value.startsWith(BASE64_PREFIX)) {
    return value;
  }
  return base64Decode(value.slice(BASE64_PREFIX.length));
}
function base64Decode(input) {
  if (globalThis.Buffer) {
    return Buffer.from(input, "base64");
  }
  return Uint8Array.from(
    globalThis.atob(input),
    (c) => c.codePointAt(0)
  );
}
function base64Encode(input) {
  if (globalThis.Buffer) {
    return Buffer.from(input).toString("base64");
  }
  return globalThis.btoa(String.fromCodePoint(...input));
}

const storageKeyProperties = [
  "has",
  "hasItem",
  "get",
  "getItem",
  "getItemRaw",
  "set",
  "setItem",
  "setItemRaw",
  "del",
  "remove",
  "removeItem",
  "getMeta",
  "setMeta",
  "removeMeta",
  "getKeys",
  "clear",
  "mount",
  "unmount"
];
function prefixStorage(storage, base) {
  base = normalizeBaseKey(base);
  if (!base) {
    return storage;
  }
  const nsStorage = { ...storage };
  for (const property of storageKeyProperties) {
    nsStorage[property] = (key = "", ...args) => (
      // @ts-ignore
      storage[property](base + key, ...args)
    );
  }
  nsStorage.getKeys = (key = "", ...arguments_) => storage.getKeys(base + key, ...arguments_).then((keys) => keys.map((key2) => key2.slice(base.length)));
  nsStorage.keys = nsStorage.getKeys;
  nsStorage.getItems = async (items, commonOptions) => {
    const prefixedItems = items.map(
      (item) => typeof item === "string" ? base + item : { ...item, key: base + item.key }
    );
    const results = await storage.getItems(prefixedItems, commonOptions);
    return results.map((entry) => ({
      key: entry.key.slice(base.length),
      value: entry.value
    }));
  };
  nsStorage.setItems = async (items, commonOptions) => {
    const prefixedItems = items.map((item) => ({
      key: base + item.key,
      value: item.value,
      options: item.options
    }));
    return storage.setItems(prefixedItems, commonOptions);
  };
  return nsStorage;
}
function normalizeKey$1(key) {
  if (!key) {
    return "";
  }
  return key.split("?")[0]?.replace(/[/\\]/g, ":").replace(/:+/g, ":").replace(/^:|:$/g, "") || "";
}
function joinKeys(...keys) {
  return normalizeKey$1(keys.join(":"));
}
function normalizeBaseKey(base) {
  base = normalizeKey$1(base);
  return base ? base + ":" : "";
}
function filterKeyByDepth(key, depth) {
  if (depth === void 0) {
    return true;
  }
  let substrCount = 0;
  let index = key.indexOf(":");
  while (index > -1) {
    substrCount++;
    index = key.indexOf(":", index + 1);
  }
  return substrCount <= depth;
}
function filterKeyByBase(key, base) {
  if (base) {
    return key.startsWith(base) && key[key.length - 1] !== "$";
  }
  return key[key.length - 1] !== "$";
}

function defineDriver$1(factory) {
  return factory;
}

const DRIVER_NAME$1 = "memory";
const memory = defineDriver$1(() => {
  const data = /* @__PURE__ */ new Map();
  return {
    name: DRIVER_NAME$1,
    getInstance: () => data,
    hasItem(key) {
      return data.has(key);
    },
    getItem(key) {
      return data.get(key) ?? null;
    },
    getItemRaw(key) {
      return data.get(key) ?? null;
    },
    setItem(key, value) {
      data.set(key, value);
    },
    setItemRaw(key, value) {
      data.set(key, value);
    },
    removeItem(key) {
      data.delete(key);
    },
    getKeys() {
      return [...data.keys()];
    },
    clear() {
      data.clear();
    },
    dispose() {
      data.clear();
    }
  };
});

function createStorage(options = {}) {
  const context = {
    mounts: { "": options.driver || memory() },
    mountpoints: [""],
    watching: false,
    watchListeners: [],
    unwatch: {}
  };
  const getMount = (key) => {
    for (const base of context.mountpoints) {
      if (key.startsWith(base)) {
        return {
          base,
          relativeKey: key.slice(base.length),
          driver: context.mounts[base]
        };
      }
    }
    return {
      base: "",
      relativeKey: key,
      driver: context.mounts[""]
    };
  };
  const getMounts = (base, includeParent) => {
    return context.mountpoints.filter(
      (mountpoint) => mountpoint.startsWith(base) || includeParent && base.startsWith(mountpoint)
    ).map((mountpoint) => ({
      relativeBase: base.length > mountpoint.length ? base.slice(mountpoint.length) : void 0,
      mountpoint,
      driver: context.mounts[mountpoint]
    }));
  };
  const onChange = (event, key) => {
    if (!context.watching) {
      return;
    }
    key = normalizeKey$1(key);
    for (const listener of context.watchListeners) {
      listener(event, key);
    }
  };
  const startWatch = async () => {
    if (context.watching) {
      return;
    }
    context.watching = true;
    for (const mountpoint in context.mounts) {
      context.unwatch[mountpoint] = await watch(
        context.mounts[mountpoint],
        onChange,
        mountpoint
      );
    }
  };
  const stopWatch = async () => {
    if (!context.watching) {
      return;
    }
    for (const mountpoint in context.unwatch) {
      await context.unwatch[mountpoint]();
    }
    context.unwatch = {};
    context.watching = false;
  };
  const runBatch = (items, commonOptions, cb) => {
    const batches = /* @__PURE__ */ new Map();
    const getBatch = (mount) => {
      let batch = batches.get(mount.base);
      if (!batch) {
        batch = {
          driver: mount.driver,
          base: mount.base,
          items: []
        };
        batches.set(mount.base, batch);
      }
      return batch;
    };
    for (const item of items) {
      const isStringItem = typeof item === "string";
      const key = normalizeKey$1(isStringItem ? item : item.key);
      const value = isStringItem ? void 0 : item.value;
      const options2 = isStringItem || !item.options ? commonOptions : { ...commonOptions, ...item.options };
      const mount = getMount(key);
      getBatch(mount).items.push({
        key,
        value,
        relativeKey: mount.relativeKey,
        options: options2
      });
    }
    return Promise.all([...batches.values()].map((batch) => cb(batch))).then(
      (r) => r.flat()
    );
  };
  const storage = {
    // Item
    hasItem(key, opts = {}) {
      key = normalizeKey$1(key);
      const { relativeKey, driver } = getMount(key);
      return asyncCall(driver.hasItem, relativeKey, opts);
    },
    getItem(key, opts = {}) {
      key = normalizeKey$1(key);
      const { relativeKey, driver } = getMount(key);
      return asyncCall(driver.getItem, relativeKey, opts).then(
        (value) => destr(value)
      );
    },
    getItems(items, commonOptions = {}) {
      return runBatch(items, commonOptions, (batch) => {
        if (batch.driver.getItems) {
          return asyncCall(
            batch.driver.getItems,
            batch.items.map((item) => ({
              key: item.relativeKey,
              options: item.options
            })),
            commonOptions
          ).then(
            (r) => r.map((item) => ({
              key: joinKeys(batch.base, item.key),
              value: destr(item.value)
            }))
          );
        }
        return Promise.all(
          batch.items.map((item) => {
            return asyncCall(
              batch.driver.getItem,
              item.relativeKey,
              item.options
            ).then((value) => ({
              key: item.key,
              value: destr(value)
            }));
          })
        );
      });
    },
    getItemRaw(key, opts = {}) {
      key = normalizeKey$1(key);
      const { relativeKey, driver } = getMount(key);
      if (driver.getItemRaw) {
        return asyncCall(driver.getItemRaw, relativeKey, opts);
      }
      return asyncCall(driver.getItem, relativeKey, opts).then(
        (value) => deserializeRaw(value)
      );
    },
    async setItem(key, value, opts = {}) {
      if (value === void 0) {
        return storage.removeItem(key);
      }
      key = normalizeKey$1(key);
      const { relativeKey, driver } = getMount(key);
      if (!driver.setItem) {
        return;
      }
      await asyncCall(driver.setItem, relativeKey, stringify(value), opts);
      if (!driver.watch) {
        onChange("update", key);
      }
    },
    async setItems(items, commonOptions) {
      await runBatch(items, commonOptions, async (batch) => {
        if (batch.driver.setItems) {
          return asyncCall(
            batch.driver.setItems,
            batch.items.map((item) => ({
              key: item.relativeKey,
              value: stringify(item.value),
              options: item.options
            })),
            commonOptions
          );
        }
        if (!batch.driver.setItem) {
          return;
        }
        await Promise.all(
          batch.items.map((item) => {
            return asyncCall(
              batch.driver.setItem,
              item.relativeKey,
              stringify(item.value),
              item.options
            );
          })
        );
      });
    },
    async setItemRaw(key, value, opts = {}) {
      if (value === void 0) {
        return storage.removeItem(key, opts);
      }
      key = normalizeKey$1(key);
      const { relativeKey, driver } = getMount(key);
      if (driver.setItemRaw) {
        await asyncCall(driver.setItemRaw, relativeKey, value, opts);
      } else if (driver.setItem) {
        await asyncCall(driver.setItem, relativeKey, serializeRaw(value), opts);
      } else {
        return;
      }
      if (!driver.watch) {
        onChange("update", key);
      }
    },
    async removeItem(key, opts = {}) {
      if (typeof opts === "boolean") {
        opts = { removeMeta: opts };
      }
      key = normalizeKey$1(key);
      const { relativeKey, driver } = getMount(key);
      if (!driver.removeItem) {
        return;
      }
      await asyncCall(driver.removeItem, relativeKey, opts);
      if (opts.removeMeta || opts.removeMata) {
        await asyncCall(driver.removeItem, relativeKey + "$", opts);
      }
      if (!driver.watch) {
        onChange("remove", key);
      }
    },
    // Meta
    async getMeta(key, opts = {}) {
      if (typeof opts === "boolean") {
        opts = { nativeOnly: opts };
      }
      key = normalizeKey$1(key);
      const { relativeKey, driver } = getMount(key);
      const meta = /* @__PURE__ */ Object.create(null);
      if (driver.getMeta) {
        Object.assign(meta, await asyncCall(driver.getMeta, relativeKey, opts));
      }
      if (!opts.nativeOnly) {
        const value = await asyncCall(
          driver.getItem,
          relativeKey + "$",
          opts
        ).then((value_) => destr(value_));
        if (value && typeof value === "object") {
          if (typeof value.atime === "string") {
            value.atime = new Date(value.atime);
          }
          if (typeof value.mtime === "string") {
            value.mtime = new Date(value.mtime);
          }
          Object.assign(meta, value);
        }
      }
      return meta;
    },
    setMeta(key, value, opts = {}) {
      return this.setItem(key + "$", value, opts);
    },
    removeMeta(key, opts = {}) {
      return this.removeItem(key + "$", opts);
    },
    // Keys
    async getKeys(base, opts = {}) {
      base = normalizeBaseKey(base);
      const mounts = getMounts(base, true);
      let maskedMounts = [];
      const allKeys = [];
      let allMountsSupportMaxDepth = true;
      for (const mount of mounts) {
        if (!mount.driver.flags?.maxDepth) {
          allMountsSupportMaxDepth = false;
        }
        const rawKeys = await asyncCall(
          mount.driver.getKeys,
          mount.relativeBase,
          opts
        );
        for (const key of rawKeys) {
          const fullKey = mount.mountpoint + normalizeKey$1(key);
          if (!maskedMounts.some((p) => fullKey.startsWith(p))) {
            allKeys.push(fullKey);
          }
        }
        maskedMounts = [
          mount.mountpoint,
          ...maskedMounts.filter((p) => !p.startsWith(mount.mountpoint))
        ];
      }
      const shouldFilterByDepth = opts.maxDepth !== void 0 && !allMountsSupportMaxDepth;
      return allKeys.filter(
        (key) => (!shouldFilterByDepth || filterKeyByDepth(key, opts.maxDepth)) && filterKeyByBase(key, base)
      );
    },
    // Utils
    async clear(base, opts = {}) {
      base = normalizeBaseKey(base);
      await Promise.all(
        getMounts(base, false).map(async (m) => {
          if (m.driver.clear) {
            return asyncCall(m.driver.clear, m.relativeBase, opts);
          }
          if (m.driver.removeItem) {
            const keys = await m.driver.getKeys(m.relativeBase || "", opts);
            return Promise.all(
              keys.map((key) => m.driver.removeItem(key, opts))
            );
          }
        })
      );
    },
    async dispose() {
      await Promise.all(
        Object.values(context.mounts).map((driver) => dispose(driver))
      );
    },
    async watch(callback) {
      await startWatch();
      context.watchListeners.push(callback);
      return async () => {
        context.watchListeners = context.watchListeners.filter(
          (listener) => listener !== callback
        );
        if (context.watchListeners.length === 0) {
          await stopWatch();
        }
      };
    },
    async unwatch() {
      context.watchListeners = [];
      await stopWatch();
    },
    // Mount
    mount(base, driver) {
      base = normalizeBaseKey(base);
      if (base && context.mounts[base]) {
        throw new Error(`already mounted at ${base}`);
      }
      if (base) {
        context.mountpoints.push(base);
        context.mountpoints.sort((a, b) => b.length - a.length);
      }
      context.mounts[base] = driver;
      if (context.watching) {
        Promise.resolve(watch(driver, onChange, base)).then((unwatcher) => {
          context.unwatch[base] = unwatcher;
        }).catch(console.error);
      }
      return storage;
    },
    async unmount(base, _dispose = true) {
      base = normalizeBaseKey(base);
      if (!base || !context.mounts[base]) {
        return;
      }
      if (context.watching && base in context.unwatch) {
        context.unwatch[base]?.();
        delete context.unwatch[base];
      }
      if (_dispose) {
        await dispose(context.mounts[base]);
      }
      context.mountpoints = context.mountpoints.filter((key) => key !== base);
      delete context.mounts[base];
    },
    getMount(key = "") {
      key = normalizeKey$1(key) + ":";
      const m = getMount(key);
      return {
        driver: m.driver,
        base: m.base
      };
    },
    getMounts(base = "", opts = {}) {
      base = normalizeKey$1(base);
      const mounts = getMounts(base, opts.parents);
      return mounts.map((m) => ({
        driver: m.driver,
        base: m.mountpoint
      }));
    },
    // Aliases
    keys: (base, opts = {}) => storage.getKeys(base, opts),
    get: (key, opts = {}) => storage.getItem(key, opts),
    set: (key, value, opts = {}) => storage.setItem(key, value, opts),
    has: (key, opts = {}) => storage.hasItem(key, opts),
    del: (key, opts = {}) => storage.removeItem(key, opts),
    remove: (key, opts = {}) => storage.removeItem(key, opts)
  };
  return storage;
}
function watch(driver, onChange, base) {
  return driver.watch ? driver.watch((event, key) => onChange(event, base + key)) : () => {
  };
}
async function dispose(driver) {
  if (typeof driver.dispose === "function") {
    await asyncCall(driver.dispose);
  }
}

const _assets = {

};

const normalizeKey = function normalizeKey(key) {
  if (!key) {
    return "";
  }
  return key.split("?")[0]?.replace(/[/\\]/g, ":").replace(/:+/g, ":").replace(/^:|:$/g, "") || "";
};

const assets$1 = {
  getKeys() {
    return Promise.resolve(Object.keys(_assets))
  },
  hasItem (id) {
    id = normalizeKey(id);
    return Promise.resolve(id in _assets)
  },
  getItem (id) {
    id = normalizeKey(id);
    return Promise.resolve(_assets[id] ? _assets[id].import() : null)
  },
  getMeta (id) {
    id = normalizeKey(id);
    return Promise.resolve(_assets[id] ? _assets[id].meta : {})
  }
};

function defineDriver(factory) {
  return factory;
}
function createError(driver, message, opts) {
  const err = new Error(`[unstorage] [${driver}] ${message}`, opts);
  if (Error.captureStackTrace) {
    Error.captureStackTrace(err, createError);
  }
  return err;
}
function createRequiredError(driver, name) {
  if (Array.isArray(name)) {
    return createError(
      driver,
      `Missing some of the required options ${name.map((n) => "`" + n + "`").join(", ")}`
    );
  }
  return createError(driver, `Missing required option \`${name}\`.`);
}

function ignoreNotfound(err) {
  return err.code === "ENOENT" || err.code === "EISDIR" ? null : err;
}
function ignoreExists(err) {
  return err.code === "EEXIST" ? null : err;
}
async function writeFile(path, data, encoding) {
  await ensuredir(dirname$1(path));
  return promises.writeFile(path, data, encoding);
}
function readFile(path, encoding) {
  return promises.readFile(path, encoding).catch(ignoreNotfound);
}
function unlink(path) {
  return promises.unlink(path).catch(ignoreNotfound);
}
function readdir(dir) {
  return promises.readdir(dir, { withFileTypes: true }).catch(ignoreNotfound).then((r) => r || []);
}
async function ensuredir(dir) {
  if (existsSync(dir)) {
    return;
  }
  await ensuredir(dirname$1(dir)).catch(ignoreExists);
  await promises.mkdir(dir).catch(ignoreExists);
}
async function readdirRecursive(dir, ignore, maxDepth) {
  if (ignore && ignore(dir)) {
    return [];
  }
  const entries = await readdir(dir);
  const files = [];
  await Promise.all(
    entries.map(async (entry) => {
      const entryPath = resolve$1(dir, entry.name);
      if (entry.isDirectory()) {
        if (maxDepth === void 0 || maxDepth > 0) {
          const dirFiles = await readdirRecursive(
            entryPath,
            ignore,
            maxDepth === void 0 ? void 0 : maxDepth - 1
          );
          files.push(...dirFiles.map((f) => entry.name + "/" + f));
        }
      } else {
        if (!(ignore && ignore(entry.name))) {
          files.push(entry.name);
        }
      }
    })
  );
  return files;
}
async function rmRecursive(dir) {
  const entries = await readdir(dir);
  await Promise.all(
    entries.map((entry) => {
      const entryPath = resolve$1(dir, entry.name);
      if (entry.isDirectory()) {
        return rmRecursive(entryPath).then(() => promises.rmdir(entryPath));
      } else {
        return promises.unlink(entryPath);
      }
    })
  );
}

const PATH_TRAVERSE_RE = /\.\.:|\.\.$/;
const DRIVER_NAME = "fs-lite";
const unstorage_47drivers_47fs_45lite = defineDriver((opts = {}) => {
  if (!opts.base) {
    throw createRequiredError(DRIVER_NAME, "base");
  }
  opts.base = resolve$1(opts.base);
  const r = (key) => {
    if (PATH_TRAVERSE_RE.test(key)) {
      throw createError(
        DRIVER_NAME,
        `Invalid key: ${JSON.stringify(key)}. It should not contain .. segments`
      );
    }
    const resolved = join(opts.base, key.replace(/:/g, "/"));
    return resolved;
  };
  return {
    name: DRIVER_NAME,
    options: opts,
    flags: {
      maxDepth: true
    },
    hasItem(key) {
      return existsSync(r(key));
    },
    getItem(key) {
      return readFile(r(key), "utf8");
    },
    getItemRaw(key) {
      return readFile(r(key));
    },
    async getMeta(key) {
      const { atime, mtime, size, birthtime, ctime } = await promises.stat(r(key)).catch(() => ({}));
      return { atime, mtime, size, birthtime, ctime };
    },
    setItem(key, value) {
      if (opts.readOnly) {
        return;
      }
      return writeFile(r(key), value, "utf8");
    },
    setItemRaw(key, value) {
      if (opts.readOnly) {
        return;
      }
      return writeFile(r(key), value);
    },
    removeItem(key) {
      if (opts.readOnly) {
        return;
      }
      return unlink(r(key));
    },
    getKeys(_base, topts) {
      return readdirRecursive(r("."), opts.ignore, topts?.maxDepth);
    },
    async clear() {
      if (opts.readOnly || opts.noClear) {
        return;
      }
      await rmRecursive(r("."));
    }
  };
});

const storage = createStorage({});

storage.mount('/assets', assets$1);

storage.mount('data', unstorage_47drivers_47fs_45lite({"driver":"fsLite","base":"./.data/kv"}));

function useStorage(base = "") {
  return base ? prefixStorage(storage, base) : storage;
}

function serialize$1(o){return typeof o=="string"?`'${o}'`:new c().serialize(o)}const c=/*@__PURE__*/function(){class o{#t=new Map;compare(t,r){const e=typeof t,n=typeof r;return e==="string"&&n==="string"?t.localeCompare(r):e==="number"&&n==="number"?t-r:String.prototype.localeCompare.call(this.serialize(t,true),this.serialize(r,true))}serialize(t,r){if(t===null)return "null";switch(typeof t){case "string":return r?t:`'${t}'`;case "bigint":return `${t}n`;case "object":return this.$object(t);case "function":return this.$function(t)}return String(t)}serializeObject(t){const r=Object.prototype.toString.call(t);if(r!=="[object Object]")return this.serializeBuiltInType(r.length<10?`unknown:${r}`:r.slice(8,-1),t);const e=t.constructor,n=e===Object||e===void 0?"":e.name;if(n!==""&&globalThis[n]===e)return this.serializeBuiltInType(n,t);if(typeof t.toJSON=="function"){const i=t.toJSON();return n+(i!==null&&typeof i=="object"?this.$object(i):`(${this.serialize(i)})`)}return this.serializeObjectEntries(n,Object.entries(t))}serializeBuiltInType(t,r){const e=this["$"+t];if(e)return e.call(this,r);if(typeof r?.entries=="function")return this.serializeObjectEntries(t,r.entries());throw new Error(`Cannot serialize ${t}`)}serializeObjectEntries(t,r){const e=Array.from(r).sort((i,a)=>this.compare(i[0],a[0]));let n=`${t}{`;for(let i=0;i<e.length;i++){const[a,l]=e[i];n+=`${this.serialize(a,true)}:${this.serialize(l)}`,i<e.length-1&&(n+=",");}return n+"}"}$object(t){let r=this.#t.get(t);return r===void 0&&(this.#t.set(t,`#${this.#t.size}`),r=this.serializeObject(t),this.#t.set(t,r)),r}$function(t){const r=Function.prototype.toString.call(t);return r.slice(-15)==="[native code] }"?`${t.name||""}()[native]`:`${t.name}(${t.length})${r.replace(/\s*\n\s*/g,"")}`}$Array(t){let r="[";for(let e=0;e<t.length;e++)r+=this.serialize(t[e]),e<t.length-1&&(r+=",");return r+"]"}$Date(t){try{return `Date(${t.toISOString()})`}catch{return "Date(null)"}}$ArrayBuffer(t){return `ArrayBuffer[${new Uint8Array(t).join(",")}]`}$Set(t){return `Set${this.$Array(Array.from(t).sort((r,e)=>this.compare(r,e)))}`}$Map(t){return this.serializeObjectEntries("Map",t.entries())}}for(const s of ["Error","RegExp","URL"])o.prototype["$"+s]=function(t){return `${s}(${t})`};for(const s of ["Int8Array","Uint8Array","Uint8ClampedArray","Int16Array","Uint16Array","Int32Array","Uint32Array","Float32Array","Float64Array"])o.prototype["$"+s]=function(t){return `${s}[${t.join(",")}]`};for(const s of ["BigInt64Array","BigUint64Array"])o.prototype["$"+s]=function(t){return `${s}[${t.join("n,")}${t.length>0?"n":""}]`};return o}();

const e=globalThis.process?.getBuiltinModule?.("crypto")?.hash,r="sha256",s="base64url";function digest(t){if(e)return e(r,t,s);const o=createHash(r).update(t);return globalThis.process?.versions?.webcontainer?o.digest().toString(s):o.digest(s)}

function hash$1(input) {
  return digest(serialize$1(input));
}

const Hasher = /* @__PURE__ */ (() => {
  class Hasher2 {
    buff = "";
    #context = /* @__PURE__ */ new Map();
    write(str) {
      this.buff += str;
    }
    dispatch(value) {
      const type = value === null ? "null" : typeof value;
      return this[type](value);
    }
    object(object) {
      if (object && typeof object.toJSON === "function") {
        return this.object(object.toJSON());
      }
      const objString = Object.prototype.toString.call(object);
      let objType = "";
      const objectLength = objString.length;
      objType = objectLength < 10 ? "unknown:[" + objString + "]" : objString.slice(8, objectLength - 1);
      objType = objType.toLowerCase();
      let objectNumber = null;
      if ((objectNumber = this.#context.get(object)) === void 0) {
        this.#context.set(object, this.#context.size);
      } else {
        return this.dispatch("[CIRCULAR:" + objectNumber + "]");
      }
      if (typeof Buffer !== "undefined" && Buffer.isBuffer && Buffer.isBuffer(object)) {
        this.write("buffer:");
        return this.write(object.toString("utf8"));
      }
      if (objType !== "object" && objType !== "function" && objType !== "asyncfunction") {
        if (this[objType]) {
          this[objType](object);
        } else {
          this.unknown(object, objType);
        }
      } else {
        const keys = Object.keys(object).sort();
        const extraKeys = [];
        this.write("object:" + (keys.length + extraKeys.length) + ":");
        const dispatchForKey = (key) => {
          this.dispatch(key);
          this.write(":");
          this.dispatch(object[key]);
          this.write(",");
        };
        for (const key of keys) {
          dispatchForKey(key);
        }
        for (const key of extraKeys) {
          dispatchForKey(key);
        }
      }
    }
    array(arr, unordered) {
      unordered = unordered === void 0 ? false : unordered;
      this.write("array:" + arr.length + ":");
      if (!unordered || arr.length <= 1) {
        for (const entry of arr) {
          this.dispatch(entry);
        }
        return;
      }
      const contextAdditions = /* @__PURE__ */ new Map();
      const entries = arr.map((entry) => {
        const hasher = new Hasher2();
        hasher.dispatch(entry);
        for (const [key, value] of hasher.#context) {
          contextAdditions.set(key, value);
        }
        return hasher.toString();
      });
      this.#context = contextAdditions;
      entries.sort();
      return this.array(entries, false);
    }
    date(date) {
      return this.write("date:" + date.toJSON());
    }
    symbol(sym) {
      return this.write("symbol:" + sym.toString());
    }
    unknown(value, type) {
      this.write(type);
      if (!value) {
        return;
      }
      this.write(":");
      if (value && typeof value.entries === "function") {
        return this.array(
          [...value.entries()],
          true
          /* ordered */
        );
      }
    }
    error(err) {
      return this.write("error:" + err.toString());
    }
    boolean(bool) {
      return this.write("bool:" + bool);
    }
    string(string) {
      this.write("string:" + string.length + ":");
      this.write(string);
    }
    function(fn) {
      this.write("fn:");
      if (isNativeFunction(fn)) {
        this.dispatch("[native]");
      } else {
        this.dispatch(fn.toString());
      }
    }
    number(number) {
      return this.write("number:" + number);
    }
    null() {
      return this.write("Null");
    }
    undefined() {
      return this.write("Undefined");
    }
    regexp(regex) {
      return this.write("regex:" + regex.toString());
    }
    arraybuffer(arr) {
      this.write("arraybuffer:");
      return this.dispatch(new Uint8Array(arr));
    }
    url(url) {
      return this.write("url:" + url.toString());
    }
    map(map) {
      this.write("map:");
      const arr = [...map];
      return this.array(arr, false);
    }
    set(set) {
      this.write("set:");
      const arr = [...set];
      return this.array(arr, false);
    }
    bigint(number) {
      return this.write("bigint:" + number.toString());
    }
  }
  for (const type of [
    "uint8array",
    "uint8clampedarray",
    "unt8array",
    "uint16array",
    "unt16array",
    "uint32array",
    "unt32array",
    "float32array",
    "float64array"
  ]) {
    Hasher2.prototype[type] = function(arr) {
      this.write(type + ":");
      return this.array([...arr], false);
    };
  }
  function isNativeFunction(f) {
    if (typeof f !== "function") {
      return false;
    }
    return Function.prototype.toString.call(f).slice(
      -15
      /* "[native code] }".length */
    ) === "[native code] }";
  }
  return Hasher2;
})();
function serialize(object) {
  const hasher = new Hasher();
  hasher.dispatch(object);
  return hasher.buff;
}
function hash(value) {
  return digest(typeof value === "string" ? value : serialize(value)).replace(/[-_]/g, "").slice(0, 10);
}

function defaultCacheOptions() {
  return {
    name: "_",
    base: "/cache",
    swr: true,
    maxAge: 1
  };
}
function defineCachedFunction(fn, opts = {}) {
  opts = { ...defaultCacheOptions(), ...opts };
  const pending = {};
  const group = opts.group || "nitro/functions";
  const name = opts.name || fn.name || "_";
  const integrity = opts.integrity || hash([fn, opts]);
  const validate = opts.validate || ((entry) => entry.value !== void 0);
  async function get(key, resolver, shouldInvalidateCache, event) {
    const cacheKey = [opts.base, group, name, key + ".json"].filter(Boolean).join(":").replace(/:\/$/, ":index");
    let entry = await useStorage().getItem(cacheKey).catch((error) => {
      console.error(`[cache] Cache read error.`, error);
      useNitroApp().captureError(error, { event, tags: ["cache"] });
    }) || {};
    if (typeof entry !== "object") {
      entry = {};
      const error = new Error("Malformed data read from cache.");
      console.error("[cache]", error);
      useNitroApp().captureError(error, { event, tags: ["cache"] });
    }
    const ttl = (opts.maxAge ?? 0) * 1e3;
    if (ttl) {
      entry.expires = Date.now() + ttl;
    }
    const expired = shouldInvalidateCache || entry.integrity !== integrity || ttl && Date.now() - (entry.mtime || 0) > ttl || validate(entry) === false;
    const _resolve = async () => {
      const isPending = pending[key];
      if (!isPending) {
        if (entry.value !== void 0 && (opts.staleMaxAge || 0) >= 0 && opts.swr === false) {
          entry.value = void 0;
          entry.integrity = void 0;
          entry.mtime = void 0;
          entry.expires = void 0;
        }
        pending[key] = Promise.resolve(resolver());
      }
      try {
        entry.value = await pending[key];
      } catch (error) {
        if (!isPending) {
          delete pending[key];
        }
        throw error;
      }
      if (!isPending) {
        entry.mtime = Date.now();
        entry.integrity = integrity;
        delete pending[key];
        if (validate(entry) !== false) {
          let setOpts;
          if (opts.maxAge && !opts.swr) {
            setOpts = { ttl: opts.maxAge };
          }
          const promise = useStorage().setItem(cacheKey, entry, setOpts).catch((error) => {
            console.error(`[cache] Cache write error.`, error);
            useNitroApp().captureError(error, { event, tags: ["cache"] });
          });
          if (event?.waitUntil) {
            event.waitUntil(promise);
          }
        }
      }
    };
    const _resolvePromise = expired ? _resolve() : Promise.resolve();
    if (entry.value === void 0) {
      await _resolvePromise;
    } else if (expired && event && event.waitUntil) {
      event.waitUntil(_resolvePromise);
    }
    if (opts.swr && validate(entry) !== false) {
      _resolvePromise.catch((error) => {
        console.error(`[cache] SWR handler error.`, error);
        useNitroApp().captureError(error, { event, tags: ["cache"] });
      });
      return entry;
    }
    return _resolvePromise.then(() => entry);
  }
  return async (...args) => {
    const shouldBypassCache = await opts.shouldBypassCache?.(...args);
    if (shouldBypassCache) {
      return fn(...args);
    }
    const key = await (opts.getKey || getKey)(...args);
    const shouldInvalidateCache = await opts.shouldInvalidateCache?.(...args);
    const entry = await get(
      key,
      () => fn(...args),
      shouldInvalidateCache,
      args[0] && isEvent(args[0]) ? args[0] : void 0
    );
    let value = entry.value;
    if (opts.transform) {
      value = await opts.transform(entry, ...args) || value;
    }
    return value;
  };
}
function cachedFunction(fn, opts = {}) {
  return defineCachedFunction(fn, opts);
}
function getKey(...args) {
  return args.length > 0 ? hash(args) : "";
}
function escapeKey(key) {
  return String(key).replace(/\W/g, "");
}
function defineCachedEventHandler(handler, opts = defaultCacheOptions()) {
  const variableHeaderNames = (opts.varies || []).filter(Boolean).map((h) => h.toLowerCase()).sort();
  const _opts = {
    ...opts,
    getKey: async (event) => {
      const customKey = await opts.getKey?.(event);
      if (customKey) {
        return escapeKey(customKey);
      }
      const _path = event.node.req.originalUrl || event.node.req.url || event.path;
      let _pathname;
      try {
        _pathname = escapeKey(decodeURI(parseURL(_path).pathname)).slice(0, 16) || "index";
      } catch {
        _pathname = "-";
      }
      const _hashedPath = `${_pathname}.${hash(_path)}`;
      const _headers = variableHeaderNames.map((header) => [header, event.node.req.headers[header]]).map(([name, value]) => `${escapeKey(name)}.${hash(value)}`);
      return [_hashedPath, ..._headers].join(":");
    },
    validate: (entry) => {
      if (!entry.value) {
        return false;
      }
      if (entry.value.code >= 400) {
        return false;
      }
      if (entry.value.body === void 0) {
        return false;
      }
      if (entry.value.headers.etag === "undefined" || entry.value.headers["last-modified"] === "undefined") {
        return false;
      }
      return true;
    },
    group: opts.group || "nitro/handlers",
    integrity: opts.integrity || hash([handler, opts])
  };
  const _cachedHandler = cachedFunction(
    async (incomingEvent) => {
      const variableHeaders = {};
      for (const header of variableHeaderNames) {
        const value = incomingEvent.node.req.headers[header];
        if (value !== void 0) {
          variableHeaders[header] = value;
        }
      }
      const reqProxy = cloneWithProxy(incomingEvent.node.req, {
        headers: variableHeaders
      });
      const resHeaders = {};
      let _resSendBody;
      const resProxy = cloneWithProxy(incomingEvent.node.res, {
        statusCode: 200,
        writableEnded: false,
        writableFinished: false,
        headersSent: false,
        closed: false,
        getHeader(name) {
          return resHeaders[name];
        },
        setHeader(name, value) {
          resHeaders[name] = value;
          return this;
        },
        getHeaderNames() {
          return Object.keys(resHeaders);
        },
        hasHeader(name) {
          return name in resHeaders;
        },
        removeHeader(name) {
          delete resHeaders[name];
        },
        getHeaders() {
          return resHeaders;
        },
        end(chunk, arg2, arg3) {
          if (typeof chunk === "string") {
            _resSendBody = chunk;
          }
          if (typeof arg2 === "function") {
            arg2();
          }
          if (typeof arg3 === "function") {
            arg3();
          }
          return this;
        },
        write(chunk, arg2, arg3) {
          if (typeof chunk === "string") {
            _resSendBody = chunk;
          }
          if (typeof arg2 === "function") {
            arg2(void 0);
          }
          if (typeof arg3 === "function") {
            arg3();
          }
          return true;
        },
        writeHead(statusCode, headers2) {
          this.statusCode = statusCode;
          if (headers2) {
            if (Array.isArray(headers2) || typeof headers2 === "string") {
              throw new TypeError("Raw headers  is not supported.");
            }
            for (const header in headers2) {
              const value = headers2[header];
              if (value !== void 0) {
                this.setHeader(
                  header,
                  value
                );
              }
            }
          }
          return this;
        }
      });
      const event = createEvent(reqProxy, resProxy);
      event.fetch = (url, fetchOptions) => fetchWithEvent(event, url, fetchOptions, {
        fetch: useNitroApp().localFetch
      });
      event.$fetch = (url, fetchOptions) => fetchWithEvent(event, url, fetchOptions, {
        fetch: globalThis.$fetch
      });
      event.waitUntil = incomingEvent.waitUntil;
      event.context = incomingEvent.context;
      event.context.cache = {
        options: _opts
      };
      const body = await handler(event) || _resSendBody;
      const headers = event.node.res.getHeaders();
      headers.etag = String(
        headers.Etag || headers.etag || `W/"${hash(body)}"`
      );
      headers["last-modified"] = String(
        headers["Last-Modified"] || headers["last-modified"] || (/* @__PURE__ */ new Date()).toUTCString()
      );
      const cacheControl = [];
      if (opts.swr) {
        if (opts.maxAge) {
          cacheControl.push(`s-maxage=${opts.maxAge}`);
        }
        if (opts.staleMaxAge) {
          cacheControl.push(`stale-while-revalidate=${opts.staleMaxAge}`);
        } else {
          cacheControl.push("stale-while-revalidate");
        }
      } else if (opts.maxAge) {
        cacheControl.push(`max-age=${opts.maxAge}`);
      }
      if (cacheControl.length > 0) {
        headers["cache-control"] = cacheControl.join(", ");
      }
      const cacheEntry = {
        code: event.node.res.statusCode,
        headers,
        body
      };
      return cacheEntry;
    },
    _opts
  );
  return defineEventHandler(async (event) => {
    if (opts.headersOnly) {
      if (handleCacheHeaders(event, { maxAge: opts.maxAge })) {
        return;
      }
      return handler(event);
    }
    const response = await _cachedHandler(
      event
    );
    if (event.node.res.headersSent || event.node.res.writableEnded) {
      return response.body;
    }
    if (handleCacheHeaders(event, {
      modifiedTime: new Date(response.headers["last-modified"]),
      etag: response.headers.etag,
      maxAge: opts.maxAge
    })) {
      return;
    }
    event.node.res.statusCode = response.code;
    for (const name in response.headers) {
      const value = response.headers[name];
      if (name === "set-cookie") {
        event.node.res.appendHeader(
          name,
          splitCookiesString(value)
        );
      } else {
        if (value !== void 0) {
          event.node.res.setHeader(name, value);
        }
      }
    }
    return response.body;
  });
}
function cloneWithProxy(obj, overrides) {
  return new Proxy(obj, {
    get(target, property, receiver) {
      if (property in overrides) {
        return overrides[property];
      }
      return Reflect.get(target, property, receiver);
    },
    set(target, property, value, receiver) {
      if (property in overrides) {
        overrides[property] = value;
        return true;
      }
      return Reflect.set(target, property, value, receiver);
    }
  });
}
const cachedEventHandler = defineCachedEventHandler;

function klona(x) {
	if (typeof x !== 'object') return x;

	var k, tmp, str=Object.prototype.toString.call(x);

	if (str === '[object Object]') {
		if (x.constructor !== Object && typeof x.constructor === 'function') {
			tmp = new x.constructor();
			for (k in x) {
				if (x.hasOwnProperty(k) && tmp[k] !== x[k]) {
					tmp[k] = klona(x[k]);
				}
			}
		} else {
			tmp = {}; // null
			for (k in x) {
				if (k === '__proto__') {
					Object.defineProperty(tmp, k, {
						value: klona(x[k]),
						configurable: true,
						enumerable: true,
						writable: true,
					});
				} else {
					tmp[k] = klona(x[k]);
				}
			}
		}
		return tmp;
	}

	if (str === '[object Array]') {
		k = x.length;
		for (tmp=Array(k); k--;) {
			tmp[k] = klona(x[k]);
		}
		return tmp;
	}

	if (str === '[object Set]') {
		tmp = new Set;
		x.forEach(function (val) {
			tmp.add(klona(val));
		});
		return tmp;
	}

	if (str === '[object Map]') {
		tmp = new Map;
		x.forEach(function (val, key) {
			tmp.set(klona(key), klona(val));
		});
		return tmp;
	}

	if (str === '[object Date]') {
		return new Date(+x);
	}

	if (str === '[object RegExp]') {
		tmp = new RegExp(x.source, x.flags);
		tmp.lastIndex = x.lastIndex;
		return tmp;
	}

	if (str === '[object DataView]') {
		return new x.constructor( klona(x.buffer) );
	}

	if (str === '[object ArrayBuffer]') {
		return x.slice(0);
	}

	// ArrayBuffer.isView(x)
	// ~> `new` bcuz `Buffer.slice` => ref
	if (str.slice(-6) === 'Array]') {
		return new x.constructor(x);
	}

	return x;
}

const inlineAppConfig = {
  "nuxt": {}
};



const appConfig = defuFn(inlineAppConfig);

const NUMBER_CHAR_RE = /\d/;
const STR_SPLITTERS = ["-", "_", "/", "."];
function isUppercase(char = "") {
  if (NUMBER_CHAR_RE.test(char)) {
    return void 0;
  }
  return char !== char.toLowerCase();
}
function splitByCase(str, separators) {
  const splitters = STR_SPLITTERS;
  const parts = [];
  if (!str || typeof str !== "string") {
    return parts;
  }
  let buff = "";
  let previousUpper;
  let previousSplitter;
  for (const char of str) {
    const isSplitter = splitters.includes(char);
    if (isSplitter === true) {
      parts.push(buff);
      buff = "";
      previousUpper = void 0;
      continue;
    }
    const isUpper = isUppercase(char);
    if (previousSplitter === false) {
      if (previousUpper === false && isUpper === true) {
        parts.push(buff);
        buff = char;
        previousUpper = isUpper;
        continue;
      }
      if (previousUpper === true && isUpper === false && buff.length > 1) {
        const lastChar = buff.at(-1);
        parts.push(buff.slice(0, Math.max(0, buff.length - 1)));
        buff = lastChar + char;
        previousUpper = isUpper;
        continue;
      }
    }
    buff += char;
    previousUpper = isUpper;
    previousSplitter = isSplitter;
  }
  parts.push(buff);
  return parts;
}
function kebabCase(str, joiner) {
  return str ? (Array.isArray(str) ? str : splitByCase(str)).map((p) => p.toLowerCase()).join(joiner) : "";
}
function snakeCase(str) {
  return kebabCase(str || "", "_");
}

function getEnv(key, opts) {
  const envKey = snakeCase(key).toUpperCase();
  return destr(
    process.env[opts.prefix + envKey] ?? process.env[opts.altPrefix + envKey]
  );
}
function _isObject(input) {
  return typeof input === "object" && !Array.isArray(input);
}
function applyEnv(obj, opts, parentKey = "") {
  for (const key in obj) {
    const subKey = parentKey ? `${parentKey}_${key}` : key;
    const envValue = getEnv(subKey, opts);
    if (_isObject(obj[key])) {
      if (_isObject(envValue)) {
        obj[key] = { ...obj[key], ...envValue };
        applyEnv(obj[key], opts, subKey);
      } else if (envValue === void 0) {
        applyEnv(obj[key], opts, subKey);
      } else {
        obj[key] = envValue ?? obj[key];
      }
    } else {
      obj[key] = envValue ?? obj[key];
    }
    if (opts.envExpansion && typeof obj[key] === "string") {
      obj[key] = _expandFromEnv(obj[key]);
    }
  }
  return obj;
}
const envExpandRx = /\{\{([^{}]*)\}\}/g;
function _expandFromEnv(value) {
  return value.replace(envExpandRx, (match, key) => {
    return process.env[key] || match;
  });
}

const _inlineRuntimeConfig = {
  "app": {
    "baseURL": "/",
    "buildId": "ef64b3d4-71b1-419b-867b-13f1dd42a9e1",
    "buildAssetsDir": "/_nuxt/",
    "cdnURL": ""
  },
  "nitro": {
    "envPrefix": "NUXT_",
    "routeRules": {
      "/__nuxt_error": {
        "cache": false
      },
      "/docs/**": {
        "prerender": true
      },
      "/_nuxt/builds/meta/**": {
        "headers": {
          "cache-control": "public, max-age=31536000, immutable"
        }
      },
      "/_nuxt/builds/**": {
        "headers": {
          "cache-control": "public, max-age=1, immutable"
        }
      },
      "/_nuxt/**": {
        "headers": {
          "cache-control": "public, max-age=31536000, immutable"
        }
      }
    }
  },
  "public": {
    "siteUrl": "http://localhost:3000",
    "domain": "localhost:3000",
    "siteName": "CommonPub",
    "siteDescription": "A CommonPub instance"
  },
  "databaseUrl": "",
  "authSecret": "dev-secret-change-me"
};
const envOptions = {
  prefix: "NITRO_",
  altPrefix: _inlineRuntimeConfig.nitro.envPrefix ?? process.env.NITRO_ENV_PREFIX ?? "_",
  envExpansion: _inlineRuntimeConfig.nitro.envExpansion ?? process.env.NITRO_ENV_EXPANSION ?? false
};
const _sharedRuntimeConfig = _deepFreeze(
  applyEnv(klona(_inlineRuntimeConfig), envOptions)
);
function useRuntimeConfig(event) {
  if (!event) {
    return _sharedRuntimeConfig;
  }
  if (event.context.nitro.runtimeConfig) {
    return event.context.nitro.runtimeConfig;
  }
  const runtimeConfig = klona(_inlineRuntimeConfig);
  applyEnv(runtimeConfig, envOptions);
  event.context.nitro.runtimeConfig = runtimeConfig;
  return runtimeConfig;
}
_deepFreeze(klona(appConfig));
function _deepFreeze(object) {
  const propNames = Object.getOwnPropertyNames(object);
  for (const name of propNames) {
    const value = object[name];
    if (value && typeof value === "object") {
      _deepFreeze(value);
    }
  }
  return Object.freeze(object);
}
new Proxy(/* @__PURE__ */ Object.create(null), {
  get: (_, prop) => {
    console.warn(
      "Please use `useRuntimeConfig()` instead of accessing config directly."
    );
    const runtimeConfig = useRuntimeConfig();
    if (prop in runtimeConfig) {
      return runtimeConfig[prop];
    }
    return void 0;
  }
});

function createContext(opts = {}) {
  let currentInstance;
  let isSingleton = false;
  const checkConflict = (instance) => {
    if (currentInstance && currentInstance !== instance) {
      throw new Error("Context conflict");
    }
  };
  let als;
  if (opts.asyncContext) {
    const _AsyncLocalStorage = opts.AsyncLocalStorage || globalThis.AsyncLocalStorage;
    if (_AsyncLocalStorage) {
      als = new _AsyncLocalStorage();
    } else {
      console.warn("[unctx] `AsyncLocalStorage` is not provided.");
    }
  }
  const _getCurrentInstance = () => {
    if (als) {
      const instance = als.getStore();
      if (instance !== void 0) {
        return instance;
      }
    }
    return currentInstance;
  };
  return {
    use: () => {
      const _instance = _getCurrentInstance();
      if (_instance === void 0) {
        throw new Error("Context is not available");
      }
      return _instance;
    },
    tryUse: () => {
      return _getCurrentInstance();
    },
    set: (instance, replace) => {
      if (!replace) {
        checkConflict(instance);
      }
      currentInstance = instance;
      isSingleton = true;
    },
    unset: () => {
      currentInstance = void 0;
      isSingleton = false;
    },
    call: (instance, callback) => {
      checkConflict(instance);
      currentInstance = instance;
      try {
        return als ? als.run(instance, callback) : callback();
      } finally {
        if (!isSingleton) {
          currentInstance = void 0;
        }
      }
    },
    async callAsync(instance, callback) {
      currentInstance = instance;
      const onRestore = () => {
        currentInstance = instance;
      };
      const onLeave = () => currentInstance === instance ? onRestore : void 0;
      asyncHandlers.add(onLeave);
      try {
        const r = als ? als.run(instance, callback) : callback();
        if (!isSingleton) {
          currentInstance = void 0;
        }
        return await r;
      } finally {
        asyncHandlers.delete(onLeave);
      }
    }
  };
}
function createNamespace(defaultOpts = {}) {
  const contexts = {};
  return {
    get(key, opts = {}) {
      if (!contexts[key]) {
        contexts[key] = createContext({ ...defaultOpts, ...opts });
      }
      return contexts[key];
    }
  };
}
const _globalThis = typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof global !== "undefined" ? global : {};
const globalKey = "__unctx__";
const defaultNamespace = _globalThis[globalKey] || (_globalThis[globalKey] = createNamespace());
const getContext = (key, opts = {}) => defaultNamespace.get(key, opts);
const asyncHandlersKey = "__unctx_async_handlers__";
const asyncHandlers = _globalThis[asyncHandlersKey] || (_globalThis[asyncHandlersKey] = /* @__PURE__ */ new Set());
function executeAsync(function_) {
  const restores = [];
  for (const leaveHandler of asyncHandlers) {
    const restore2 = leaveHandler();
    if (restore2) {
      restores.push(restore2);
    }
  }
  const restore = () => {
    for (const restore2 of restores) {
      restore2();
    }
  };
  let awaitable = function_();
  if (awaitable && typeof awaitable === "object" && "catch" in awaitable) {
    awaitable = awaitable.catch((error) => {
      restore();
      throw error;
    });
  }
  return [awaitable, restore];
}

getContext("nitro-app", {
  asyncContext: false,
  AsyncLocalStorage: void 0
});

const config = useRuntimeConfig();
const _routeRulesMatcher = toRouteMatcher(
  createRouter$1({ routes: config.nitro.routeRules })
);
function createRouteRulesHandler(ctx) {
  return eventHandler((event) => {
    const routeRules = getRouteRules(event);
    if (routeRules.headers) {
      setHeaders(event, routeRules.headers);
    }
    if (routeRules.redirect) {
      let target = routeRules.redirect.to;
      if (target.endsWith("/**")) {
        let targetPath = event.path;
        const strpBase = routeRules.redirect._redirectStripBase;
        if (strpBase) {
          targetPath = withoutBase(targetPath, strpBase);
        }
        target = joinURL(target.slice(0, -3), targetPath);
      } else if (event.path.includes("?")) {
        const query = getQuery$1(event.path);
        target = withQuery(target, query);
      }
      return sendRedirect(event, target, routeRules.redirect.statusCode);
    }
    if (routeRules.proxy) {
      let target = routeRules.proxy.to;
      if (target.endsWith("/**")) {
        let targetPath = event.path;
        const strpBase = routeRules.proxy._proxyStripBase;
        if (strpBase) {
          targetPath = withoutBase(targetPath, strpBase);
        }
        target = joinURL(target.slice(0, -3), targetPath);
      } else if (event.path.includes("?")) {
        const query = getQuery$1(event.path);
        target = withQuery(target, query);
      }
      return proxyRequest(event, target, {
        fetch: ctx.localFetch,
        ...routeRules.proxy
      });
    }
  });
}
function getRouteRules(event) {
  event.context._nitro = event.context._nitro || {};
  if (!event.context._nitro.routeRules) {
    event.context._nitro.routeRules = getRouteRulesForPath(
      withoutBase(event.path.split("?")[0], useRuntimeConfig().app.baseURL)
    );
  }
  return event.context._nitro.routeRules;
}
function getRouteRulesForPath(path) {
  return defu({}, ..._routeRulesMatcher.matchAll(path).reverse());
}

function _captureError(error, type) {
  console.error(`[${type}]`, error);
  useNitroApp().captureError(error, { tags: [type] });
}
function trapUnhandledNodeErrors() {
  process.on(
    "unhandledRejection",
    (error) => _captureError(error, "unhandledRejection")
  );
  process.on(
    "uncaughtException",
    (error) => _captureError(error, "uncaughtException")
  );
}
function joinHeaders(value) {
  return Array.isArray(value) ? value.join(", ") : String(value);
}
function normalizeFetchResponse(response) {
  if (!response.headers.has("set-cookie")) {
    return response;
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: normalizeCookieHeaders(response.headers)
  });
}
function normalizeCookieHeader(header = "") {
  return splitCookiesString(joinHeaders(header));
}
function normalizeCookieHeaders(headers) {
  const outgoingHeaders = new Headers();
  for (const [name, header] of headers) {
    if (name === "set-cookie") {
      for (const cookie of normalizeCookieHeader(header)) {
        outgoingHeaders.append("set-cookie", cookie);
      }
    } else {
      outgoingHeaders.set(name, joinHeaders(header));
    }
  }
  return outgoingHeaders;
}

/**
* Nitro internal functions extracted from https://github.com/nitrojs/nitro/blob/v2/src/runtime/internal/utils.ts
*/
function isJsonRequest(event) {
	// If the client specifically requests HTML, then avoid classifying as JSON.
	if (hasReqHeader(event, "accept", "text/html")) {
		return false;
	}
	return hasReqHeader(event, "accept", "application/json") || hasReqHeader(event, "user-agent", "curl/") || hasReqHeader(event, "user-agent", "httpie/") || hasReqHeader(event, "sec-fetch-mode", "cors") || event.path.startsWith("/api/") || event.path.endsWith(".json");
}
function hasReqHeader(event, name, includes) {
	const value = getRequestHeader(event, name);
	return value && typeof value === "string" && value.toLowerCase().includes(includes);
}

const errorHandler$0 = (async function errorhandler(error, event, { defaultHandler }) {
	if (event.handled || isJsonRequest(event)) {
		// let Nitro handle JSON errors
		return;
	}
	// invoke default Nitro error handler (which will log appropriately if required)
	const defaultRes = await defaultHandler(error, event, { json: true });
	// let Nitro handle redirect if appropriate
	const status = error.status || error.statusCode || 500;
	if (status === 404 && defaultRes.status === 302) {
		setResponseHeaders(event, defaultRes.headers);
		setResponseStatus(event, defaultRes.status, defaultRes.statusText);
		return send(event, JSON.stringify(defaultRes.body, null, 2));
	}
	const errorObject = defaultRes.body;
	// remove proto/hostname/port from URL
	const url = new URL(errorObject.url);
	errorObject.url = withoutBase(url.pathname, useRuntimeConfig(event).app.baseURL) + url.search + url.hash;
	// add default server message (keep sanitized for unhandled errors)
	errorObject.message = error.unhandled ? errorObject.message || "Server Error" : error.message || errorObject.message || "Server Error";
	// we will be rendering this error internally so we can pass along the error.data safely
	errorObject.data ||= error.data;
	errorObject.statusText ||= error.statusText || error.statusMessage;
	delete defaultRes.headers["content-type"];
	delete defaultRes.headers["content-security-policy"];
	setResponseHeaders(event, defaultRes.headers);
	// Access request headers
	const reqHeaders = getRequestHeaders(event);
	// Detect to avoid recursion in SSR rendering of errors
	const isRenderingError = event.path.startsWith("/__nuxt_error") || !!reqHeaders["x-nuxt-error"];
	// HTML response (via SSR)
	const res = isRenderingError ? null : await useNitroApp().localFetch(withQuery(joinURL(useRuntimeConfig(event).app.baseURL, "/__nuxt_error"), errorObject), {
		headers: {
			...reqHeaders,
			"x-nuxt-error": "true"
		},
		redirect: "manual"
	}).catch(() => null);
	if (event.handled) {
		return;
	}
	// Fallback to static rendered error page
	if (!res) {
		const { template } = await import('../_/error-500.mjs');
		setResponseHeader(event, "Content-Type", "text/html;charset=UTF-8");
		return send(event, template(errorObject));
	}
	const html = await res.text();
	for (const [header, value] of res.headers.entries()) {
		if (header === "set-cookie") {
			appendResponseHeader(event, header, value);
			continue;
		}
		setResponseHeader(event, header, value);
	}
	setResponseStatus(event, res.status && res.status !== 200 ? res.status : defaultRes.status, res.statusText || defaultRes.statusText);
	return send(event, html);
});

function defineNitroErrorHandler(handler) {
  return handler;
}

const errorHandler$1 = defineNitroErrorHandler(
  function defaultNitroErrorHandler(error, event) {
    const res = defaultHandler(error, event);
    setResponseHeaders(event, res.headers);
    setResponseStatus(event, res.status, res.statusText);
    return send(event, JSON.stringify(res.body, null, 2));
  }
);
function defaultHandler(error, event, opts) {
  const isSensitive = error.unhandled || error.fatal;
  const statusCode = error.statusCode || 500;
  const statusMessage = error.statusMessage || "Server Error";
  const url = getRequestURL(event, { xForwardedHost: true, xForwardedProto: true });
  if (statusCode === 404) {
    const baseURL = "/";
    if (/^\/[^/]/.test(baseURL) && !url.pathname.startsWith(baseURL)) {
      const redirectTo = `${baseURL}${url.pathname.slice(1)}${url.search}`;
      return {
        status: 302,
        statusText: "Found",
        headers: { location: redirectTo },
        body: `Redirecting...`
      };
    }
  }
  if (isSensitive && !opts?.silent) {
    const tags = [error.unhandled && "[unhandled]", error.fatal && "[fatal]"].filter(Boolean).join(" ");
    console.error(`[request error] ${tags} [${event.method}] ${url}
`, error);
  }
  const headers = {
    "content-type": "application/json",
    // Prevent browser from guessing the MIME types of resources.
    "x-content-type-options": "nosniff",
    // Prevent error page from being embedded in an iframe
    "x-frame-options": "DENY",
    // Prevent browsers from sending the Referer header
    "referrer-policy": "no-referrer",
    // Disable the execution of any js
    "content-security-policy": "script-src 'none'; frame-ancestors 'none';"
  };
  setResponseStatus(event, statusCode, statusMessage);
  if (statusCode === 404 || !getResponseHeader(event, "cache-control")) {
    headers["cache-control"] = "no-cache";
  }
  const body = {
    error: true,
    url: url.href,
    statusCode,
    statusMessage,
    message: isSensitive ? "Server Error" : error.message,
    data: isSensitive ? void 0 : error.data
  };
  return {
    status: statusCode,
    statusText: statusMessage,
    headers,
    body
  };
}

const errorHandlers = [errorHandler$0, errorHandler$1];

async function errorHandler(error, event) {
  for (const handler of errorHandlers) {
    try {
      await handler(error, event, { defaultHandler });
      if (event.handled) {
        return; // Response handled
      }
    } catch(error) {
      // Handler itself thrown, log and continue
      console.error(error);
    }
  }
  // H3 will handle fallback
}

const plugins = [
  
];

const assets = {
  "/_nuxt/2nQKRi61.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"15ef-FcuCBf+0GWBpwP2mM/WAVGzXvOs\"",
    "mtime": "2026-03-12T06:01:18.310Z",
    "size": 5615,
    "path": "../public/_nuxt/2nQKRi61.js"
  },
  "/_nuxt/7eJxfQzf.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"4167-Q6lkvGHGv3amXuiuWXl687Dy96Y\"",
    "mtime": "2026-03-12T06:01:18.311Z",
    "size": 16743,
    "path": "../public/_nuxt/7eJxfQzf.js"
  },
  "/_nuxt/AuthorRow.DVy7lpqz.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"39f-+srd0KHDhfamSkh3N4EOSdmT1UE\"",
    "mtime": "2026-03-12T06:01:18.310Z",
    "size": 927,
    "path": "../public/_nuxt/AuthorRow.DVy7lpqz.css"
  },
  "/_nuxt/B33FXpuM.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"8e8-NeOQ+O2hPIqhJMbM7Z3n2AaUbCw\"",
    "mtime": "2026-03-12T06:01:18.311Z",
    "size": 2280,
    "path": "../public/_nuxt/B33FXpuM.js"
  },
  "/_nuxt/B4jSEzev.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"b5c-zUtV7AEUhhk5B8Y8ngjh+PeeK8k\"",
    "mtime": "2026-03-12T06:01:18.311Z",
    "size": 2908,
    "path": "../public/_nuxt/B4jSEzev.js"
  },
  "/_nuxt/B4lBZria.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"929-eyNQbuv8DuTc4JoE8LRINRFkxaM\"",
    "mtime": "2026-03-12T06:01:18.311Z",
    "size": 2345,
    "path": "../public/_nuxt/B4lBZria.js"
  },
  "/_nuxt/BCeZqJOP.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"412-qT+AKEwxu/1TsDloJjKfgfSlQkU\"",
    "mtime": "2026-03-12T06:01:18.311Z",
    "size": 1042,
    "path": "../public/_nuxt/BCeZqJOP.js"
  },
  "/_nuxt/B-uIAh7X.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"6070f-sI9oSRYFSKiAP+z01AlHLSIvX2c\"",
    "mtime": "2026-03-12T06:01:18.311Z",
    "size": 395023,
    "path": "../public/_nuxt/B-uIAh7X.js"
  },
  "/_nuxt/BDcv5D8y.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"5c7-upyYx8SEAGd4KsUNQ8slTTz+KDw\"",
    "mtime": "2026-03-12T06:01:18.311Z",
    "size": 1479,
    "path": "../public/_nuxt/BDcv5D8y.js"
  },
  "/_nuxt/BNq2te6y.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"697-V+B/dO0d7CJ4OTwnNFQZwzXpmcA\"",
    "mtime": "2026-03-12T06:01:18.311Z",
    "size": 1687,
    "path": "../public/_nuxt/BNq2te6y.js"
  },
  "/_nuxt/BDcdlfpG.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"2d2-uBsKhT1QQOGP+gAEENBP6eDjrv4\"",
    "mtime": "2026-03-12T06:01:18.311Z",
    "size": 722,
    "path": "../public/_nuxt/BDcdlfpG.js"
  },
  "/_nuxt/BC3osajv.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"4a2-LaTMiOa+tzbOJwBLRk9VvQ+x+Q4\"",
    "mtime": "2026-03-12T06:01:18.311Z",
    "size": 1186,
    "path": "../public/_nuxt/BC3osajv.js"
  },
  "/_nuxt/BWmqFvgs.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"22f5-R933pUsGpgu++fpKKVhKmYdpXaQ\"",
    "mtime": "2026-03-12T06:01:18.311Z",
    "size": 8949,
    "path": "../public/_nuxt/BWmqFvgs.js"
  },
  "/_nuxt/BXLUcA0y.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"542-wO2WVxdfLqXZeBGGZc4EyASCARA\"",
    "mtime": "2026-03-12T06:01:18.311Z",
    "size": 1346,
    "path": "../public/_nuxt/BXLUcA0y.js"
  },
  "/_nuxt/BenvXfOm.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"7fe-OFKfF/YXgOqkULtq31kB97/Obi0\"",
    "mtime": "2026-03-12T06:01:18.311Z",
    "size": 2046,
    "path": "../public/_nuxt/BenvXfOm.js"
  },
  "/_nuxt/Bf6diVj5.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"3af-ObeCyyiTgg5ZaC9mzsloRd9P7Gk\"",
    "mtime": "2026-03-12T06:01:18.311Z",
    "size": 943,
    "path": "../public/_nuxt/Bf6diVj5.js"
  },
  "/_nuxt/BoJKfH9-.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"50b-a9p4F0fcn8nYqKgnu+9zHbwlNCU\"",
    "mtime": "2026-03-12T06:01:18.311Z",
    "size": 1291,
    "path": "../public/_nuxt/BoJKfH9-.js"
  },
  "/_nuxt/BqXtwS--.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"331-zNl+yCahFh5hWiQFKBzjg7Zf0xc\"",
    "mtime": "2026-03-12T06:01:18.311Z",
    "size": 817,
    "path": "../public/_nuxt/BqXtwS--.js"
  },
  "/_nuxt/BqYizsjG.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"8b2-QupVMd1TtLh9MPVnMR3UBKKoEl0\"",
    "mtime": "2026-03-12T06:01:18.311Z",
    "size": 2226,
    "path": "../public/_nuxt/BqYizsjG.js"
  },
  "/_nuxt/Bs73BYdx.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"1aa4-CNbye2uMPIp7k6nLqo6AiNAi7S8\"",
    "mtime": "2026-03-12T06:01:18.311Z",
    "size": 6820,
    "path": "../public/_nuxt/Bs73BYdx.js"
  },
  "/_nuxt/ByG_fJlE.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"eb2-FAhiZ3zTeexhq3Nfx2lsZpdQsoo\"",
    "mtime": "2026-03-12T06:01:18.311Z",
    "size": 3762,
    "path": "../public/_nuxt/ByG_fJlE.js"
  },
  "/_nuxt/CAZ2vixL.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"6b0-/EaHD+k5WLYLGurjxCDU1N+l8/A\"",
    "mtime": "2026-03-12T06:01:18.311Z",
    "size": 1712,
    "path": "../public/_nuxt/CAZ2vixL.js"
  },
  "/_nuxt/CBoepuli.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"1f44-zOdPMrQxVLQXG0/P9liTJWxt7WE\"",
    "mtime": "2026-03-12T06:01:18.311Z",
    "size": 8004,
    "path": "../public/_nuxt/CBoepuli.js"
  },
  "/_nuxt/C3V03R0M.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"2f2f1-/RQpsslqk5bOyB/y1Uo1bzA8rKM\"",
    "mtime": "2026-03-12T06:01:18.312Z",
    "size": 193265,
    "path": "../public/_nuxt/C3V03R0M.js"
  },
  "/_nuxt/CEwGaPLI.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"2c30-L28bzoYbOQqxvJ21/6qhRnukXNE\"",
    "mtime": "2026-03-12T06:01:18.312Z",
    "size": 11312,
    "path": "../public/_nuxt/CEwGaPLI.js"
  },
  "/_nuxt/CHEQa_uu.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"92d-EgVnPU6o87FRRp3EGXzQVsP3rXo\"",
    "mtime": "2026-03-12T06:01:18.312Z",
    "size": 2349,
    "path": "../public/_nuxt/CHEQa_uu.js"
  },
  "/_nuxt/CL-KdkJi.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"4d6-yO07AeQguFl7oZhpg7ftGCZ8UA4\"",
    "mtime": "2026-03-12T06:01:18.312Z",
    "size": 1238,
    "path": "../public/_nuxt/CL-KdkJi.js"
  },
  "/_nuxt/CQ2Rmfnh.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"d40-Fc1MfUl9CsXB34sIHViQRg7CVD0\"",
    "mtime": "2026-03-12T06:01:18.312Z",
    "size": 3392,
    "path": "../public/_nuxt/CQ2Rmfnh.js"
  },
  "/_nuxt/CW2tPTRg.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"6ab-hsO4S5nL77gv2NTNOaBq0+dT6pk\"",
    "mtime": "2026-03-12T06:01:18.312Z",
    "size": 1707,
    "path": "../public/_nuxt/CW2tPTRg.js"
  },
  "/_nuxt/CH3iLkpi.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"45f-y+9BfP2jrEJ34xp0wtPH4vs+7TQ\"",
    "mtime": "2026-03-12T06:01:18.312Z",
    "size": 1119,
    "path": "../public/_nuxt/CH3iLkpi.js"
  },
  "/_nuxt/CaLDfC6C.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"46b-1RCrKauolhraGpyARu2wToxkGTE\"",
    "mtime": "2026-03-12T06:01:18.312Z",
    "size": 1131,
    "path": "../public/_nuxt/CaLDfC6C.js"
  },
  "/_nuxt/CkKO7rXX.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"60a-LtYAfwfcOgqYq4M4lVkPkcnhXGw\"",
    "mtime": "2026-03-12T06:01:18.312Z",
    "size": 1546,
    "path": "../public/_nuxt/CkKO7rXX.js"
  },
  "/_nuxt/ContentCard.BVfwt2Qh.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"7ee-Wa+VAdNZrxKmQq+GQBCQ4OVGtEk\"",
    "mtime": "2026-03-12T06:01:18.312Z",
    "size": 2030,
    "path": "../public/_nuxt/ContentCard.BVfwt2Qh.css"
  },
  "/_nuxt/ContentTypeBadge.CSqY8iai.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"2fe-QzODW+GuWTEyR00xxZEJh4f2RlY\"",
    "mtime": "2026-03-12T06:01:18.312Z",
    "size": 766,
    "path": "../public/_nuxt/ContentTypeBadge.CSqY8iai.css"
  },
  "/_nuxt/CwgZ6lTY.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"510-LTSYnBvTO9Bl0MZt9YHEjbUI+d8\"",
    "mtime": "2026-03-12T06:01:18.312Z",
    "size": 1296,
    "path": "../public/_nuxt/CwgZ6lTY.js"
  },
  "/_nuxt/CpubEditor.BUSmeT_j.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"146-NGI4TF7VZ+rCBd9+UJfuWnPIPBs\"",
    "mtime": "2026-03-12T06:01:18.312Z",
    "size": 326,
    "path": "../public/_nuxt/CpubEditor.BUSmeT_j.css"
  },
  "/_nuxt/CxBEyJix.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"745-e82wDxzgcudZWU16enSTAM9wcyc\"",
    "mtime": "2026-03-12T06:01:18.312Z",
    "size": 1861,
    "path": "../public/_nuxt/CxBEyJix.js"
  },
  "/_nuxt/D46hf1bl.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"649-V9XNyeNZisVAzxIO4FqsG7/qZnE\"",
    "mtime": "2026-03-12T06:01:18.312Z",
    "size": 1609,
    "path": "../public/_nuxt/D46hf1bl.js"
  },
  "/_nuxt/DAGbzMqs.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"65f-cEOlGyuPgEU3AOCA4K5JJR0lKV8\"",
    "mtime": "2026-03-12T06:01:18.313Z",
    "size": 1631,
    "path": "../public/_nuxt/DAGbzMqs.js"
  },
  "/_nuxt/DDUI71Yc.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"28d-iy25Bc0u/YmCjdXTQ9OsjpBO1Dk\"",
    "mtime": "2026-03-12T06:01:18.313Z",
    "size": 653,
    "path": "../public/_nuxt/DDUI71Yc.js"
  },
  "/_nuxt/D6txvjaN.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"4d24-u9v8GbZFgEnS0YFxrlcYesC3JAs\"",
    "mtime": "2026-03-12T06:01:18.313Z",
    "size": 19748,
    "path": "../public/_nuxt/D6txvjaN.js"
  },
  "/_nuxt/DKXRcqye.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"92e-QKQ9SqOfVVLZ6QaTkl0DVJLgzbA\"",
    "mtime": "2026-03-12T06:01:18.313Z",
    "size": 2350,
    "path": "../public/_nuxt/DKXRcqye.js"
  },
  "/_nuxt/CountdownTimer.BJmhrNPV.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"243-RHyp3Ssm+/Ha/l6J7xP790U4ZCU\"",
    "mtime": "2026-03-12T06:01:18.312Z",
    "size": 579,
    "path": "../public/_nuxt/CountdownTimer.BJmhrNPV.css"
  },
  "/_nuxt/DKEZqQVC.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"14b-tHKj9/fMuvRfpAPS2mYpSzdOV8A\"",
    "mtime": "2026-03-12T06:01:18.313Z",
    "size": 331,
    "path": "../public/_nuxt/DKEZqQVC.js"
  },
  "/_nuxt/DLUey8Xw.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"8f6-SKUd6aULgpy9RUDvxkjBCHlz3fs\"",
    "mtime": "2026-03-12T06:01:18.313Z",
    "size": 2294,
    "path": "../public/_nuxt/DLUey8Xw.js"
  },
  "/_nuxt/DOeW_8q7.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"1496-t893hQ77sgcawlZUW2z3F2LTS+w\"",
    "mtime": "2026-03-12T06:01:18.313Z",
    "size": 5270,
    "path": "../public/_nuxt/DOeW_8q7.js"
  },
  "/_nuxt/DZnlJRF2.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"385-Pj+z5wwxm1abJKGUgB9GU57XfLg\"",
    "mtime": "2026-03-12T06:01:18.313Z",
    "size": 901,
    "path": "../public/_nuxt/DZnlJRF2.js"
  },
  "/_nuxt/DUOH_Fwn.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"5f6-8z9ojXfU24tK5IS8IiVUmnjUuJw\"",
    "mtime": "2026-03-12T06:01:18.313Z",
    "size": 1526,
    "path": "../public/_nuxt/DUOH_Fwn.js"
  },
  "/_nuxt/DZmJnAfL.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"6fe-tE9pkvAtjV1bSP/W0+5oVoOGejM\"",
    "mtime": "2026-03-12T06:01:18.313Z",
    "size": 1790,
    "path": "../public/_nuxt/DZmJnAfL.js"
  },
  "/_nuxt/DMDHADIQ.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"ddf-AGX71wbLiAszfPw5X7j2NvMGPy4\"",
    "mtime": "2026-03-12T06:01:18.313Z",
    "size": 3551,
    "path": "../public/_nuxt/DMDHADIQ.js"
  },
  "/_nuxt/Ddfa-e9a.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"12bb-MoRV14S1LIxPuuGgJb1hH7q9qr0\"",
    "mtime": "2026-03-12T06:01:18.313Z",
    "size": 4795,
    "path": "../public/_nuxt/Ddfa-e9a.js"
  },
  "/_nuxt/Dh-HOVM6.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"4f06-V09UqVs4+BcO6kohzrNQ9jyZTyI\"",
    "mtime": "2026-03-12T06:01:18.313Z",
    "size": 20230,
    "path": "../public/_nuxt/Dh-HOVM6.js"
  },
  "/_nuxt/D_I1OVbF.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"7fe-smGfWRiOaxyvLyviNOtzIeX78VU\"",
    "mtime": "2026-03-12T06:01:18.313Z",
    "size": 2046,
    "path": "../public/_nuxt/D_I1OVbF.js"
  },
  "/_nuxt/DtUdOCwg.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"523-ZCnF5tai8VZhpDVzWPJqyR77oBI\"",
    "mtime": "2026-03-12T06:01:18.313Z",
    "size": 1315,
    "path": "../public/_nuxt/DtUdOCwg.js"
  },
  "/_nuxt/Dy0BstXc.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"40-AtZBq7OUm7UzHYXgB7jPMcRP3kA\"",
    "mtime": "2026-03-12T06:01:18.313Z",
    "size": 64,
    "path": "../public/_nuxt/Dy0BstXc.js"
  },
  "/_nuxt/DyBo7Vpe.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"4b5-72UCq9IzxKo448KT26+bHQOVCw0\"",
    "mtime": "2026-03-12T06:01:18.313Z",
    "size": 1205,
    "path": "../public/_nuxt/DyBo7Vpe.js"
  },
  "/_nuxt/Dz728biY.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"680-QCcTSotXPCXSdi8tsWtYjnOrjxw\"",
    "mtime": "2026-03-12T06:01:18.313Z",
    "size": 1664,
    "path": "../public/_nuxt/Dz728biY.js"
  },
  "/_nuxt/Pu1ORon8.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"347-PqpTWp3332w3Uji1m85liP7g2RI\"",
    "mtime": "2026-03-12T06:01:18.313Z",
    "size": 839,
    "path": "../public/_nuxt/Pu1ORon8.js"
  },
  "/_nuxt/ZEh1OAT6.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"23c-eOmVvNxw3BSdydcazKGKvH4fEyE\"",
    "mtime": "2026-03-12T06:01:18.313Z",
    "size": 572,
    "path": "../public/_nuxt/ZEh1OAT6.js"
  },
  "/_nuxt/_...rowgppBy.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"4d2-zEfMf60eU4uskfVuW79GHUrY3HA\"",
    "mtime": "2026-03-12T06:01:18.313Z",
    "size": 1234,
    "path": "../public/_nuxt/_...rowgppBy.css"
  },
  "/_nuxt/_WNPJl9L.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"3b45-hfTpMTHIOiEQyS2xnTJaW7OZt1I\"",
    "mtime": "2026-03-12T06:01:18.314Z",
    "size": 15173,
    "path": "../public/_nuxt/_WNPJl9L.js"
  },
  "/_nuxt/_conversationId_.Cue1zSd7.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"4ee-qRayqWb/mUTYP11HKYBDgsyW6H0\"",
    "mtime": "2026-03-12T06:01:18.314Z",
    "size": 1262,
    "path": "../public/_nuxt/_conversationId_.Cue1zSd7.css"
  },
  "/_nuxt/_lessonSlug_.Df8Q7mWW.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"5ea-UNZJDPjiJ6+wxjv8Crv44Zxolr0\"",
    "mtime": "2026-03-12T06:01:18.314Z",
    "size": 1514,
    "path": "../public/_nuxt/_lessonSlug_.Df8Q7mWW.css"
  },
  "/_nuxt/_siteSlug_.ClBZoUND.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"57f-xrG/4tDiU+Swqu/DmerEmbg0JA8\"",
    "mtime": "2026-03-12T06:01:18.314Z",
    "size": 1407,
    "path": "../public/_nuxt/_siteSlug_.ClBZoUND.css"
  },
  "/_nuxt/_slug_.Cu7YxbOH.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"1fe-iHO/OXVWzwNXpePCCzETfUuHA10\"",
    "mtime": "2026-03-12T06:01:18.314Z",
    "size": 510,
    "path": "../public/_nuxt/_slug_.Cu7YxbOH.css"
  },
  "/_nuxt/_slug_.BXwg8Gbl.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"3fd1-FZewSjNM6k33sujg6l/5eT6NVpc\"",
    "mtime": "2026-03-12T06:01:18.314Z",
    "size": 16337,
    "path": "../public/_nuxt/_slug_.BXwg8Gbl.css"
  },
  "/_nuxt/_slug_.JryqOQ-T.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"13ea-xBFCfskM3+niM3m1hTMkqe02szo\"",
    "mtime": "2026-03-12T06:01:18.314Z",
    "size": 5098,
    "path": "../public/_nuxt/_slug_.JryqOQ-T.css"
  },
  "/_nuxt/_username_.jkenUXsE.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"1cec-rF/WoT0ZWyyqEKWNZxFfba9yCLs\"",
    "mtime": "2026-03-12T06:01:18.314Z",
    "size": 7404,
    "path": "../public/_nuxt/_username_.jkenUXsE.css"
  },
  "/_nuxt/admin.CuEkSsjd.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"6c7-JyCbDSjbRN+h1Po/NXTXZWFI54I\"",
    "mtime": "2026-03-12T06:01:18.314Z",
    "size": 1735,
    "path": "../public/_nuxt/admin.CuEkSsjd.css"
  },
  "/_nuxt/appearance.C7Vo_EPg.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"2a0-mLKp9Gohe8A0nkPiEaMcbZeLcNI\"",
    "mtime": "2026-03-12T06:01:18.314Z",
    "size": 672,
    "path": "../public/_nuxt/appearance.C7Vo_EPg.css"
  },
  "/_nuxt/audit.Bk7zyCmM.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"319-kkLOhkmeCDxnBw+cnMtXneq9QEo\"",
    "mtime": "2026-03-12T06:01:18.314Z",
    "size": 793,
    "path": "../public/_nuxt/audit.Bk7zyCmM.css"
  },
  "/_nuxt/auth.guVz6xFX.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"291-gcFo/HmDY2sL+eUQt+ZQLaNOB4I\"",
    "mtime": "2026-03-12T06:01:18.314Z",
    "size": 657,
    "path": "../public/_nuxt/auth.guVz6xFX.css"
  },
  "/_nuxt/create.D-lxqzpL.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"5e5-K/xq2ry1EJgQ5pXlxvSF8O0W1KY\"",
    "mtime": "2026-03-12T06:01:18.314Z",
    "size": 1509,
    "path": "../public/_nuxt/create.D-lxqzpL.css"
  },
  "/_nuxt/content.Beth3trZ.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"53f-TjawyIhQP/+4Sdz1SYf7PaQZCdQ\"",
    "mtime": "2026-03-12T06:01:18.314Z",
    "size": 1343,
    "path": "../public/_nuxt/content.Beth3trZ.css"
  },
  "/_nuxt/create.DKW_DWhv.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"1d5-iwQnFoDNcc52H9jqhPNxL/yAwcc\"",
    "mtime": "2026-03-12T06:01:18.314Z",
    "size": 469,
    "path": "../public/_nuxt/create.DKW_DWhv.css"
  },
  "/_nuxt/create.we9jrt5g.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"61d-B0BVQgFalzQDBXUAba3+FWPW9ug\"",
    "mtime": "2026-03-12T06:01:18.314Z",
    "size": 1565,
    "path": "../public/_nuxt/create.we9jrt5g.css"
  },
  "/_nuxt/dashboard.DVO7Jo0W.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"83f-zaBp7mv3tGidsRi4lPQQ0t5yRdI\"",
    "mtime": "2026-03-12T06:01:18.314Z",
    "size": 2111,
    "path": "../public/_nuxt/dashboard.DVO7Jo0W.css"
  },
  "/_nuxt/default.fus33jRK.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"23ae-7Dy8ozWO9f1QV8ftgqCbsQiJwpc\"",
    "mtime": "2026-03-12T06:01:18.314Z",
    "size": 9134,
    "path": "../public/_nuxt/default.fus33jRK.css"
  },
  "/_nuxt/eaQWyDPc.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"687-/CczA/gjruF8yDts4Ux9DsshTXo\"",
    "mtime": "2026-03-12T06:01:18.314Z",
    "size": 1671,
    "path": "../public/_nuxt/eaQWyDPc.js"
  },
  "/_nuxt/edit.Dni-JbNW.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"3e0-9G8Z8ysSenRFiDoFQGuF9hpOrOQ\"",
    "mtime": "2026-03-12T06:01:18.314Z",
    "size": 992,
    "path": "../public/_nuxt/edit.Dni-JbNW.css"
  },
  "/_nuxt/edit.KviDnmGq.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"233e-EiuO1QbpiYU94aLgsq1WBuyCMqA\"",
    "mtime": "2026-03-12T06:01:18.315Z",
    "size": 9022,
    "path": "../public/_nuxt/edit.KviDnmGq.css"
  },
  "/_nuxt/edit.mYWswRXL.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"2da-N+3PtBzIawrj4DC5V8CtUmVJjHs\"",
    "mtime": "2026-03-12T06:01:18.314Z",
    "size": 730,
    "path": "../public/_nuxt/edit.mYWswRXL.css"
  },
  "/_nuxt/editor.CqYnHnxn.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"631-DpoInIT6/lQDDA2XEzLeuXKx+8c\"",
    "mtime": "2026-03-12T06:01:18.314Z",
    "size": 1585,
    "path": "../public/_nuxt/editor.CqYnHnxn.css"
  },
  "/_nuxt/error-404.Cfia30in.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"dca-qVA6jDkxNzFS6WhjbDwPFtguCI0\"",
    "mtime": "2026-03-12T06:01:18.315Z",
    "size": 3530,
    "path": "../public/_nuxt/error-404.Cfia30in.css"
  },
  "/_nuxt/error-500.DI2rlNCt.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"75a-ZlSQRiXO5L0F9hrUZbpl6FD2OwM\"",
    "mtime": "2026-03-12T06:01:18.315Z",
    "size": 1882,
    "path": "../public/_nuxt/error-500.DI2rlNCt.css"
  },
  "/_nuxt/feed.An90og1t.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"6a6-MNRGOQEgf9eOLe6dCOqULAdyBQU\"",
    "mtime": "2026-03-12T06:01:18.315Z",
    "size": 1702,
    "path": "../public/_nuxt/feed.An90og1t.css"
  },
  "/_nuxt/g9o6qSou.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"608-0NOk9CZqPklg6ihdAuFzbSofQF0\"",
    "mtime": "2026-03-12T06:01:18.315Z",
    "size": 1544,
    "path": "../public/_nuxt/g9o6qSou.js"
  },
  "/_nuxt/index.6zPRBpDg.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"320-W0z30Yjke8c3cXaJcaUHadvjGTE\"",
    "mtime": "2026-03-12T06:01:18.315Z",
    "size": 800,
    "path": "../public/_nuxt/index.6zPRBpDg.css"
  },
  "/_nuxt/index.B9DSdNva.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"175f-qACj5NkZGyYCmo9lW5cCh/bOK9c\"",
    "mtime": "2026-03-12T06:01:18.315Z",
    "size": 5983,
    "path": "../public/_nuxt/index.B9DSdNva.css"
  },
  "/_nuxt/index.BxSLOL3B.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"e31-YcFoOmjV+L/4Zjrq6RhRX5jsGDg\"",
    "mtime": "2026-03-12T06:01:18.315Z",
    "size": 3633,
    "path": "../public/_nuxt/index.BxSLOL3B.css"
  },
  "/_nuxt/index.C0NE2bxQ.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"706-X/qPiaeTDpdjqjEGVxr6VeFji6g\"",
    "mtime": "2026-03-12T06:01:18.315Z",
    "size": 1798,
    "path": "../public/_nuxt/index.C0NE2bxQ.css"
  },
  "/_nuxt/hHxv-s9a.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"b7-ul00PhxXnc6XODdlyxgN4SvtDm8\"",
    "mtime": "2026-03-12T06:01:18.315Z",
    "size": 183,
    "path": "../public/_nuxt/hHxv-s9a.js"
  },
  "/_nuxt/index.CsJHg7eP.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"355c-0mbgv/3YgvRx7GYl5zzL3ykCs0M\"",
    "mtime": "2026-03-12T06:01:18.315Z",
    "size": 13660,
    "path": "../public/_nuxt/index.CsJHg7eP.css"
  },
  "/_nuxt/index.DEoFmmNO.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"515-TTv//yxYBAuWlXn3sB9ntu5KsaY\"",
    "mtime": "2026-03-12T06:01:18.315Z",
    "size": 1301,
    "path": "../public/_nuxt/index.DEoFmmNO.css"
  },
  "/_nuxt/index.DaoE6VT7.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"608-250F1rxmmikixpjB1N9i6N1+mQc\"",
    "mtime": "2026-03-12T06:01:18.315Z",
    "size": 1544,
    "path": "../public/_nuxt/index.DaoE6VT7.css"
  },
  "/_nuxt/index.DdHirfDW.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"2a2-RrRp87p823c1Zkfu6uBO4gdSd/s\"",
    "mtime": "2026-03-12T06:01:18.315Z",
    "size": 674,
    "path": "../public/_nuxt/index.DdHirfDW.css"
  },
  "/_nuxt/index.Do7PK3MZ.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"3dc-Z4RjcOUYrf94zCwqkXXpl7JhNyo\"",
    "mtime": "2026-03-12T06:01:18.315Z",
    "size": 988,
    "path": "../public/_nuxt/index.Do7PK3MZ.css"
  },
  "/_nuxt/index.Dxc5V1lP.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"4f1-4Z/6E3HK5/FepLbJJb47pQNN4xA\"",
    "mtime": "2026-03-12T06:01:18.315Z",
    "size": 1265,
    "path": "../public/_nuxt/index.Dxc5V1lP.css"
  },
  "/_nuxt/login.DQsrzZbu.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"761-S+l+8eSHybHa7Ythcmn4MUlVOEw\"",
    "mtime": "2026-03-12T06:01:18.315Z",
    "size": 1889,
    "path": "../public/_nuxt/login.DQsrzZbu.css"
  },
  "/_nuxt/members.DxAm20jG.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"45f-j4X6B5HO6ccDz/PC8h668UkRaYo\"",
    "mtime": "2026-03-12T06:01:18.315Z",
    "size": 1119,
    "path": "../public/_nuxt/members.DxAm20jG.css"
  },
  "/_nuxt/notifications.C1jB8uR1.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"4e2-cK5XtnqeZIjfbD+MgWS99yCFMM0\"",
    "mtime": "2026-03-12T06:01:18.315Z",
    "size": 1250,
    "path": "../public/_nuxt/notifications.C1jB8uR1.css"
  },
  "/_nuxt/nbkjpGSn.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"9fc-i8J6qag9ELX/tovrACjTgq9tXvg\"",
    "mtime": "2026-03-12T06:01:18.315Z",
    "size": 2556,
    "path": "../public/_nuxt/nbkjpGSn.js"
  },
  "/_nuxt/qhm3wBQ4.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"20a-DteT36GyLN5X4DTb/IcU+2hFQWs\"",
    "mtime": "2026-03-12T06:01:18.315Z",
    "size": 522,
    "path": "../public/_nuxt/qhm3wBQ4.js"
  },
  "/_nuxt/profile.0L-M9R6I.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"16ce-zBGJqJNF4oggBXIJfCW6MdFOloc\"",
    "mtime": "2026-03-12T06:01:18.316Z",
    "size": 5838,
    "path": "../public/_nuxt/profile.0L-M9R6I.css"
  },
  "/_nuxt/register.BlzpiHHQ.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"773-OQ873KXNO0cqvxGiA2DRHuVnir0\"",
    "mtime": "2026-03-12T06:01:18.316Z",
    "size": 1907,
    "path": "../public/_nuxt/register.BlzpiHHQ.css"
  },
  "/_nuxt/search.CmUvoNDZ.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"d68-hOb2/G62rfJ1eGpylVB2AtcYSsU\"",
    "mtime": "2026-03-12T06:01:18.316Z",
    "size": 3432,
    "path": "../public/_nuxt/search.CmUvoNDZ.css"
  },
  "/_nuxt/reports.7qO4ZVq3.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"408-go50jMdB94fb6dGVUKambxFaVA0\"",
    "mtime": "2026-03-12T06:01:18.316Z",
    "size": 1032,
    "path": "../public/_nuxt/reports.7qO4ZVq3.css"
  },
  "/_nuxt/settings.BAvBI8kz.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"269-qqCEX5OhatifVUzbcYgzsZAbe4I\"",
    "mtime": "2026-03-12T06:01:18.316Z",
    "size": 617,
    "path": "../public/_nuxt/settings.BAvBI8kz.css"
  },
  "/_nuxt/settings.MEM4tz90.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"2ea-1n3+Cx102coTTZdcxkKE4o/lY7Q\"",
    "mtime": "2026-03-12T06:01:18.316Z",
    "size": 746,
    "path": "../public/_nuxt/settings.MEM4tz90.css"
  },
  "/_nuxt/users.BRqV5crv.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"4df-LIllyk7qxvgV1oJNgri3zW4lvBs\"",
    "mtime": "2026-03-12T06:01:18.316Z",
    "size": 1247,
    "path": "../public/_nuxt/users.BRqV5crv.css"
  },
  "/_nuxt/tl2AeCR2.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"6ca-VdjAdJ+mUP6RR2NTL8wL3Oq0wpY\"",
    "mtime": "2026-03-12T06:01:18.316Z",
    "size": 1738,
    "path": "../public/_nuxt/tl2AeCR2.js"
  },
  "/_nuxt/builds/latest.json": {
    "type": "application/json",
    "etag": "\"47-cWSmbJeBGSUhkemmc01+KNn+K+Y\"",
    "mtime": "2026-03-12T06:01:18.297Z",
    "size": 71,
    "path": "../public/_nuxt/builds/latest.json"
  },
  "/_nuxt/builds/meta/dev.json": {
    "type": "application/json",
    "etag": "\"37-0XPoEBBG5bhLvqfFxzf0I8H4DMI\"",
    "mtime": "2026-03-12T06:01:18.292Z",
    "size": 55,
    "path": "../public/_nuxt/builds/meta/dev.json"
  },
  "/_nuxt/builds/meta/ef64b3d4-71b1-419b-867b-13f1dd42a9e1.json": {
    "type": "application/json",
    "etag": "\"58-4Fq8k6R2WO2Tmc+lfDZP410L2yE\"",
    "mtime": "2026-03-12T06:01:18.292Z",
    "size": 88,
    "path": "../public/_nuxt/builds/meta/ef64b3d4-71b1-419b-867b-13f1dd42a9e1.json"
  }
};

const _DRIVE_LETTER_START_RE = /^[A-Za-z]:\//;
function normalizeWindowsPath(input = "") {
  if (!input) {
    return input;
  }
  return input.replace(/\\/g, "/").replace(_DRIVE_LETTER_START_RE, (r) => r.toUpperCase());
}
const _IS_ABSOLUTE_RE = /^[/\\](?![/\\])|^[/\\]{2}(?!\.)|^[A-Za-z]:[/\\]/;
const _DRIVE_LETTER_RE = /^[A-Za-z]:$/;
function cwd() {
  if (typeof process !== "undefined" && typeof process.cwd === "function") {
    return process.cwd().replace(/\\/g, "/");
  }
  return "/";
}
const resolve = function(...arguments_) {
  arguments_ = arguments_.map((argument) => normalizeWindowsPath(argument));
  let resolvedPath = "";
  let resolvedAbsolute = false;
  for (let index = arguments_.length - 1; index >= -1 && !resolvedAbsolute; index--) {
    const path = index >= 0 ? arguments_[index] : cwd();
    if (!path || path.length === 0) {
      continue;
    }
    resolvedPath = `${path}/${resolvedPath}`;
    resolvedAbsolute = isAbsolute(path);
  }
  resolvedPath = normalizeString(resolvedPath, !resolvedAbsolute);
  if (resolvedAbsolute && !isAbsolute(resolvedPath)) {
    return `/${resolvedPath}`;
  }
  return resolvedPath.length > 0 ? resolvedPath : ".";
};
function normalizeString(path, allowAboveRoot) {
  let res = "";
  let lastSegmentLength = 0;
  let lastSlash = -1;
  let dots = 0;
  let char = null;
  for (let index = 0; index <= path.length; ++index) {
    if (index < path.length) {
      char = path[index];
    } else if (char === "/") {
      break;
    } else {
      char = "/";
    }
    if (char === "/") {
      if (lastSlash === index - 1 || dots === 1) ; else if (dots === 2) {
        if (res.length < 2 || lastSegmentLength !== 2 || res[res.length - 1] !== "." || res[res.length - 2] !== ".") {
          if (res.length > 2) {
            const lastSlashIndex = res.lastIndexOf("/");
            if (lastSlashIndex === -1) {
              res = "";
              lastSegmentLength = 0;
            } else {
              res = res.slice(0, lastSlashIndex);
              lastSegmentLength = res.length - 1 - res.lastIndexOf("/");
            }
            lastSlash = index;
            dots = 0;
            continue;
          } else if (res.length > 0) {
            res = "";
            lastSegmentLength = 0;
            lastSlash = index;
            dots = 0;
            continue;
          }
        }
        if (allowAboveRoot) {
          res += res.length > 0 ? "/.." : "..";
          lastSegmentLength = 2;
        }
      } else {
        if (res.length > 0) {
          res += `/${path.slice(lastSlash + 1, index)}`;
        } else {
          res = path.slice(lastSlash + 1, index);
        }
        lastSegmentLength = index - lastSlash - 1;
      }
      lastSlash = index;
      dots = 0;
    } else if (char === "." && dots !== -1) {
      ++dots;
    } else {
      dots = -1;
    }
  }
  return res;
}
const isAbsolute = function(p) {
  return _IS_ABSOLUTE_RE.test(p);
};
const dirname = function(p) {
  const segments = normalizeWindowsPath(p).replace(/\/$/, "").split("/").slice(0, -1);
  if (segments.length === 1 && _DRIVE_LETTER_RE.test(segments[0])) {
    segments[0] += "/";
  }
  return segments.join("/") || (isAbsolute(p) ? "/" : ".");
};

function readAsset (id) {
  const serverDir = dirname(fileURLToPath(globalThis._importMeta_.url));
  return promises.readFile(resolve(serverDir, assets[id].path))
}

const publicAssetBases = {"/_nuxt/builds/meta/":{"maxAge":31536000},"/_nuxt/builds/":{"maxAge":1},"/_nuxt/":{"maxAge":31536000}};

function isPublicAssetURL(id = '') {
  if (assets[id]) {
    return true
  }
  for (const base in publicAssetBases) {
    if (id.startsWith(base)) { return true }
  }
  return false
}

function getAsset (id) {
  return assets[id]
}

const METHODS = /* @__PURE__ */ new Set(["HEAD", "GET"]);
const EncodingMap = { gzip: ".gz", br: ".br" };
const _M7d2_t = eventHandler((event) => {
  if (event.method && !METHODS.has(event.method)) {
    return;
  }
  let id = decodePath(
    withLeadingSlash(withoutTrailingSlash(parseURL(event.path).pathname))
  );
  let asset;
  const encodingHeader = String(
    getRequestHeader(event, "accept-encoding") || ""
  );
  const encodings = [
    ...encodingHeader.split(",").map((e) => EncodingMap[e.trim()]).filter(Boolean).sort(),
    ""
  ];
  for (const encoding of encodings) {
    for (const _id of [id + encoding, joinURL(id, "index.html" + encoding)]) {
      const _asset = getAsset(_id);
      if (_asset) {
        asset = _asset;
        id = _id;
        break;
      }
    }
  }
  if (!asset) {
    if (isPublicAssetURL(id)) {
      removeResponseHeader(event, "Cache-Control");
      throw createError$1({ statusCode: 404 });
    }
    return;
  }
  if (asset.encoding !== void 0) {
    appendResponseHeader(event, "Vary", "Accept-Encoding");
  }
  const ifNotMatch = getRequestHeader(event, "if-none-match") === asset.etag;
  if (ifNotMatch) {
    setResponseStatus(event, 304, "Not Modified");
    return "";
  }
  const ifModifiedSinceH = getRequestHeader(event, "if-modified-since");
  const mtimeDate = new Date(asset.mtime);
  if (ifModifiedSinceH && asset.mtime && new Date(ifModifiedSinceH) >= mtimeDate) {
    setResponseStatus(event, 304, "Not Modified");
    return "";
  }
  if (asset.type && !getResponseHeader(event, "Content-Type")) {
    setResponseHeader(event, "Content-Type", asset.type);
  }
  if (asset.etag && !getResponseHeader(event, "ETag")) {
    setResponseHeader(event, "ETag", asset.etag);
  }
  if (asset.mtime && !getResponseHeader(event, "Last-Modified")) {
    setResponseHeader(event, "Last-Modified", mtimeDate.toUTCString());
  }
  if (asset.encoding && !getResponseHeader(event, "Content-Encoding")) {
    setResponseHeader(event, "Content-Encoding", asset.encoding);
  }
  if (asset.size > 0 && !getResponseHeader(event, "Content-Length")) {
    setResponseHeader(event, "Content-Length", asset.size);
  }
  return readAsset(id);
});

const featureFlagsSchema = z.object({
  content: z.boolean().default(true),
  social: z.boolean().default(true),
  communities: z.boolean().default(true),
  docs: z.boolean().default(true),
  video: z.boolean().default(true),
  contests: z.boolean().default(false),
  learning: z.boolean().default(true),
  explainers: z.boolean().default(true),
  federation: z.boolean().default(false),
  admin: z.boolean().default(false)
});
const authConfigSchema = z.object({
  emailPassword: z.boolean().default(true),
  magicLink: z.boolean().default(false),
  passkeys: z.boolean().default(false),
  github: z.object({
    clientId: z.string().min(1),
    clientSecret: z.string().min(1)
  }).optional(),
  google: z.object({
    clientId: z.string().min(1),
    clientSecret: z.string().min(1)
  }).optional(),
  sharedAuthDb: z.string().url().optional(),
  trustedInstances: z.array(z.string().min(1)).optional()
});
const instanceConfigSchema = z.object({
  domain: z.string().min(1),
  name: z.string().min(1).max(128),
  description: z.string().min(1).max(500),
  contactEmail: z.string().email().optional(),
  maxUploadSize: z.number().int().positive().default(10 * 1024 * 1024),
  contentTypes: z.array(z.enum(["project", "article", "guide", "blog", "explainer"])).default(["project", "article", "guide", "blog"])
});
const configSchema = z.object({
  instance: instanceConfigSchema,
  features: featureFlagsSchema.default(() => featureFlagsSchema.parse({})),
  auth: authConfigSchema.default(() => authConfigSchema.parse({}))
});

function defineCommonPubConfig(input) {
  var _a;
  const config = configSchema.parse(input);
  const warnings = [];
  if (config.auth.sharedAuthDb) {
    warnings.push({
      field: "auth.sharedAuthDb",
      message: "Shared auth DB (Model C) couples instances at the database level. Only use this if you operate all connected instances."
    });
  }
  if (config.features.federation && !((_a = config.auth.trustedInstances) == null ? void 0 : _a.length)) {
    warnings.push({
      field: "features.federation",
      message: "Federation is enabled but no trusted instances are configured. AP Actor SSO (Model B) requires at least one trusted instance."
    });
  }
  if (config.features.learning && !config.features.explainers) {
    warnings.push({
      field: "features.explainers",
      message: "Learning is enabled but explainers are disabled. Explainers are a first-class lesson type in learning paths."
    });
  }
  return { config, warnings };
}

let cachedConfig = null;
function useConfig() {
  if (cachedConfig) return cachedConfig;
  const runtimeConfig = useRuntimeConfig();
  const { config } = defineCommonPubConfig({
    instance: {
      domain: runtimeConfig.public.domain || "localhost:3000",
      name: runtimeConfig.public.siteName || "CommonPub",
      description: runtimeConfig.public.siteDescription || "A CommonPub instance"
    }
  });
  cachedConfig = config;
  return config;
}

let db = null;
function useDB() {
  if (db) return db;
  const config = useRuntimeConfig();
  const databaseUrl = config.databaseUrl;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured. Set NUXT_DATABASE_URL environment variable.");
  }
  const pool = new pg.Pool({ connectionString: databaseUrl });
  db = drizzle(pool);
  return db;
}

const userRoleEnum = pgEnum("user_role", ["member", "pro", "verified", "staff", "admin"]);
const userStatusEnum = pgEnum("user_status", ["active", "suspended", "deleted"]);
const profileVisibilityEnum = pgEnum("profile_visibility", ["public", "members", "private"]);
const contentStatusEnum = pgEnum("content_status", ["draft", "published", "archived"]);
const contentTypeEnum = pgEnum("content_type", [
  "project",
  "article",
  "guide",
  "blog",
  "explainer"
]);
const difficultyEnum = pgEnum("difficulty", ["beginner", "intermediate", "advanced"]);
const contentVisibilityEnum = pgEnum("content_visibility", ["public", "members", "private"]);
const likeTargetTypeEnum = pgEnum("like_target_type", [
  "project",
  "article",
  "blog",
  "explainer",
  "comment",
  "post",
  "guide"
]);
const commentTargetTypeEnum = pgEnum("comment_target_type", [
  "project",
  "article",
  "blog",
  "explainer",
  "post",
  "lesson"
]);
const bookmarkTargetTypeEnum = pgEnum("bookmark_target_type", [
  "project",
  "article",
  "blog",
  "explainer",
  "learning_path"
]);
const reportTargetTypeEnum = pgEnum("report_target_type", [
  "project",
  "article",
  "blog",
  "post",
  "comment",
  "user",
  "explainer"
]);
const reportReasonEnum = pgEnum("report_reason", [
  "spam",
  "harassment",
  "inappropriate",
  "copyright",
  "other"
]);
const reportStatusEnum = pgEnum("report_status", [
  "pending",
  "reviewed",
  "resolved",
  "dismissed"
]);
const notificationTypeEnum = pgEnum("notification_type", [
  "like",
  "comment",
  "follow",
  "mention",
  "contest",
  "certificate",
  "community",
  "system"
]);
const communityRoleEnum = pgEnum("community_role", [
  "owner",
  "admin",
  "moderator",
  "member"
]);
const communityJoinPolicyEnum = pgEnum("community_join_policy", [
  "open",
  "approval",
  "invite"
]);
const postTypeEnum = pgEnum("post_type", ["text", "link", "share", "poll"]);
const lessonTypeEnum = pgEnum("lesson_type", [
  "article",
  "video",
  "quiz",
  "project",
  "explainer"
]);
pgEnum("contest_status", [
  "upcoming",
  "active",
  "judging",
  "completed"
]);
pgEnum("video_platform", ["youtube", "vimeo", "other"]);
pgEnum("file_purpose", [
  "cover",
  "content",
  "avatar",
  "banner",
  "attachment"
]);
const activityDirectionEnum = pgEnum("activity_direction", ["inbound", "outbound"]);
const activityStatusEnum = pgEnum("activity_status", [
  "pending",
  "delivered",
  "failed",
  "processed"
]);
const followRelationshipStatusEnum = pgEnum("follow_relationship_status", [
  "pending",
  "accepted",
  "rejected"
]);
pgEnum("tag_category", [
  "platform",
  "language",
  "framework",
  "topic",
  "general"
]);

const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  displayUsername: varchar("display_username", { length: 64 }),
  displayName: varchar("display_name", { length: 128 }),
  bio: text("bio"),
  headline: varchar("headline", { length: 255 }),
  location: varchar("location", { length: 128 }),
  website: varchar("website", { length: 512 }),
  avatarUrl: text("avatar_url"),
  bannerUrl: text("banner_url"),
  socialLinks: jsonb("social_links").$type(),
  role: userRoleEnum("role").default("member").notNull(),
  status: userStatusEnum("status").default("active").notNull(),
  profileVisibility: profileVisibilityEnum("profile_visibility").default("public").notNull(),
  skills: jsonb("skills").$type(),
  theme: varchar("theme", { length: 64 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});
const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 512 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});
const accounts = pgTable("accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  providerId: varchar("provider_id", { length: 32 }).notNull(),
  accountId: varchar("account_id", { length: 255 }).notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  password: text("password"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});
const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  logoUrl: text("logo_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});
const members = pgTable("members", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 32 }).default("member").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
const federatedAccounts = pgTable("federated_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  actorUri: text("actor_uri").notNull().unique(),
  instanceDomain: varchar("instance_domain", { length: 255 }).notNull(),
  preferredUsername: varchar("preferred_username", { length: 64 }),
  displayName: varchar("display_name", { length: 128 }),
  avatarUrl: text("avatar_url"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
pgTable("oauth_clients", {
  id: uuid("id").defaultRandom().primaryKey(),
  clientId: varchar("client_id", { length: 255 }).notNull().unique(),
  clientSecret: varchar("client_secret", { length: 512 }).notNull(),
  redirectUris: jsonb("redirect_uris").$type().notNull(),
  instanceDomain: varchar("instance_domain", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
pgTable("oauth_codes", {
  code: varchar("code", { length: 255 }).primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  clientId: varchar("client_id", { length: 255 }).notNull(),
  redirectUri: text("redirect_uri").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
const verifications = pgTable("verifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  identifier: varchar("identifier", { length: 255 }).notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});
relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  members: many(members),
  federatedAccounts: many(federatedAccounts)
}));
relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] })
}));
relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] })
}));
relations(organizations, ({ many }) => ({
  members: many(members)
}));
relations(members, ({ one }) => ({
  organization: one(organizations, {
    fields: [members.organizationId],
    references: [organizations.id]
  }),
  user: one(users, { fields: [members.userId], references: [users.id] })
}));
relations(federatedAccounts, ({ one }) => ({
  user: one(users, { fields: [federatedAccounts.userId], references: [users.id] })
}));

const contentItems = pgTable("content_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  authorId: uuid("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: contentTypeEnum("type").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  subtitle: varchar("subtitle", { length: 255 }),
  description: text("description"),
  content: jsonb("content"),
  coverImageUrl: text("cover_image_url"),
  category: varchar("category", { length: 64 }),
  difficulty: difficultyEnum("difficulty"),
  buildTime: varchar("build_time", { length: 64 }),
  estimatedCost: varchar("estimated_cost", { length: 64 }),
  status: contentStatusEnum("status").default("draft").notNull(),
  visibility: contentVisibilityEnum("visibility").default("public").notNull(),
  isFeatured: boolean("is_featured").default(false).notNull(),
  seoDescription: varchar("seo_description", { length: 320 }),
  previewToken: varchar("preview_token", { length: 64 }),
  // Parts list (for projects)
  parts: jsonb("parts").$type(),
  // Explainer sections — validated at runtime via @commonpub/explainer schemas
  sections: jsonb("sections").$type(),
  // Counters (denormalized for read performance)
  viewCount: integer("view_count").default(0).notNull(),
  likeCount: integer("like_count").default(0).notNull(),
  commentCount: integer("comment_count").default(0).notNull(),
  forkCount: integer("fork_count").default(0).notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});
const contentForks = pgTable("content_forks", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourceId: uuid("source_id").notNull().references(() => contentItems.id, { onDelete: "cascade" }),
  forkId: uuid("fork_id").notNull().references(() => contentItems.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
const tags = pgTable("tags", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 64 }).notNull().unique(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  category: varchar("category", { length: 32 }),
  usageCount: integer("usage_count").default(0).notNull()
});
const contentTags = pgTable("content_tags", {
  id: uuid("id").defaultRandom().primaryKey(),
  contentId: uuid("content_id").notNull().references(() => contentItems.id, { onDelete: "cascade" }),
  tagId: uuid("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" })
});
relations(contentItems, ({ one, many }) => ({
  author: one(users, { fields: [contentItems.authorId], references: [users.id] }),
  tags: many(contentTags),
  forksFrom: many(contentForks, { relationName: "forkSource" }),
  forksTo: many(contentForks, { relationName: "forkTarget" })
}));
relations(contentForks, ({ one }) => ({
  source: one(contentItems, {
    fields: [contentForks.sourceId],
    references: [contentItems.id],
    relationName: "forkSource"
  }),
  fork: one(contentItems, {
    fields: [contentForks.forkId],
    references: [contentItems.id],
    relationName: "forkTarget"
  })
}));
relations(tags, ({ many }) => ({
  contentTags: many(contentTags)
}));
relations(contentTags, ({ one }) => ({
  content: one(contentItems, { fields: [contentTags.contentId], references: [contentItems.id] }),
  tag: one(tags, { fields: [contentTags.tagId], references: [tags.id] })
}));

const likes = pgTable("likes", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  targetType: likeTargetTypeEnum("target_type").notNull(),
  targetId: uuid("target_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, (t) => [unique("likes_user_target").on(t.userId, t.targetType, t.targetId)]);
const follows = pgTable("follows", {
  id: uuid("id").defaultRandom().primaryKey(),
  followerId: uuid("follower_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  followingId: uuid("following_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, (t) => [unique("follows_pair").on(t.followerId, t.followingId)]);
const comments = pgTable("comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  authorId: uuid("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  targetType: commentTargetTypeEnum("target_type").notNull(),
  targetId: uuid("target_id").notNull(),
  parentId: uuid("parent_id"),
  content: text("content").notNull(),
  likeCount: integer("like_count").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});
const bookmarks = pgTable("bookmarks", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  targetType: bookmarkTargetTypeEnum("target_type").notNull(),
  targetId: uuid("target_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, (t) => [unique("bookmarks_user_target").on(t.userId, t.targetType, t.targetId)]);
const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: notificationTypeEnum("type").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  link: varchar("link", { length: 512 }),
  actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
  read: boolean("read").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
const reports = pgTable("reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  reporterId: uuid("reporter_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  targetType: reportTargetTypeEnum("target_type").notNull(),
  targetId: uuid("target_id").notNull(),
  reason: reportReasonEnum("reason").notNull(),
  description: text("description"),
  status: reportStatusEnum("status").default("pending").notNull(),
  reviewedById: uuid("reviewed_by_id").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  resolution: text("resolution"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
const conversations = pgTable("conversations", {
  id: uuid("id").defaultRandom().primaryKey(),
  participants: jsonb("participants").$type().notNull(),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }).defaultNow().notNull(),
  lastMessage: text("last_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  senderId: uuid("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  readAt: timestamp("read_at", { withTimezone: true })
});
relations(likes, ({ one }) => ({
  user: one(users, { fields: [likes.userId], references: [users.id] })
}));
relations(follows, ({ one }) => ({
  follower: one(users, {
    fields: [follows.followerId],
    references: [users.id],
    relationName: "follower"
  }),
  following: one(users, {
    fields: [follows.followingId],
    references: [users.id],
    relationName: "following"
  })
}));
relations(comments, ({ one, many }) => ({
  author: one(users, { fields: [comments.authorId], references: [users.id] }),
  parent: one(comments, {
    fields: [comments.parentId],
    references: [comments.id],
    relationName: "thread"
  }),
  replies: many(comments, { relationName: "thread" })
}));
relations(bookmarks, ({ one }) => ({
  user: one(users, { fields: [bookmarks.userId], references: [users.id] })
}));
relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
  actor: one(users, { fields: [notifications.actorId], references: [users.id] })
}));
relations(reports, ({ one }) => ({
  reporter: one(users, { fields: [reports.reporterId], references: [users.id] }),
  reviewer: one(users, { fields: [reports.reviewedById], references: [users.id] })
}));
relations(conversations, ({ many }) => ({
  messages: many(messages)
}));
relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id]
  }),
  sender: one(users, { fields: [messages.senderId], references: [users.id] })
}));

const communities = pgTable("communities", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  description: text("description"),
  rules: text("rules"),
  iconUrl: text("icon_url"),
  bannerUrl: text("banner_url"),
  joinPolicy: communityJoinPolicyEnum("join_policy").default("open").notNull(),
  createdById: uuid("created_by_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  isOfficial: boolean("is_official").default(false).notNull(),
  memberCount: integer("member_count").default(0).notNull(),
  postCount: integer("post_count").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});
const communityMembers = pgTable("community_members", {
  communityId: uuid("community_id").notNull().references(() => communities.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: communityRoleEnum("role").default("member").notNull(),
  joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull()
}, (t) => [primaryKey({ columns: [t.communityId, t.userId] })]);
const communityPosts = pgTable("community_posts", {
  id: uuid("id").defaultRandom().primaryKey(),
  communityId: uuid("community_id").notNull().references(() => communities.id, { onDelete: "cascade" }),
  authorId: uuid("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: postTypeEnum("type").default("text").notNull(),
  content: text("content").notNull(),
  isPinned: boolean("is_pinned").default(false).notNull(),
  isLocked: boolean("is_locked").default(false).notNull(),
  likeCount: integer("like_count").default(0).notNull(),
  replyCount: integer("reply_count").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});
const communityPostReplies = pgTable("community_post_replies", {
  id: uuid("id").defaultRandom().primaryKey(),
  postId: uuid("post_id").notNull().references(() => communityPosts.id, { onDelete: "cascade" }),
  authorId: uuid("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  parentId: uuid("parent_id"),
  content: text("content").notNull(),
  likeCount: integer("like_count").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});
const communityBans = pgTable("community_bans", {
  id: uuid("id").defaultRandom().primaryKey(),
  communityId: uuid("community_id").notNull().references(() => communities.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  bannedById: uuid("banned_by_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  reason: text("reason"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
const communityInvites = pgTable("community_invites", {
  id: uuid("id").defaultRandom().primaryKey(),
  communityId: uuid("community_id").notNull().references(() => communities.id, { onDelete: "cascade" }),
  createdById: uuid("created_by_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 64 }).notNull().unique(),
  maxUses: integer("max_uses"),
  useCount: integer("use_count").default(0).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
const communityShares = pgTable("community_shares", {
  id: uuid("id").defaultRandom().primaryKey(),
  communityId: uuid("community_id").notNull().references(() => communities.id, { onDelete: "cascade" }),
  contentId: uuid("content_id").notNull().references(() => contentItems.id, { onDelete: "cascade" }),
  sharedById: uuid("shared_by_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
relations(communities, ({ one, many }) => ({
  createdBy: one(users, { fields: [communities.createdById], references: [users.id] }),
  members: many(communityMembers),
  posts: many(communityPosts),
  bans: many(communityBans),
  invites: many(communityInvites),
  shares: many(communityShares)
}));
relations(communityMembers, ({ one }) => ({
  community: one(communities, {
    fields: [communityMembers.communityId],
    references: [communities.id]
  }),
  user: one(users, { fields: [communityMembers.userId], references: [users.id] })
}));
relations(communityPosts, ({ one, many }) => ({
  community: one(communities, {
    fields: [communityPosts.communityId],
    references: [communities.id]
  }),
  author: one(users, { fields: [communityPosts.authorId], references: [users.id] }),
  replies: many(communityPostReplies)
}));
relations(communityPostReplies, ({ one, many }) => ({
  post: one(communityPosts, {
    fields: [communityPostReplies.postId],
    references: [communityPosts.id]
  }),
  author: one(users, { fields: [communityPostReplies.authorId], references: [users.id] }),
  parent: one(communityPostReplies, {
    fields: [communityPostReplies.parentId],
    references: [communityPostReplies.id],
    relationName: "replyThread"
  }),
  children: many(communityPostReplies, { relationName: "replyThread" })
}));
relations(communityBans, ({ one }) => ({
  community: one(communities, {
    fields: [communityBans.communityId],
    references: [communities.id]
  }),
  user: one(users, { fields: [communityBans.userId], references: [users.id] }),
  bannedBy: one(users, { fields: [communityBans.bannedById], references: [users.id] })
}));
relations(communityInvites, ({ one }) => ({
  community: one(communities, {
    fields: [communityInvites.communityId],
    references: [communities.id]
  }),
  createdBy: one(users, { fields: [communityInvites.createdById], references: [users.id] })
}));
relations(communityShares, ({ one }) => ({
  community: one(communities, {
    fields: [communityShares.communityId],
    references: [communities.id]
  }),
  content: one(contentItems, {
    fields: [communityShares.contentId],
    references: [contentItems.id]
  }),
  sharedBy: one(users, { fields: [communityShares.sharedById], references: [users.id] })
}));

const learningPaths = pgTable("learning_paths", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  description: text("description"),
  coverImageUrl: text("cover_image_url"),
  difficulty: difficultyEnum("difficulty"),
  estimatedHours: numeric("estimated_hours", { precision: 5, scale: 1 }),
  authorId: uuid("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: contentStatusEnum("status").default("draft").notNull(),
  enrollmentCount: integer("enrollment_count").default(0).notNull(),
  completionCount: integer("completion_count").default(0).notNull(),
  averageRating: numeric("average_rating", { precision: 3, scale: 2 }),
  reviewCount: integer("review_count").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});
const learningModules = pgTable("learning_modules", {
  id: uuid("id").defaultRandom().primaryKey(),
  pathId: uuid("path_id").notNull().references(() => learningPaths.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
const learningLessons = pgTable("learning_lessons", {
  id: uuid("id").defaultRandom().primaryKey(),
  moduleId: uuid("module_id").notNull().references(() => learningModules.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull(),
  type: lessonTypeEnum("type").notNull(),
  content: jsonb("content"),
  duration: integer("duration_minutes"),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});
const enrollments = pgTable("enrollments", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  pathId: uuid("path_id").notNull().references(() => learningPaths.id, { onDelete: "cascade" }),
  progress: numeric("progress", { precision: 5, scale: 2 }).default("0").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true })
});
const lessonProgress = pgTable("lesson_progress", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  lessonId: uuid("lesson_id").notNull().references(() => learningLessons.id, { onDelete: "cascade" }),
  completed: boolean("completed").default(false).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  quizScore: numeric("quiz_score", { precision: 5, scale: 2 }),
  quizPassed: boolean("quiz_passed")
});
const certificates = pgTable("certificates", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  pathId: uuid("path_id").notNull().references(() => learningPaths.id, { onDelete: "cascade" }),
  verificationCode: varchar("verification_code", { length: 64 }).notNull().unique(),
  certificateUrl: text("certificate_url"),
  issuedAt: timestamp("issued_at", { withTimezone: true }).defaultNow().notNull()
});
relations(learningPaths, ({ one, many }) => ({
  author: one(users, { fields: [learningPaths.authorId], references: [users.id] }),
  modules: many(learningModules),
  enrollments: many(enrollments),
  certificates: many(certificates)
}));
relations(learningModules, ({ one, many }) => ({
  path: one(learningPaths, { fields: [learningModules.pathId], references: [learningPaths.id] }),
  lessons: many(learningLessons)
}));
relations(learningLessons, ({ one }) => ({
  module: one(learningModules, {
    fields: [learningLessons.moduleId],
    references: [learningModules.id]
  })
}));
relations(enrollments, ({ one }) => ({
  user: one(users, { fields: [enrollments.userId], references: [users.id] }),
  path: one(learningPaths, { fields: [enrollments.pathId], references: [learningPaths.id] })
}));
relations(lessonProgress, ({ one }) => ({
  user: one(users, { fields: [lessonProgress.userId], references: [users.id] }),
  lesson: one(learningLessons, {
    fields: [lessonProgress.lessonId],
    references: [learningLessons.id]
  })
}));
relations(certificates, ({ one }) => ({
  user: one(users, { fields: [certificates.userId], references: [users.id] }),
  path: one(learningPaths, { fields: [certificates.pathId], references: [learningPaths.id] })
}));

const docsSites = pgTable("docs_sites", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  description: text("description"),
  ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  themeTokens: jsonb("theme_tokens").$type(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});
const docsVersions = pgTable("docs_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  siteId: uuid("site_id").notNull().references(() => docsSites.id, { onDelete: "cascade" }),
  version: varchar("version", { length: 32 }).notNull(),
  isDefault: integer("is_default").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
const docsPages = pgTable("docs_pages", {
  id: uuid("id").defaultRandom().primaryKey(),
  versionId: uuid("version_id").notNull().references(() => docsVersions.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull(),
  content: text("content").notNull(),
  // Raw markdown (Standing Rule #4)
  sortOrder: integer("sort_order").default(0).notNull(),
  parentId: uuid("parent_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});
const docsNav = pgTable("docs_nav", {
  id: uuid("id").defaultRandom().primaryKey(),
  versionId: uuid("version_id").notNull().references(() => docsVersions.id, { onDelete: "cascade" }),
  structure: jsonb("structure").$type(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});
relations(docsSites, ({ one, many }) => ({
  owner: one(users, { fields: [docsSites.ownerId], references: [users.id] }),
  versions: many(docsVersions)
}));
relations(docsVersions, ({ one, many }) => ({
  site: one(docsSites, { fields: [docsVersions.siteId], references: [docsSites.id] }),
  pages: many(docsPages),
  nav: many(docsNav)
}));
relations(docsPages, ({ one, many }) => ({
  version: one(docsVersions, { fields: [docsPages.versionId], references: [docsVersions.id] }),
  parent: one(docsPages, {
    fields: [docsPages.parentId],
    references: [docsPages.id],
    relationName: "pageHierarchy"
  }),
  children: many(docsPages, { relationName: "pageHierarchy" })
}));
relations(docsNav, ({ one }) => ({
  version: one(docsVersions, { fields: [docsNav.versionId], references: [docsVersions.id] })
}));

pgTable("remote_actors", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorUri: text("actor_uri").notNull().unique(),
  inbox: text("inbox").notNull(),
  outbox: text("outbox"),
  publicKeyPem: text("public_key_pem"),
  preferredUsername: varchar("preferred_username", { length: 64 }),
  displayName: varchar("display_name", { length: 128 }),
  avatarUrl: text("avatar_url"),
  instanceDomain: varchar("instance_domain", { length: 255 }).notNull(),
  lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
const activities = pgTable("activities", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: varchar("type", { length: 64 }).notNull(),
  actorUri: text("actor_uri").notNull(),
  objectUri: text("object_uri"),
  payload: jsonb("payload").notNull(),
  direction: activityDirectionEnum("direction").notNull(),
  status: activityStatusEnum("status").default("pending").notNull(),
  attempts: integer("attempts").default(0).notNull(),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});
const followRelationships = pgTable("follow_relationships", {
  id: uuid("id").defaultRandom().primaryKey(),
  followerActorUri: text("follower_actor_uri").notNull(),
  followingActorUri: text("following_actor_uri").notNull(),
  status: followRelationshipStatusEnum("status").default("pending").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});
const actorKeypairs = pgTable("actor_keypairs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  publicKeyPem: text("public_key_pem").notNull(),
  privateKeyPem: text("private_key_pem").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
relations(actorKeypairs, ({ one }) => ({
  user: one(users, { fields: [actorKeypairs.userId], references: [users.id] })
}));

const instanceSettings = pgTable("instance_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: varchar("key", { length: 128 }).notNull().unique(),
  value: jsonb("value").notNull(),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});
const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  action: varchar("action", { length: 64 }).notNull(),
  targetType: varchar("target_type", { length: 64 }).notNull(),
  targetId: varchar("target_id", { length: 255 }),
  metadata: jsonb("metadata"),
  ipAddress: varchar("ip_address", { length: 45 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
relations(instanceSettings, ({ one }) => ({
  updater: one(users, { fields: [instanceSettings.updatedBy], references: [users.id] })
}));
relations(auditLogs, ({ one }) => ({
  user: one(users, { fields: [auditLogs.userId], references: [users.id] })
}));

function createAuth({ config, db, secret, baseURL }) {
  const plugins = [username()];
  const socialProviders = {};
  if (config.auth.github) {
    socialProviders.github = {
      clientId: config.auth.github.clientId,
      clientSecret: config.auth.github.clientSecret
    };
  }
  if (config.auth.google) {
    socialProviders.google = {
      clientId: config.auth.google.clientId,
      clientSecret: config.auth.google.clientSecret
    };
  }
  return betterAuth({
    secret,
    baseURL: baseURL != null ? baseURL : `https://${config.instance.domain}`,
    basePath: "/api/auth",
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: users,
        session: sessions,
        account: accounts,
        verification: verifications
      }
    }),
    user: {
      fields: {
        name: "displayName",
        image: "avatarUrl"
      }
    },
    emailAndPassword: {
      enabled: config.auth.emailPassword
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24
    },
    advanced: {
      database: {
        generateId: "uuid"
      }
    },
    socialProviders,
    plugins
  });
}

function createAuthMiddleware({ auth, authPathPrefix = "/api/auth" }) {
  return {
    async handleAuthRoute(request, pathname) {
      if (pathname.startsWith(authPathPrefix)) {
        return auth.handler(request);
      }
      return null;
    },
    async resolveSession(headers) {
      try {
        const session = await auth.api.getSession({ headers });
        if (session) {
          return {
            user: session.user,
            session: session.session
          };
        }
      } catch {
      }
      return { user: null, session: null };
    }
  };
}

let authMiddleware = null;
function getAuthMiddleware() {
  var _a;
  if (authMiddleware) return authMiddleware;
  const config = useConfig();
  const db = useDB();
  const runtimeConfig = useRuntimeConfig();
  const auth = createAuth({
    config,
    db,
    secret: runtimeConfig.authSecret || "dev-secret-change-me",
    baseURL: ((_a = runtimeConfig.public) == null ? void 0 : _a.siteUrl) || `https://${config.instance.domain}`
  });
  authMiddleware = createAuthMiddleware({ auth });
  return authMiddleware;
}
const _KEWnTz = defineEventHandler(async (event) => {
  const middleware = getAuthMiddleware();
  const pathname = getRequestURL(event).pathname;
  if (pathname.startsWith("/api/auth")) {
    const response = await middleware.handleAuthRoute(
      toWebRequest(event),
      pathname
    );
    if (response) {
      return sendWebResponse(event, response);
    }
  }
  const headers = getRequestHeaders(event);
  const webHeaders = new Headers(headers);
  event.context.auth = await middleware.resolveSession(webHeaders);
});

function generateSlug(text) {
  return text.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100);
}
async function ensureUniqueSlug(db, slug, excludeId) {
  if (!slug) {
    slug = `untitled-${Date.now()}`;
  }
  const conditions = [eq(contentItems.slug, slug)];
  if (excludeId) {
    const { ne } = await import('drizzle-orm');
    conditions.push(ne(contentItems.id, excludeId));
  }
  const existing = await db.select({ id: contentItems.id }).from(contentItems).where(and(...conditions)).limit(1);
  if (existing.length === 0)
    return slug;
  return `${slug}-${Date.now()}`;
}
const ROLE_HIERARCHY = {
  owner: 4,
  admin: 3,
  moderator: 2,
  member: 1
};
const PERMISSION_MAP = {
  editCommunity: 3,
  // admin+
  manageMembers: 3,
  // admin+
  banUser: 2,
  // moderator+
  kickMember: 2,
  // moderator+
  deletePost: 2,
  // moderator+
  pinPost: 2,
  // moderator+
  lockPost: 2
  // moderator+
};
function hasPermission(role, permission) {
  var _a, _b;
  const roleLevel = (_a = ROLE_HIERARCHY[role]) != null ? _a : 0;
  const requiredLevel = (_b = PERMISSION_MAP[permission]) != null ? _b : Infinity;
  return roleLevel >= requiredLevel;
}
function canManageRole(actorRole, targetRole) {
  var _a, _b;
  const actorLevel = (_a = ROLE_HIERARCHY[actorRole]) != null ? _a : 0;
  const targetLevel = (_b = ROLE_HIERARCHY[targetRole]) != null ? _b : 0;
  return actorLevel > targetLevel;
}

function parseWebFingerResource(resource) {
  const acctPrefix = "acct:";
  const input = resource.startsWith(acctPrefix) ? resource.slice(acctPrefix.length) : resource;
  const atIndex = input.indexOf("@");
  if (atIndex === -1 || atIndex === 0 || atIndex === input.length - 1) {
    return null;
  }
  const username = input.slice(0, atIndex);
  const domain = input.slice(atIndex + 1);
  if (!username || !domain || domain.includes("@")) {
    return null;
  }
  return { username, domain };
}
function buildWebFingerResponse(options) {
  const { username, domain, actorUri, oauthEndpoint } = options;
  const links = [
    {
      rel: "self",
      type: "application/activity+json",
      href: actorUri
    },
    {
      rel: "http://webfinger.net/rel/profile-page",
      type: "text/html",
      href: `https://${domain}/@${username}`
    }
  ];
  if (oauthEndpoint) {
    links.push({
      rel: "oauth_endpoint",
      href: oauthEndpoint
    });
  }
  return {
    subject: `acct:${username}@${domain}`,
    links
  };
}

function buildNodeInfoResponse(options) {
  const { config, version, userCount, activeMonthCount, localPostCount } = options;
  const protocols = [];
  if (config.features.federation) {
    protocols.push("activitypub");
  }
  return {
    version: "2.1",
    software: {
      name: "commonpub",
      version,
      repository: "https://github.com/commonpub/commonpub",
      homepage: `https://${config.instance.domain}`
    },
    protocols,
    usage: {
      users: {
        total: userCount,
        activeMonth: activeMonthCount
      },
      localPosts: localPostCount
    },
    openRegistrations: config.auth.emailPassword,
    metadata: {
      nodeName: config.instance.name,
      nodeDescription: config.instance.description,
      features: {
        communities: config.features.communities,
        docs: config.features.docs,
        video: config.features.video,
        contests: config.features.contests,
        learning: config.features.learning,
        explainers: config.features.explainers
      }
    }
  };
}

const AP_CONTEXT = "https://www.w3.org/ns/activitystreams";
const AP_PUBLIC = "https://www.w3.org/ns/activitystreams#Public";

function activityId(domain) {
  return `https://${domain}/activities/${crypto.randomUUID()}`;
}
function buildCreateActivity(domain, actorUri, object) {
  return {
    "@context": AP_CONTEXT,
    type: "Create",
    id: activityId(domain),
    actor: actorUri,
    object,
    to: object.to,
    cc: object.cc,
    published: (/* @__PURE__ */ new Date()).toISOString()
  };
}

function contentToArticle(item, author, domain) {
  var _a;
  const actorUri = `https://${domain}/users/${author.username}`;
  const objectId = `https://${domain}/content/${item.slug}`;
  const followersUri = `${actorUri}/followers`;
  const tags = [];
  const article = {
    "@context": AP_CONTEXT,
    type: "Article",
    id: objectId,
    attributedTo: actorUri,
    name: item.title,
    content: typeof item.content === "string" ? item.content : JSON.stringify((_a = item.content) != null ? _a : ""),
    to: [AP_PUBLIC],
    cc: [followersUri]
  };
  if (item.description) {
    article.summary = item.description;
  }
  if (item.publishedAt) {
    article.published = item.publishedAt.toISOString();
  }
  if (item.updatedAt) {
    article.updated = item.updatedAt.toISOString();
  }
  if (item.coverImageUrl) {
    article.attachment = [{ type: "Image", url: item.coverImageUrl, name: "Cover image" }];
  }
  article.url = `https://${domain}/${item.type}/${item.slug}`;
  if (tags.length > 0) {
    article.tag = tags;
  }
  return article;
}

async function generateKeypair() {
  const { publicKey, privateKey } = await generateKeyPair("RS256", {
    modulusLength: 2048,
    extractable: true
  });
  return { publicKey, privateKey };
}
async function exportPublicKeyPem(keypair) {
  return exportSPKI(keypair.publicKey);
}
async function exportPrivateKeyPem(keypair) {
  return exportPKCS8(keypair.privateKey);
}

async function processInboxActivity(activity, callbacks) {
  const type = activity.type;
  const actor = activity.actor;
  if (!type || !actor) {
    return { success: false, error: "Missing type or actor" };
  }
  switch (type) {
    case "Follow": {
      const object = activity.object;
      if (!object)
        return { success: false, error: "Follow missing object" };
      await callbacks.onFollow(actor, object, activity.id);
      return { success: true };
    }
    case "Accept": {
      const objectId = extractObjectId(activity.object);
      if (!objectId)
        return { success: false, error: "Accept missing object" };
      await callbacks.onAccept(actor, objectId);
      return { success: true };
    }
    case "Reject": {
      const objectId = extractObjectId(activity.object);
      if (!objectId)
        return { success: false, error: "Reject missing object" };
      await callbacks.onReject(actor, objectId);
      return { success: true };
    }
    case "Undo": {
      const obj = activity.object;
      if (typeof obj === "string") {
        await callbacks.onUndo(actor, "unknown", obj);
      } else if (obj && typeof obj === "object") {
        const inner = obj;
        await callbacks.onUndo(actor, inner.type, inner.id);
      } else {
        return { success: false, error: "Undo missing object" };
      }
      return { success: true };
    }
    case "Create": {
      const obj = activity.object;
      if (!obj || typeof obj !== "object")
        return { success: false, error: "Create missing object" };
      await callbacks.onCreate(actor, obj);
      return { success: true };
    }
    case "Update": {
      const obj = activity.object;
      if (!obj || typeof obj !== "object")
        return { success: false, error: "Update missing object" };
      await callbacks.onUpdate(actor, obj);
      return { success: true };
    }
    case "Delete": {
      const objectId = extractObjectId(activity.object);
      if (!objectId)
        return { success: false, error: "Delete missing object" };
      await callbacks.onDelete(actor, objectId);
      return { success: true };
    }
    case "Like": {
      const object = activity.object;
      if (!object)
        return { success: false, error: "Like missing object" };
      await callbacks.onLike(actor, object);
      return { success: true };
    }
    case "Announce": {
      const object = activity.object;
      if (!object)
        return { success: false, error: "Announce missing object" };
      await callbacks.onAnnounce(actor, object);
      return { success: true };
    }
    default:
      return { success: false, error: `Unsupported activity type: ${type}` };
  }
}
function extractObjectId(object) {
  var _a;
  if (typeof object === "string")
    return object;
  if (object && typeof object === "object") {
    return (_a = object.id) != null ? _a : null;
  }
  return null;
}

function generateOutboxCollection(totalItems, domain, username) {
  const baseUri = `https://${domain}/users/${username}/outbox`;
  return {
    "@context": AP_CONTEXT,
    type: "OrderedCollection",
    id: baseUri,
    totalItems,
    first: `${baseUri}?page=1`,
    last: `${baseUri}?page=last`
  };
}

async function getOrCreateActorKeypair(db, userId) {
  const existing = await db.select().from(actorKeypairs).where(eq(actorKeypairs.userId, userId)).limit(1);
  if (existing.length > 0) {
    return {
      publicKeyPem: existing[0].publicKeyPem,
      privateKeyPem: existing[0].privateKeyPem
    };
  }
  const keypair = await generateKeypair();
  const publicKeyPem = await exportPublicKeyPem(keypair);
  const privateKeyPem = await exportPrivateKeyPem(keypair);
  await db.insert(actorKeypairs).values({
    userId,
    publicKeyPem,
    privateKeyPem
  });
  return { publicKeyPem, privateKeyPem };
}
async function federateContent(db, contentId, domain) {
  const rows = await db.select({
    content: contentItems,
    author: { username: users.username, displayName: users.displayName }
  }).from(contentItems).innerJoin(users, eq(contentItems.authorId, users.id)).where(eq(contentItems.id, contentId)).limit(1);
  if (!rows[0])
    return;
  const { content, author } = rows[0];
  const actorUri = `https://${domain}/users/${author.username}`;
  const article = contentToArticle(content, author, domain);
  const activity = buildCreateActivity(domain, actorUri, article);
  await db.insert(activities).values({
    type: "Create",
    actorUri,
    objectUri: article.id,
    payload: activity,
    direction: "outbound",
    status: "pending"
  });
}
async function getFollowers(db, actorUri) {
  return db.select({
    followerActorUri: followRelationships.followerActorUri,
    status: followRelationships.status
  }).from(followRelationships).where(and(eq(followRelationships.followingActorUri, actorUri), eq(followRelationships.status, "accepted")));
}
async function getFollowing(db, actorUri) {
  return db.select({
    followingActorUri: followRelationships.followingActorUri,
    status: followRelationships.status
  }).from(followRelationships).where(and(eq(followRelationships.followerActorUri, actorUri), eq(followRelationships.status, "accepted")));
}

function mapToListItem(row, author) {
  const item = row;
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    slug: item.slug,
    description: item.description,
    coverImageUrl: item.coverImageUrl,
    status: item.status,
    difficulty: item.difficulty,
    viewCount: item.viewCount,
    likeCount: item.likeCount,
    commentCount: item.commentCount,
    publishedAt: item.publishedAt,
    createdAt: item.createdAt,
    author: {
      id: author.id,
      username: author.username,
      displayName: author.displayName,
      avatarUrl: author.avatarUrl
    }
  };
}
async function listContent(db, filters = {}) {
  var _a, _b, _c, _d;
  const conditions = [];
  if (filters.status) {
    conditions.push(eq(contentItems.status, filters.status));
  }
  if (filters.type) {
    conditions.push(eq(contentItems.type, filters.type));
  }
  if (filters.authorId) {
    conditions.push(eq(contentItems.authorId, filters.authorId));
  }
  if (filters.featured) {
    conditions.push(eq(contentItems.isFeatured, true));
  }
  if (filters.difficulty) {
    conditions.push(eq(contentItems.difficulty, filters.difficulty));
  }
  if (filters.search) {
    const searchPattern = `%${filters.search}%`;
    conditions.push(sql`(${contentItems.title} ILIKE ${searchPattern} OR ${contentItems.description} ILIKE ${searchPattern})`);
  }
  if (filters.tag) {
    conditions.push(sql`${contentItems.id} IN (
        SELECT ${contentTags.contentId} FROM ${contentTags}
        INNER JOIN ${tags} ON ${tags.id} = ${contentTags.tagId}
        WHERE ${tags.slug} = ${filters.tag}
      )`);
  }
  const where = conditions.length > 0 ? and(...conditions) : void 0;
  const limit = Math.min((_a = filters.limit) != null ? _a : 20, 100);
  const offset = (_b = filters.offset) != null ? _b : 0;
  const [rows, countResult] = await Promise.all([
    db.select({
      content: contentItems,
      author: {
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl
      }
    }).from(contentItems).innerJoin(users, eq(contentItems.authorId, users.id)).where(where).orderBy(...filters.sort === "popular" ? [desc(contentItems.viewCount)] : filters.sort === "featured" ? [desc(contentItems.isFeatured), desc(contentItems.createdAt)] : [desc(contentItems.publishedAt), desc(contentItems.createdAt)]).limit(limit).offset(offset),
    db.select({ count: sql`count(*)::int` }).from(contentItems).where(where)
  ]);
  const items = rows.map((row) => mapToListItem(row.content, row.author));
  const total = (_d = (_c = countResult[0]) == null ? void 0 : _c.count) != null ? _d : 0;
  return { items, total };
}
async function getContentBySlug(db, slug, requesterId) {
  const rows = await db.select({
    content: contentItems,
    author: {
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl
    }
  }).from(contentItems).innerJoin(users, eq(contentItems.authorId, users.id)).where(eq(contentItems.slug, slug)).limit(1);
  if (rows.length === 0)
    return null;
  const row = rows[0];
  const item = row.content;
  if (item.status !== "published" && item.authorId !== requesterId) {
    return null;
  }
  const itemTags = await db.select({
    id: tags.id,
    name: tags.name,
    slug: tags.slug
  }).from(contentTags).innerJoin(tags, eq(contentTags.tagId, tags.id)).where(eq(contentTags.contentId, item.id));
  return {
    ...mapToListItem(item, row.author),
    subtitle: item.subtitle,
    content: item.content,
    category: item.category,
    buildTime: item.buildTime,
    estimatedCost: item.estimatedCost,
    visibility: item.visibility,
    isFeatured: item.isFeatured,
    seoDescription: item.seoDescription,
    previewToken: item.previewToken,
    parts: item.parts,
    sections: item.sections,
    forkCount: item.forkCount,
    updatedAt: item.updatedAt,
    tags: itemTags
  };
}
async function createContent(db, authorId, input) {
  var _a, _b, _c, _d, _e, _f, _g, _h;
  const slug = await ensureUniqueSlug(db, generateSlug(input.title));
  const previewToken = crypto.randomUUID().replace(/-/g, "");
  const [item] = await db.insert(contentItems).values({
    authorId,
    type: input.type,
    title: input.title,
    slug,
    subtitle: (_a = input.subtitle) != null ? _a : null,
    description: (_b = input.description) != null ? _b : null,
    content: (_c = input.content) != null ? _c : null,
    coverImageUrl: (_d = input.coverImageUrl) != null ? _d : null,
    category: (_e = input.category) != null ? _e : null,
    difficulty: (_f = input.difficulty) != null ? _f : null,
    sections: (_g = input.sections) != null ? _g : null,
    status: "draft",
    previewToken
  }).returning();
  if ((_h = input.tags) == null ? void 0 : _h.length) {
    await syncTags(db, item.id, input.tags);
  }
  return await getContentBySlug(db, item.slug, authorId);
}
async function updateContent(db, contentId, authorId, input) {
  var _a;
  const existing = await db.select().from(contentItems).where(and(eq(contentItems.id, contentId), eq(contentItems.authorId, authorId))).limit(1);
  if (existing.length === 0)
    return null;
  const current = existing[0];
  const updates = {
    updatedAt: /* @__PURE__ */ new Date()
  };
  if (input.title !== void 0) {
    updates.title = input.title;
    if (input.title !== current.title) {
      updates.slug = await ensureUniqueSlug(db, generateSlug(input.title), contentId);
    }
  }
  if (input.subtitle !== void 0)
    updates.subtitle = input.subtitle;
  if (input.description !== void 0)
    updates.description = input.description;
  if (input.content !== void 0)
    updates.content = input.content;
  if (input.coverImageUrl !== void 0)
    updates.coverImageUrl = input.coverImageUrl;
  if (input.category !== void 0)
    updates.category = input.category;
  if (input.difficulty !== void 0)
    updates.difficulty = input.difficulty;
  if (input.seoDescription !== void 0)
    updates.seoDescription = input.seoDescription;
  if (input.sections !== void 0)
    updates.sections = input.sections;
  if (input.status !== void 0) {
    updates.status = input.status;
    if (input.status === "published" && !current.publishedAt) {
      updates.publishedAt = /* @__PURE__ */ new Date();
    }
  }
  await db.update(contentItems).set(updates).where(eq(contentItems.id, contentId));
  if (input.tags !== void 0) {
    await syncTags(db, contentId, input.tags);
  }
  const slug = (_a = updates.slug) != null ? _a : current.slug;
  return await getContentBySlug(db, slug, authorId);
}
async function deleteContent(db, contentId, authorId) {
  var _a;
  const result = await db.update(contentItems).set({ status: "archived", updatedAt: /* @__PURE__ */ new Date() }).where(and(eq(contentItems.id, contentId), eq(contentItems.authorId, authorId)));
  return ((_a = result.rowCount) != null ? _a : 0) > 0;
}
async function publishContent(db, contentId, authorId) {
  return updateContent(db, contentId, authorId, { status: "published" });
}
async function incrementViewCount(db, contentId) {
  await db.update(contentItems).set({ viewCount: sql`${contentItems.viewCount} + 1` }).where(eq(contentItems.id, contentId));
}
async function syncTags(db, contentId, tagNames) {
  await db.delete(contentTags).where(eq(contentTags.contentId, contentId));
  if (tagNames.length === 0)
    return;
  const tagRows = [];
  for (const name of tagNames) {
    const slug = generateSlug(name);
    if (!slug)
      continue;
    const existing = await db.select().from(tags).where(eq(tags.slug, slug)).limit(1);
    if (existing.length > 0) {
      tagRows.push(existing[0]);
    } else {
      const [newTag] = await db.insert(tags).values({ name, slug }).returning();
      tagRows.push(newTag);
    }
  }
  if (tagRows.length > 0) {
    await db.insert(contentTags).values(tagRows.map((tag) => ({ contentId, tagId: tag.id })));
  }
}
async function onContentPublished(db, contentId, config) {
  if (!config.features.federation)
    return;
  await federateContent(db, contentId, config.instance.domain).catch((err) => {
    console.error("[federation]", err);
  });
}

async function ensureUniqueCommunitySlug(db, slug, excludeId) {
  if (!slug)
    slug = `community-${Date.now()}`;
  const conditions = [eq(communities.slug, slug)];
  const existing = await db.select({ id: communities.id }).from(communities).where(and(...conditions)).limit(1);
  if (existing.length === 0)
    return slug;
  return `${slug}-${Date.now()}`;
}
async function listCommunities(db, filters = {}) {
  var _a, _b, _c, _d;
  const conditions = [];
  if (filters.search) {
    conditions.push(ilike(communities.name, `%${filters.search}%`));
  }
  if (filters.joinPolicy) {
    conditions.push(eq(communities.joinPolicy, filters.joinPolicy));
  }
  const where = conditions.length > 0 ? and(...conditions) : void 0;
  const limit = Math.min((_a = filters.limit) != null ? _a : 20, 100);
  const offset = (_b = filters.offset) != null ? _b : 0;
  const [rows, countResult] = await Promise.all([
    db.select({
      community: communities,
      createdBy: {
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl
      }
    }).from(communities).innerJoin(users, eq(communities.createdById, users.id)).where(where).orderBy(desc(communities.createdAt)).limit(limit).offset(offset),
    db.select({ count: sql`count(*)::int` }).from(communities).where(where)
  ]);
  const items = rows.map((row) => ({
    id: row.community.id,
    name: row.community.name,
    slug: row.community.slug,
    description: row.community.description,
    iconUrl: row.community.iconUrl,
    bannerUrl: row.community.bannerUrl,
    joinPolicy: row.community.joinPolicy,
    isOfficial: row.community.isOfficial,
    memberCount: row.community.memberCount,
    postCount: row.community.postCount,
    createdAt: row.community.createdAt,
    createdBy: row.createdBy
  }));
  return { items, total: (_d = (_c = countResult[0]) == null ? void 0 : _c.count) != null ? _d : 0 };
}
async function getCommunityBySlug(db, slug, requesterId) {
  var _a, _b;
  const rows = await db.select({
    community: communities,
    createdBy: {
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl
    }
  }).from(communities).innerJoin(users, eq(communities.createdById, users.id)).where(eq(communities.slug, slug)).limit(1);
  if (rows.length === 0)
    return null;
  const row = rows[0];
  let currentUserRole = null;
  let isBanned = false;
  if (requesterId) {
    const [memberRows, banResult] = await Promise.all([
      db.select({ role: communityMembers.role }).from(communityMembers).where(and(eq(communityMembers.communityId, row.community.id), eq(communityMembers.userId, requesterId))).limit(1),
      checkBan(db, row.community.id, requesterId)
    ]);
    currentUserRole = (_b = (_a = memberRows[0]) == null ? void 0 : _a.role) != null ? _b : null;
    isBanned = banResult !== null;
  }
  return {
    id: row.community.id,
    name: row.community.name,
    slug: row.community.slug,
    description: row.community.description,
    iconUrl: row.community.iconUrl,
    bannerUrl: row.community.bannerUrl,
    joinPolicy: row.community.joinPolicy,
    isOfficial: row.community.isOfficial,
    memberCount: row.community.memberCount,
    postCount: row.community.postCount,
    createdAt: row.community.createdAt,
    createdBy: row.createdBy,
    rules: row.community.rules,
    updatedAt: row.community.updatedAt,
    currentUserRole,
    isBanned
  };
}
async function createCommunity(db, userId, input) {
  var _a, _b, _c;
  const slug = await ensureUniqueCommunitySlug(db, generateSlug(input.name));
  const [community] = await db.insert(communities).values({
    name: input.name,
    slug,
    description: (_a = input.description) != null ? _a : null,
    rules: (_b = input.rules) != null ? _b : null,
    joinPolicy: (_c = input.joinPolicy) != null ? _c : "open",
    createdById: userId,
    memberCount: 1
  }).returning();
  await db.insert(communityMembers).values({
    communityId: community.id,
    userId,
    role: "owner"
  });
  return await getCommunityBySlug(db, community.slug, userId);
}
async function joinCommunity(db, userId, communityId, inviteToken) {
  const ban = await checkBan(db, communityId, userId);
  if (ban) {
    return { joined: false, error: "You are banned from this community" };
  }
  const community = await db.select({ joinPolicy: communities.joinPolicy }).from(communities).where(eq(communities.id, communityId)).limit(1);
  if (community.length === 0) {
    return { joined: false, error: "Community not found" };
  }
  const policy = community[0].joinPolicy;
  if (policy !== "open") {
    {
      return { joined: false, error: "Invite token required" };
    }
  }
  return db.transaction(async (tx) => {
    const inserted = await tx.insert(communityMembers).values({ communityId, userId, role: "member" }).onConflictDoNothing().returning();
    if (inserted.length === 0) {
      return { joined: true };
    }
    await tx.update(communities).set({ memberCount: sql`${communities.memberCount} + 1` }).where(eq(communities.id, communityId));
    return { joined: true };
  });
}
async function leaveCommunity(db, userId, communityId) {
  const member = await db.select({ role: communityMembers.role }).from(communityMembers).where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, userId))).limit(1);
  if (member.length === 0) {
    return { left: false, error: "Not a member" };
  }
  if (member[0].role === "owner") {
    return { left: false, error: "Owner cannot leave the community" };
  }
  await db.delete(communityMembers).where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, userId)));
  await db.update(communities).set({ memberCount: sql`GREATEST(${communities.memberCount} - 1, 0)` }).where(eq(communities.id, communityId));
  return { left: true };
}
async function listMembers(db, communityId) {
  const rows = await db.select({
    member: communityMembers,
    user: {
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl
    }
  }).from(communityMembers).innerJoin(users, eq(communityMembers.userId, users.id)).where(eq(communityMembers.communityId, communityId)).orderBy(desc(communityMembers.joinedAt));
  return rows.map((row) => ({
    communityId: row.member.communityId,
    userId: row.member.userId,
    role: row.member.role,
    joinedAt: row.member.joinedAt,
    user: row.user
  }));
}
async function changeRole(db, actorId, communityId, targetUserId, newRole) {
  const [actorMember, targetMember] = await Promise.all([
    db.select({ role: communityMembers.role }).from(communityMembers).where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, actorId))).limit(1),
    db.select({ role: communityMembers.role }).from(communityMembers).where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, targetUserId))).limit(1)
  ]);
  if (actorMember.length === 0) {
    return { changed: false, error: "Not a member" };
  }
  if (targetMember.length === 0) {
    return { changed: false, error: "Target is not a member" };
  }
  if (!hasPermission(actorMember[0].role, "manageMembers")) {
    return { changed: false, error: "Insufficient permissions" };
  }
  if (!canManageRole(actorMember[0].role, targetMember[0].role)) {
    return { changed: false, error: "Cannot manage a user with equal or higher role" };
  }
  if (newRole === "owner") {
    return { changed: false, error: "Cannot promote to owner" };
  }
  await db.update(communityMembers).set({ role: newRole }).where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, targetUserId)));
  return { changed: true };
}
async function kickMember(db, actorId, communityId, targetUserId) {
  const [actorMember, targetMember] = await Promise.all([
    db.select({ role: communityMembers.role }).from(communityMembers).where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, actorId))).limit(1),
    db.select({ role: communityMembers.role }).from(communityMembers).where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, targetUserId))).limit(1)
  ]);
  if (actorMember.length === 0) {
    return { kicked: false, error: "Not a member" };
  }
  if (targetMember.length === 0) {
    return { kicked: false, error: "Target is not a member" };
  }
  if (!hasPermission(actorMember[0].role, "kickMember")) {
    return { kicked: false, error: "Insufficient permissions" };
  }
  if (!canManageRole(actorMember[0].role, targetMember[0].role)) {
    return { kicked: false, error: "Cannot kick a user with equal or higher role" };
  }
  await db.delete(communityMembers).where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, targetUserId)));
  await db.update(communities).set({ memberCount: sql`GREATEST(${communities.memberCount} - 1, 0)` }).where(eq(communities.id, communityId));
  return { kicked: true };
}
async function createPost(db, authorId, input) {
  var _a;
  const member = await db.select({ role: communityMembers.role }).from(communityMembers).where(and(eq(communityMembers.communityId, input.communityId), eq(communityMembers.userId, authorId))).limit(1);
  if (member.length === 0) {
    throw new Error("Must be a member to post");
  }
  const [post] = await db.insert(communityPosts).values({
    communityId: input.communityId,
    authorId,
    type: (_a = input.type) != null ? _a : "text",
    content: input.content
  }).returning();
  await db.update(communities).set({ postCount: sql`${communities.postCount} + 1` }).where(eq(communities.id, input.communityId));
  const author = await db.select({
    id: users.id,
    username: users.username,
    displayName: users.displayName,
    avatarUrl: users.avatarUrl
  }).from(users).where(eq(users.id, authorId)).limit(1);
  return {
    id: post.id,
    communityId: post.communityId,
    type: post.type,
    content: post.content,
    isPinned: post.isPinned,
    isLocked: post.isLocked,
    likeCount: 0,
    replyCount: 0,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    author: author[0]
  };
}
async function listPosts(db, communityId, filters = {}) {
  var _a, _b, _c, _d;
  const conditions = [eq(communityPosts.communityId, communityId)];
  if (filters.type) {
    conditions.push(eq(communityPosts.type, filters.type));
  }
  const where = and(...conditions);
  const limit = Math.min((_a = filters.limit) != null ? _a : 20, 100);
  const offset = (_b = filters.offset) != null ? _b : 0;
  const [rows, countResult] = await Promise.all([
    db.select({
      post: communityPosts,
      author: {
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl
      }
    }).from(communityPosts).innerJoin(users, eq(communityPosts.authorId, users.id)).where(where).orderBy(desc(communityPosts.isPinned), desc(communityPosts.createdAt)).limit(limit).offset(offset),
    db.select({ count: sql`count(*)::int` }).from(communityPosts).where(where)
  ]);
  const items = rows.map((row) => {
    const item = {
      id: row.post.id,
      communityId: row.post.communityId,
      type: row.post.type,
      content: row.post.content,
      isPinned: row.post.isPinned,
      isLocked: row.post.isLocked,
      likeCount: row.post.likeCount,
      replyCount: row.post.replyCount,
      createdAt: row.post.createdAt,
      updatedAt: row.post.updatedAt,
      author: row.author
    };
    if (row.post.type === "share") {
      try {
        item.sharedContent = JSON.parse(row.post.content);
      } catch {
      }
    }
    return item;
  });
  return { items, total: (_d = (_c = countResult[0]) == null ? void 0 : _c.count) != null ? _d : 0 };
}
async function deletePost(db, postId, userId, communityId) {
  const post = await db.select({ authorId: communityPosts.authorId }).from(communityPosts).where(eq(communityPosts.id, postId)).limit(1);
  if (post.length === 0)
    return false;
  if (post[0].authorId !== userId) {
    const member = await db.select({ role: communityMembers.role }).from(communityMembers).where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, userId))).limit(1);
    if (member.length === 0 || !hasPermission(member[0].role, "deletePost")) {
      return false;
    }
  }
  await db.delete(communityPosts).where(eq(communityPosts.id, postId));
  await db.update(communities).set({ postCount: sql`GREATEST(${communities.postCount} - 1, 0)` }).where(eq(communities.id, communityId));
  return true;
}
async function createReply(db, authorId, input) {
  var _a;
  const post = await db.select({ communityId: communityPosts.communityId, isLocked: communityPosts.isLocked }).from(communityPosts).where(eq(communityPosts.id, input.postId)).limit(1);
  if (post.length === 0)
    throw new Error("Post not found");
  if (post[0].isLocked)
    throw new Error("Post is locked");
  const member = await db.select({ role: communityMembers.role }).from(communityMembers).where(and(eq(communityMembers.communityId, post[0].communityId), eq(communityMembers.userId, authorId))).limit(1);
  if (member.length === 0)
    throw new Error("Must be a member to reply");
  const ban = await checkBan(db, post[0].communityId, authorId);
  if (ban)
    throw new Error("You are banned from this community");
  const [reply] = await db.insert(communityPostReplies).values({
    postId: input.postId,
    authorId,
    content: input.content,
    parentId: (_a = input.parentId) != null ? _a : null
  }).returning();
  await db.update(communityPosts).set({ replyCount: sql`${communityPosts.replyCount} + 1` }).where(eq(communityPosts.id, input.postId));
  const author = await db.select({
    id: users.id,
    username: users.username,
    displayName: users.displayName,
    avatarUrl: users.avatarUrl
  }).from(users).where(eq(users.id, authorId)).limit(1);
  return {
    id: reply.id,
    postId: reply.postId,
    content: reply.content,
    likeCount: 0,
    createdAt: reply.createdAt,
    updatedAt: reply.updatedAt,
    parentId: reply.parentId,
    author: author[0]
  };
}
async function listReplies(db, postId) {
  const rows = await db.select({
    reply: communityPostReplies,
    author: {
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl
    }
  }).from(communityPostReplies).innerJoin(users, eq(communityPostReplies.authorId, users.id)).where(eq(communityPostReplies.postId, postId)).orderBy(desc(communityPostReplies.createdAt));
  const replyMap = /* @__PURE__ */ new Map();
  const rootReplies = [];
  for (const row of rows) {
    const item = {
      id: row.reply.id,
      postId: row.reply.postId,
      content: row.reply.content,
      likeCount: row.reply.likeCount,
      createdAt: row.reply.createdAt,
      updatedAt: row.reply.updatedAt,
      parentId: row.reply.parentId,
      author: row.author,
      replies: []
    };
    replyMap.set(item.id, item);
  }
  for (const item of replyMap.values()) {
    if (item.parentId && replyMap.has(item.parentId)) {
      replyMap.get(item.parentId).replies.push(item);
    } else {
      rootReplies.push(item);
    }
  }
  return rootReplies;
}
async function banUser(db, actorId, communityId, targetUserId, reason, expiresAt) {
  const [actorMember, targetMember] = await Promise.all([
    db.select({ role: communityMembers.role }).from(communityMembers).where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, actorId))).limit(1),
    db.select({ role: communityMembers.role }).from(communityMembers).where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, targetUserId))).limit(1)
  ]);
  if (actorMember.length === 0 || !hasPermission(actorMember[0].role, "banUser")) {
    return { banned: false, error: "Insufficient permissions" };
  }
  if (actorMember[0].role === "moderator" && true) {
    return { banned: false, error: "Moderators can only issue temporary bans" };
  }
  if (targetMember.length > 0) {
    if (!canManageRole(actorMember[0].role, targetMember[0].role)) {
      return { banned: false, error: "Cannot ban a user with equal or higher role" };
    }
    await db.delete(communityMembers).where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, targetUserId)));
    await db.update(communities).set({ memberCount: sql`GREATEST(${communities.memberCount} - 1, 0)` }).where(eq(communities.id, communityId));
  }
  await db.insert(communityBans).values({
    communityId,
    userId: targetUserId,
    bannedById: actorId,
    reason: reason != null ? reason : null,
    expiresAt: null
  });
  return { banned: true };
}
async function unbanUser(db, actorId, communityId, targetUserId) {
  const actorMember = await db.select({ role: communityMembers.role }).from(communityMembers).where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, actorId))).limit(1);
  if (actorMember.length === 0 || !hasPermission(actorMember[0].role, "banUser")) {
    return { unbanned: false, error: "Insufficient permissions" };
  }
  await db.delete(communityBans).where(and(eq(communityBans.communityId, communityId), eq(communityBans.userId, targetUserId)));
  return { unbanned: true };
}
async function checkBan(db, communityId, userId) {
  const rows = await db.select({
    id: communityBans.id,
    reason: communityBans.reason,
    expiresAt: communityBans.expiresAt
  }).from(communityBans).where(and(eq(communityBans.communityId, communityId), eq(communityBans.userId, userId))).limit(1);
  if (rows.length === 0)
    return null;
  const ban = rows[0];
  if (ban.expiresAt && ban.expiresAt < /* @__PURE__ */ new Date()) {
    await db.delete(communityBans).where(eq(communityBans.id, ban.id));
    return null;
  }
  return ban;
}
async function listBans(db, communityId) {
  const rows = await db.select({
    ban: communityBans,
    user: {
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl
    }
  }).from(communityBans).innerJoin(users, eq(communityBans.userId, users.id)).where(eq(communityBans.communityId, communityId)).orderBy(desc(communityBans.createdAt));
  const banIds = rows.map((r) => r.ban.bannedById);
  const uniqueBannerIds = [...new Set(banIds)];
  const banners = /* @__PURE__ */ new Map();
  if (uniqueBannerIds.length > 0) {
    const bannerRows = await db.select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl
    }).from(users).where(inArray(users.id, uniqueBannerIds));
    for (const row of bannerRows) {
      banners.set(row.id, row);
    }
  }
  return rows.map((row) => {
    var _a;
    return {
      id: row.ban.id,
      reason: row.ban.reason,
      expiresAt: row.ban.expiresAt,
      createdAt: row.ban.createdAt,
      user: row.user,
      bannedBy: (_a = banners.get(row.ban.bannedById)) != null ? _a : {
        id: row.ban.bannedById,
        username: "unknown",
        displayName: null,
        avatarUrl: null
      }
    };
  });
}
async function createInvite(db, userId, communityId, maxUses, expiresAt) {
  const member = await db.select({ role: communityMembers.role }).from(communityMembers).where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, userId))).limit(1);
  if (member.length === 0 || !hasPermission(member[0].role, "manageMembers")) {
    return null;
  }
  const token = crypto.randomUUID().replace(/-/g, "");
  const [invite] = await db.insert(communityInvites).values({
    communityId,
    createdById: userId,
    token,
    maxUses: maxUses != null ? maxUses : null,
    expiresAt: expiresAt != null ? expiresAt : null
  }).returning();
  const author = await db.select({
    id: users.id,
    username: users.username,
    displayName: users.displayName,
    avatarUrl: users.avatarUrl
  }).from(users).where(eq(users.id, userId)).limit(1);
  return {
    id: invite.id,
    token: invite.token,
    maxUses: invite.maxUses,
    useCount: 0,
    expiresAt: invite.expiresAt,
    createdAt: invite.createdAt,
    createdBy: author[0]
  };
}
async function listInvites(db, communityId) {
  const rows = await db.select({
    invite: communityInvites,
    createdBy: {
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl
    }
  }).from(communityInvites).innerJoin(users, eq(communityInvites.createdById, users.id)).where(eq(communityInvites.communityId, communityId)).orderBy(desc(communityInvites.createdAt));
  return rows.map((row) => ({
    id: row.invite.id,
    token: row.invite.token,
    maxUses: row.invite.maxUses,
    useCount: row.invite.useCount,
    expiresAt: row.invite.expiresAt,
    createdAt: row.invite.createdAt,
    createdBy: row.createdBy
  }));
}
async function shareContent(db, userId, communityId, contentId) {
  const member = await db.select({ role: communityMembers.role }).from(communityMembers).where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, userId))).limit(1);
  if (member.length === 0)
    return null;
  const content = await db.select({
    id: contentItems.id,
    title: contentItems.title,
    slug: contentItems.slug,
    type: contentItems.type
  }).from(contentItems).where(eq(contentItems.id, contentId)).limit(1);
  if (content.length === 0)
    return null;
  const sharePayload = JSON.stringify({
    contentId: content[0].id,
    title: content[0].title,
    slug: content[0].slug,
    type: content[0].type
  });
  await db.insert(communityShares).values({
    communityId,
    contentId,
    sharedById: userId
  });
  return createPost(db, userId, {
    communityId,
    type: "share",
    content: sharePayload
  });
}

async function toggleLike(db, userId, targetType, targetId) {
  const typedTargetType = targetType;
  return db.transaction(async (tx) => {
    const existing = await tx.select({ id: likes.id }).from(likes).where(and(eq(likes.userId, userId), eq(likes.targetType, typedTargetType), eq(likes.targetId, targetId))).limit(1);
    if (existing.length > 0) {
      await tx.delete(likes).where(eq(likes.id, existing[0].id));
      await updateLikeCount(tx, targetType, targetId, -1);
      return { liked: false };
    }
    await tx.insert(likes).values({ userId, targetType: typedTargetType, targetId });
    await updateLikeCount(tx, targetType, targetId, 1);
    return { liked: true };
  });
}
async function updateLikeCount(tx, targetType, targetId, delta) {
  switch (targetType) {
    case "comment":
      await tx.update(comments).set({
        likeCount: delta > 0 ? sql`${comments.likeCount} + 1` : sql`GREATEST(${comments.likeCount} - 1, 0)`
      }).where(eq(comments.id, targetId));
      break;
    case "post":
      await tx.update(communityPosts).set({
        likeCount: delta > 0 ? sql`${communityPosts.likeCount} + 1` : sql`GREATEST(${communityPosts.likeCount} - 1, 0)`
      }).where(eq(communityPosts.id, targetId));
      break;
    default:
      await tx.update(contentItems).set({
        likeCount: delta > 0 ? sql`${contentItems.likeCount} + 1` : sql`GREATEST(${contentItems.likeCount} - 1, 0)`
      }).where(eq(contentItems.id, targetId));
      break;
  }
}
async function isLiked(db, userId, targetType, targetId) {
  const result = await db.select({ id: likes.id }).from(likes).where(and(eq(likes.userId, userId), eq(likes.targetType, targetType), eq(likes.targetId, targetId))).limit(1);
  return result.length > 0;
}
async function listComments(db, targetType, targetId) {
  const rows = await db.select({
    comment: comments,
    author: {
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl
    }
  }).from(comments).innerJoin(users, eq(comments.authorId, users.id)).where(and(eq(comments.targetType, targetType), eq(comments.targetId, targetId))).orderBy(desc(comments.createdAt));
  const commentMap = /* @__PURE__ */ new Map();
  const rootComments = [];
  for (const row of rows) {
    const item = {
      id: row.comment.id,
      content: row.comment.content,
      likeCount: row.comment.likeCount,
      createdAt: row.comment.createdAt,
      updatedAt: row.comment.updatedAt,
      parentId: row.comment.parentId,
      author: row.author,
      replies: []
    };
    commentMap.set(item.id, item);
  }
  for (const item of commentMap.values()) {
    if (item.parentId && commentMap.has(item.parentId)) {
      commentMap.get(item.parentId).replies.push(item);
    } else {
      rootComments.push(item);
    }
  }
  return rootComments;
}
async function createComment(db, authorId, input) {
  var _a;
  const [row] = await db.insert(comments).values({
    authorId,
    targetType: input.targetType,
    targetId: input.targetId,
    content: input.content,
    parentId: (_a = input.parentId) != null ? _a : null
  }).returning();
  if (input.targetType === "post") {
    await db.update(communityPosts).set({ replyCount: sql`${communityPosts.replyCount} + 1` }).where(eq(communityPosts.id, input.targetId));
  } else {
    await db.update(contentItems).set({ commentCount: sql`${contentItems.commentCount} + 1` }).where(eq(contentItems.id, input.targetId));
  }
  const author = await db.select({
    id: users.id,
    username: users.username,
    displayName: users.displayName,
    avatarUrl: users.avatarUrl
  }).from(users).where(eq(users.id, authorId)).limit(1);
  return {
    id: row.id,
    content: row.content,
    likeCount: 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    parentId: row.parentId,
    author: author[0]
  };
}
async function deleteComment(db, commentId, authorId) {
  const existing = await db.select({ id: comments.id, targetId: comments.targetId, targetType: comments.targetType }).from(comments).where(and(eq(comments.id, commentId), eq(comments.authorId, authorId))).limit(1);
  if (existing.length === 0)
    return false;
  await db.delete(comments).where(eq(comments.id, commentId));
  if (existing[0].targetType === "post") {
    await db.update(communityPosts).set({ replyCount: sql`GREATEST(${communityPosts.replyCount} - 1, 0)` }).where(eq(communityPosts.id, existing[0].targetId));
  } else {
    await db.update(contentItems).set({ commentCount: sql`GREATEST(${contentItems.commentCount} - 1, 0)` }).where(eq(contentItems.id, existing[0].targetId));
  }
  return true;
}
async function toggleBookmark(db, userId, targetType, targetId) {
  const typedTargetType = targetType;
  return db.transaction(async (tx) => {
    const existing = await tx.select({ id: bookmarks.id }).from(bookmarks).where(and(eq(bookmarks.userId, userId), eq(bookmarks.targetType, typedTargetType), eq(bookmarks.targetId, targetId))).limit(1);
    if (existing.length > 0) {
      await tx.delete(bookmarks).where(eq(bookmarks.id, existing[0].id));
      return { bookmarked: false };
    }
    await tx.insert(bookmarks).values({ userId, targetType: typedTargetType, targetId });
    return { bookmarked: true };
  });
}

function calculatePathProgress(totalLessons, completedCount) {
  if (totalLessons <= 0)
    return 0;
  if (completedCount >= totalLessons)
    return 100;
  return Math.round(completedCount / totalLessons * 1e4) / 100;
}
function isPathComplete(progress) {
  return progress >= 100;
}

function generateVerificationCode(prefix = "SNAP") {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = randomHex(8);
  return `${prefix}-${timestamp}-${random}`;
}
function randomHex(length) {
  const bytes = new Uint8Array(Math.ceil(length / 2));
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("").slice(0, length);
}

async function listPaths(db, filters = {}) {
  var _a, _b, _c, _d;
  const conditions = [];
  if (filters.status) {
    conditions.push(eq(learningPaths.status, filters.status));
  }
  if (filters.difficulty) {
    conditions.push(eq(learningPaths.difficulty, filters.difficulty));
  }
  if (filters.authorId) {
    conditions.push(eq(learningPaths.authorId, filters.authorId));
  }
  const where = conditions.length > 0 ? and(...conditions) : void 0;
  const limit = Math.min((_a = filters.limit) != null ? _a : 20, 100);
  const offset = (_b = filters.offset) != null ? _b : 0;
  const [rows, countResult] = await Promise.all([
    db.select({
      path: learningPaths,
      author: {
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl
      }
    }).from(learningPaths).innerJoin(users, eq(learningPaths.authorId, users.id)).where(where).orderBy(desc(learningPaths.createdAt)).limit(limit).offset(offset),
    db.select({ count: sql`count(*)::int` }).from(learningPaths).where(where)
  ]);
  const items = rows.map((row) => ({
    id: row.path.id,
    title: row.path.title,
    slug: row.path.slug,
    description: row.path.description,
    coverImageUrl: row.path.coverImageUrl,
    difficulty: row.path.difficulty,
    estimatedHours: row.path.estimatedHours,
    enrollmentCount: row.path.enrollmentCount,
    completionCount: row.path.completionCount,
    averageRating: row.path.averageRating,
    status: row.path.status,
    createdAt: row.path.createdAt,
    author: row.author
  }));
  return { items, total: (_d = (_c = countResult[0]) == null ? void 0 : _c.count) != null ? _d : 0 };
}
async function getPathBySlug(db, slug, requesterId) {
  const rows = await db.select({
    path: learningPaths,
    author: {
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl
    }
  }).from(learningPaths).innerJoin(users, eq(learningPaths.authorId, users.id)).where(eq(learningPaths.slug, slug)).limit(1);
  if (rows.length === 0)
    return null;
  const row = rows[0];
  const path = row.path;
  if (path.status !== "published" && path.authorId !== requesterId) {
    return null;
  }
  const modules = await db.select().from(learningModules).where(eq(learningModules.pathId, path.id)).orderBy(asc(learningModules.sortOrder));
  const moduleIds = modules.map((m) => m.id);
  let lessons = [];
  if (moduleIds.length > 0) {
    lessons = await db.select().from(learningLessons).where(sql`${learningLessons.moduleId} = ANY(${moduleIds})`).orderBy(asc(learningLessons.sortOrder));
  }
  let enrollment = null;
  let isEnrolled = false;
  if (requesterId) {
    const enrollmentRows = await db.select().from(enrollments).where(and(eq(enrollments.userId, requesterId), eq(enrollments.pathId, path.id))).limit(1);
    if (enrollmentRows.length > 0) {
      const e = enrollmentRows[0];
      enrollment = {
        id: e.id,
        progress: e.progress,
        startedAt: e.startedAt,
        completedAt: e.completedAt
      };
      isEnrolled = true;
    }
  }
  const modulesWithLessons = modules.map((mod) => ({
    id: mod.id,
    title: mod.title,
    description: mod.description,
    sortOrder: mod.sortOrder,
    lessons: lessons.filter((l) => l.moduleId === mod.id).map((l) => ({
      id: l.id,
      title: l.title,
      slug: l.slug,
      type: l.type,
      duration: l.duration,
      sortOrder: l.sortOrder
    }))
  }));
  return {
    id: path.id,
    title: path.title,
    slug: path.slug,
    description: path.description,
    coverImageUrl: path.coverImageUrl,
    difficulty: path.difficulty,
    estimatedHours: path.estimatedHours,
    enrollmentCount: path.enrollmentCount,
    completionCount: path.completionCount,
    averageRating: path.averageRating,
    reviewCount: path.reviewCount,
    status: path.status,
    createdAt: path.createdAt,
    updatedAt: path.updatedAt,
    author: row.author,
    modules: modulesWithLessons,
    isEnrolled,
    enrollment
  };
}
async function createPath(db, authorId, input) {
  var _a, _b, _c, _d;
  const slug = await ensureUniquePathSlug(db, generateSlug(input.title));
  const [path] = await db.insert(learningPaths).values({
    authorId,
    title: input.title,
    slug,
    description: (_a = input.description) != null ? _a : null,
    difficulty: (_b = input.difficulty) != null ? _b : null,
    estimatedHours: (_d = (_c = input.estimatedHours) == null ? void 0 : _c.toString()) != null ? _d : null,
    status: "draft"
  }).returning();
  return await getPathBySlug(db, path.slug, authorId);
}
async function updatePath(db, pathId, authorId, input) {
  var _a;
  const existing = await db.select().from(learningPaths).where(and(eq(learningPaths.id, pathId), eq(learningPaths.authorId, authorId))).limit(1);
  if (existing.length === 0)
    return null;
  const current = existing[0];
  const updates = { updatedAt: /* @__PURE__ */ new Date() };
  if (input.title !== void 0) {
    updates.title = input.title;
    if (input.title !== current.title) {
      updates.slug = await ensureUniquePathSlug(db, generateSlug(input.title), pathId);
    }
  }
  if (input.description !== void 0)
    updates.description = input.description;
  if (input.difficulty !== void 0)
    updates.difficulty = input.difficulty;
  if (input.estimatedHours !== void 0)
    updates.estimatedHours = input.estimatedHours.toString();
  if (input.coverImageUrl !== void 0)
    updates.coverImageUrl = input.coverImageUrl;
  await db.update(learningPaths).set(updates).where(eq(learningPaths.id, pathId));
  const slug = (_a = updates.slug) != null ? _a : current.slug;
  return await getPathBySlug(db, slug, authorId);
}
async function deletePath(db, pathId, authorId) {
  var _a;
  const result = await db.update(learningPaths).set({ status: "archived", updatedAt: /* @__PURE__ */ new Date() }).where(and(eq(learningPaths.id, pathId), eq(learningPaths.authorId, authorId)));
  return ((_a = result.rowCount) != null ? _a : 0) > 0;
}
async function publishPath(db, pathId, authorId) {
  const existing = await db.select().from(learningPaths).where(and(eq(learningPaths.id, pathId), eq(learningPaths.authorId, authorId))).limit(1);
  if (existing.length === 0)
    return null;
  await db.update(learningPaths).set({ status: "published", updatedAt: /* @__PURE__ */ new Date() }).where(eq(learningPaths.id, pathId));
  return await getPathBySlug(db, existing[0].slug, authorId);
}
async function createModule(db, authorId, input) {
  var _a, _b, _c;
  const path = await db.select().from(learningPaths).where(and(eq(learningPaths.id, input.pathId), eq(learningPaths.authorId, authorId))).limit(1);
  if (path.length === 0)
    throw new Error("Not authorized");
  let sortOrder = input.sortOrder;
  if (sortOrder === void 0) {
    const maxSort = await db.select({ max: sql`coalesce(max(${learningModules.sortOrder}), -1)` }).from(learningModules).where(eq(learningModules.pathId, input.pathId));
    sortOrder = ((_b = (_a = maxSort[0]) == null ? void 0 : _a.max) != null ? _b : -1) + 1;
  }
  const [mod] = await db.insert(learningModules).values({
    pathId: input.pathId,
    title: input.title,
    description: (_c = input.description) != null ? _c : null,
    sortOrder
  }).returning();
  return mod;
}
async function updateModule(db, moduleId, authorId, input) {
  const mod = await db.select({ module: learningModules, path: learningPaths }).from(learningModules).innerJoin(learningPaths, eq(learningModules.pathId, learningPaths.id)).where(and(eq(learningModules.id, moduleId), eq(learningPaths.authorId, authorId))).limit(1);
  if (mod.length === 0)
    return null;
  const updates = {};
  if (input.title !== void 0)
    updates.title = input.title;
  if (input.description !== void 0)
    updates.description = input.description;
  if (Object.keys(updates).length === 0)
    return mod[0].module;
  const [updated] = await db.update(learningModules).set(updates).where(eq(learningModules.id, moduleId)).returning();
  return updated;
}
async function createLesson(db, authorId, input) {
  var _a, _b, _c, _d;
  const mod = await db.select({ module: learningModules, path: learningPaths }).from(learningModules).innerJoin(learningPaths, eq(learningModules.pathId, learningPaths.id)).where(and(eq(learningModules.id, input.moduleId), eq(learningPaths.authorId, authorId))).limit(1);
  if (mod.length === 0)
    throw new Error("Not authorized");
  const slug = generateSlug(input.title) || `lesson-${Date.now()}`;
  const maxSort = await db.select({ max: sql`coalesce(max(${learningLessons.sortOrder}), -1)` }).from(learningLessons).where(eq(learningLessons.moduleId, input.moduleId));
  const [lesson] = await db.insert(learningLessons).values({
    moduleId: input.moduleId,
    title: input.title,
    slug,
    type: input.type,
    content: (_a = input.content) != null ? _a : null,
    duration: (_b = input.durationMinutes) != null ? _b : null,
    sortOrder: ((_d = (_c = maxSort[0]) == null ? void 0 : _c.max) != null ? _d : -1) + 1
  }).returning();
  return lesson;
}
async function enroll(db, userId, pathId) {
  const existing = await db.select().from(enrollments).where(and(eq(enrollments.userId, userId), eq(enrollments.pathId, pathId))).limit(1);
  if (existing.length > 0)
    return existing[0];
  const path = await db.select().from(learningPaths).where(and(eq(learningPaths.id, pathId), eq(learningPaths.status, "published"))).limit(1);
  if (path.length === 0)
    throw new Error("Path not found or not published");
  const [enrollment] = await db.insert(enrollments).values({ userId, pathId }).returning();
  await db.update(learningPaths).set({ enrollmentCount: sql`${learningPaths.enrollmentCount} + 1` }).where(eq(learningPaths.id, pathId));
  return enrollment;
}
async function unenroll(db, userId, pathId) {
  const existing = await db.select().from(enrollments).where(and(eq(enrollments.userId, userId), eq(enrollments.pathId, pathId))).limit(1);
  if (existing.length === 0)
    return false;
  await db.delete(enrollments).where(and(eq(enrollments.userId, userId), eq(enrollments.pathId, pathId)));
  await db.update(learningPaths).set({ enrollmentCount: sql`GREATEST(${learningPaths.enrollmentCount} - 1, 0)` }).where(eq(learningPaths.id, pathId));
  return true;
}
async function markLessonComplete(db, userId, lessonId, quizScore, quizPassed) {
  const lessonRow = await db.select({ lesson: learningLessons, module: learningModules }).from(learningLessons).innerJoin(learningModules, eq(learningLessons.moduleId, learningModules.id)).where(eq(learningLessons.id, lessonId)).limit(1);
  if (lessonRow.length === 0)
    throw new Error("Lesson not found");
  const pathId = lessonRow[0].module.pathId;
  return db.transaction(async (tx) => {
    var _a, _b, _c, _d, _e, _f;
    const enrollmentRow = await tx.select().from(enrollments).where(and(eq(enrollments.userId, userId), eq(enrollments.pathId, pathId))).for("update").limit(1);
    if (enrollmentRow.length === 0)
      throw new Error("Not enrolled");
    const existingProgress = await tx.select().from(lessonProgress).where(and(eq(lessonProgress.userId, userId), eq(lessonProgress.lessonId, lessonId))).limit(1);
    if (existingProgress.length === 0) {
      await tx.insert(lessonProgress).values({
        userId,
        lessonId,
        completed: true,
        completedAt: /* @__PURE__ */ new Date(),
        quizScore: (_a = quizScore == null ? void 0 : quizScore.toString()) != null ? _a : null,
        quizPassed: quizPassed != null ? quizPassed : null
      });
    } else {
      await tx.update(lessonProgress).set({
        completed: true,
        completedAt: /* @__PURE__ */ new Date(),
        quizScore: (_b = quizScore == null ? void 0 : quizScore.toString()) != null ? _b : existingProgress[0].quizScore,
        quizPassed: quizPassed != null ? quizPassed : existingProgress[0].quizPassed
      }).where(and(eq(lessonProgress.userId, userId), eq(lessonProgress.lessonId, lessonId)));
    }
    const totalLessons = await tx.select({ count: sql`count(*)::int` }).from(learningLessons).innerJoin(learningModules, eq(learningLessons.moduleId, learningModules.id)).where(eq(learningModules.pathId, pathId));
    const completedLessons = await tx.select({ count: sql`count(*)::int` }).from(lessonProgress).innerJoin(learningLessons, eq(lessonProgress.lessonId, learningLessons.id)).innerJoin(learningModules, eq(learningLessons.moduleId, learningModules.id)).where(and(eq(lessonProgress.userId, userId), eq(lessonProgress.completed, true), eq(learningModules.pathId, pathId)));
    const total = (_d = (_c = totalLessons[0]) == null ? void 0 : _c.count) != null ? _d : 0;
    const completed = (_f = (_e = completedLessons[0]) == null ? void 0 : _e.count) != null ? _f : 0;
    const progress = calculatePathProgress(total, completed);
    const enrollmentUpdates = { progress: progress.toString() };
    if (isPathComplete(progress)) {
      enrollmentUpdates.completedAt = /* @__PURE__ */ new Date();
    }
    await tx.update(enrollments).set(enrollmentUpdates).where(eq(enrollments.id, enrollmentRow[0].id));
    let certificateIssued = false;
    if (isPathComplete(progress)) {
      const existingCert = await tx.select().from(certificates).where(and(eq(certificates.userId, userId), eq(certificates.pathId, pathId))).limit(1);
      if (existingCert.length === 0) {
        await tx.insert(certificates).values({
          userId,
          pathId,
          verificationCode: generateVerificationCode()
        });
        certificateIssued = true;
        await tx.update(learningPaths).set({ completionCount: sql`${learningPaths.completionCount} + 1` }).where(eq(learningPaths.id, pathId));
      }
    }
    return { progress, certificateIssued };
  });
}
async function getUserEnrollments(db, userId) {
  const rows = await db.select({
    enrollment: enrollments,
    path: {
      id: learningPaths.id,
      title: learningPaths.title,
      slug: learningPaths.slug,
      coverImageUrl: learningPaths.coverImageUrl,
      difficulty: learningPaths.difficulty
    }
  }).from(enrollments).innerJoin(learningPaths, eq(enrollments.pathId, learningPaths.id)).where(eq(enrollments.userId, userId)).orderBy(desc(enrollments.startedAt));
  return rows.map((row) => ({
    id: row.enrollment.id,
    progress: row.enrollment.progress,
    startedAt: row.enrollment.startedAt,
    completedAt: row.enrollment.completedAt,
    path: row.path
  }));
}
async function getUserCertificates(db, userId) {
  const rows = await db.select({
    certificate: certificates,
    path: {
      id: learningPaths.id,
      title: learningPaths.title,
      slug: learningPaths.slug
    }
  }).from(certificates).innerJoin(learningPaths, eq(certificates.pathId, learningPaths.id)).where(eq(certificates.userId, userId)).orderBy(desc(certificates.issuedAt));
  return rows.map((row) => ({
    id: row.certificate.id,
    verificationCode: row.certificate.verificationCode,
    issuedAt: row.certificate.issuedAt,
    path: row.path
  }));
}
async function getLessonBySlug(db, pathSlug, lessonSlug) {
  const path = await db.select().from(learningPaths).where(eq(learningPaths.slug, pathSlug)).limit(1);
  if (path.length === 0)
    return null;
  const rows = await db.select({ lesson: learningLessons, module: learningModules }).from(learningLessons).innerJoin(learningModules, eq(learningLessons.moduleId, learningModules.id)).where(and(eq(learningLessons.slug, lessonSlug), eq(learningModules.pathId, path[0].id))).limit(1);
  if (rows.length === 0)
    return null;
  return {
    lesson: rows[0].lesson,
    module: rows[0].module,
    pathId: path[0].id
  };
}
async function ensureUniquePathSlug(db, slug, excludeId) {
  if (!slug) {
    slug = `untitled-${Date.now()}`;
  }
  const conditions = [eq(learningPaths.slug, slug)];
  if (excludeId) {
    const { ne } = await import('drizzle-orm');
    conditions.push(ne(learningPaths.id, excludeId));
  }
  const existing = await db.select({ id: learningPaths.id }).from(learningPaths).where(and(...conditions)).limit(1);
  if (existing.length === 0)
    return slug;
  return `${slug}-${Date.now()}`;
}

async function listDocsSites(db, filters = {}) {
  var _a, _b, _c, _d;
  const conditions = [];
  if (filters.ownerId) {
    conditions.push(eq(docsSites.ownerId, filters.ownerId));
  }
  const where = conditions.length > 0 ? and(...conditions) : void 0;
  const limit = Math.min((_a = filters.limit) != null ? _a : 20, 100);
  const offset = (_b = filters.offset) != null ? _b : 0;
  const [rows, countResult] = await Promise.all([
    db.select({
      site: docsSites,
      owner: {
        id: users.id,
        username: users.username,
        displayName: users.displayName
      }
    }).from(docsSites).innerJoin(users, eq(docsSites.ownerId, users.id)).where(where).orderBy(desc(docsSites.createdAt)).limit(limit).offset(offset),
    db.select({ count: sql`count(*)::int` }).from(docsSites).where(where)
  ]);
  const items = rows.map((row) => ({
    ...row.site,
    owner: row.owner
  }));
  return { items, total: (_d = (_c = countResult[0]) == null ? void 0 : _c.count) != null ? _d : 0 };
}
async function getDocsSiteBySlug(db, slug) {
  const rows = await db.select({
    site: docsSites,
    owner: {
      id: users.id,
      username: users.username,
      displayName: users.displayName
    }
  }).from(docsSites).innerJoin(users, eq(docsSites.ownerId, users.id)).where(eq(docsSites.slug, slug)).limit(1);
  if (rows.length === 0)
    return null;
  const row = rows[0];
  const versions = await db.select().from(docsVersions).where(eq(docsVersions.siteId, row.site.id)).orderBy(desc(docsVersions.createdAt));
  return {
    site: { ...row.site, owner: row.owner },
    versions
  };
}
async function createDocsSite(db, ownerId, input) {
  var _a;
  const slug = await ensureUniqueDocsSiteSlug(db, input.slug || generateSlug(input.name));
  const [site] = await db.insert(docsSites).values({
    name: input.name,
    slug,
    description: (_a = input.description) != null ? _a : null,
    ownerId
  }).returning();
  await db.insert(docsVersions).values({
    siteId: site.id,
    version: "v1",
    isDefault: 1
  });
  return site;
}
async function updateDocsSite(db, siteId, ownerId, input) {
  const existing = await db.select().from(docsSites).where(and(eq(docsSites.id, siteId), eq(docsSites.ownerId, ownerId))).limit(1);
  if (existing.length === 0)
    return null;
  const updates = { updatedAt: /* @__PURE__ */ new Date() };
  if (input.name !== void 0) {
    updates.name = input.name;
    if (input.name !== existing[0].name) {
      updates.slug = await ensureUniqueDocsSiteSlug(db, generateSlug(input.name), siteId);
    }
  }
  if (input.description !== void 0)
    updates.description = input.description;
  const [updated] = await db.update(docsSites).set(updates).where(eq(docsSites.id, siteId)).returning();
  return updated;
}
async function deleteDocsSite(db, siteId, ownerId) {
  const existing = await db.select().from(docsSites).where(and(eq(docsSites.id, siteId), eq(docsSites.ownerId, ownerId))).limit(1);
  if (existing.length === 0)
    return false;
  await db.delete(docsSites).where(eq(docsSites.id, siteId));
  return true;
}
async function createDocsVersion(db, siteId, ownerId, input) {
  var _a;
  const site = await db.select().from(docsSites).where(and(eq(docsSites.id, siteId), eq(docsSites.ownerId, ownerId))).limit(1);
  if (site.length === 0)
    throw new Error("Not authorized");
  const [version] = await db.insert(docsVersions).values({
    siteId,
    version: input.version,
    isDefault: input.isDefault ? 1 : 0
  }).returning();
  if (input.sourceVersionId) {
    const sourcePages = await db.select().from(docsPages).where(eq(docsPages.versionId, input.sourceVersionId)).orderBy(asc(docsPages.sortOrder));
    if (sourcePages.length > 0) {
      const oldToNew = /* @__PURE__ */ new Map();
      const pagesToInsert = sourcePages.map((page) => {
        const newId = crypto.randomUUID();
        oldToNew.set(page.id, newId);
        return {
          id: newId,
          versionId: version.id,
          title: page.title,
          slug: page.slug,
          content: page.content,
          sortOrder: page.sortOrder,
          parentId: null
        };
      });
      for (let i = 0; i < sourcePages.length; i++) {
        const oldParent = sourcePages[i].parentId;
        if (oldParent) {
          pagesToInsert[i].parentId = (_a = oldToNew.get(oldParent)) != null ? _a : null;
        }
      }
      await db.insert(docsPages).values(pagesToInsert);
    }
  }
  if (input.isDefault) {
    await db.update(docsVersions).set({ isDefault: 0 }).where(and(eq(docsVersions.siteId, siteId), sql`${docsVersions.id} != ${version.id}`));
  }
  return version;
}
async function listDocsPages(db, versionId) {
  return db.select().from(docsPages).where(eq(docsPages.versionId, versionId)).orderBy(asc(docsPages.sortOrder));
}
async function createDocsPage(db, ownerId, input) {
  var _a, _b, _c;
  const version = await db.select({ version: docsVersions, site: docsSites }).from(docsVersions).innerJoin(docsSites, eq(docsVersions.siteId, docsSites.id)).where(and(eq(docsVersions.id, input.versionId), eq(docsSites.ownerId, ownerId))).limit(1);
  if (version.length === 0)
    throw new Error("Not authorized");
  let sortOrder = input.sortOrder;
  if (sortOrder === void 0) {
    const conditions = [eq(docsPages.versionId, input.versionId)];
    if (input.parentId) {
      conditions.push(eq(docsPages.parentId, input.parentId));
    }
    const maxSort = await db.select({ max: sql`coalesce(max(${docsPages.sortOrder}), -1)` }).from(docsPages).where(and(...conditions));
    sortOrder = ((_b = (_a = maxSort[0]) == null ? void 0 : _a.max) != null ? _b : -1) + 1;
  }
  const slug = input.slug || generateSlug(input.title);
  const [page] = await db.insert(docsPages).values({
    versionId: input.versionId,
    title: input.title,
    slug,
    content: input.content,
    sortOrder,
    parentId: (_c = input.parentId) != null ? _c : null
  }).returning();
  return page;
}
async function updateDocsPage(db, pageId, ownerId, input) {
  const page = await db.select({ page: docsPages, version: docsVersions, site: docsSites }).from(docsPages).innerJoin(docsVersions, eq(docsPages.versionId, docsVersions.id)).innerJoin(docsSites, eq(docsVersions.siteId, docsSites.id)).where(and(eq(docsPages.id, pageId), eq(docsSites.ownerId, ownerId))).limit(1);
  if (page.length === 0)
    return null;
  const updates = { updatedAt: /* @__PURE__ */ new Date() };
  if (input.title !== void 0)
    updates.title = input.title;
  if (input.slug !== void 0)
    updates.slug = input.slug;
  if (input.content !== void 0)
    updates.content = input.content;
  if (input.sortOrder !== void 0)
    updates.sortOrder = input.sortOrder;
  if (input.parentId !== void 0)
    updates.parentId = input.parentId;
  const [updated] = await db.update(docsPages).set(updates).where(eq(docsPages.id, pageId)).returning();
  return updated;
}
async function getDocsNav(db, versionId) {
  var _a;
  const rows = await db.select().from(docsNav).where(eq(docsNav.versionId, versionId)).limit(1);
  return (_a = rows[0]) != null ? _a : null;
}
async function searchDocsPages(db, siteId, versionId, query) {
  if (!query.trim())
    return [];
  const tsQuery = query.trim().split(/\s+/).filter(Boolean).map((t) => t.replace(/[^a-zA-Z0-9]/g, "")).filter(Boolean).map((t) => `${t}:*`).join(" & ");
  if (!tsQuery)
    return [];
  const results = await db.select({
    id: docsPages.id,
    title: docsPages.title,
    slug: docsPages.slug,
    snippet: sql`ts_headline('english', ${docsPages.content}, to_tsquery('english', ${tsQuery}), 'MaxWords=30, MinWords=15')`
  }).from(docsPages).innerJoin(docsVersions, eq(docsPages.versionId, docsVersions.id)).where(and(eq(docsPages.versionId, versionId), eq(docsVersions.siteId, siteId), sql`to_tsvector('english', ${docsPages.title} || ' ' || ${docsPages.content}) @@ to_tsquery('english', ${tsQuery})`)).limit(20);
  return results;
}
async function ensureUniqueDocsSiteSlug(db, slug, excludeId) {
  if (!slug)
    slug = `docs-${Date.now()}`;
  const conditions = [eq(docsSites.slug, slug)];
  if (excludeId) {
    const { ne } = await import('drizzle-orm');
    conditions.push(ne(docsSites.id, excludeId));
  }
  const existing = await db.select({ id: docsSites.id }).from(docsSites).where(and(...conditions)).limit(1);
  if (existing.length === 0)
    return slug;
  return `${slug}-${Date.now()}`;
}

async function createAuditEntry(db, entry) {
  var _a, _b;
  await db.insert(auditLogs).values({
    userId: entry.userId,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    metadata: (_a = entry.metadata) != null ? _a : null,
    ipAddress: (_b = entry.ipAddress) != null ? _b : null
  });
}
async function listAuditLogs(db, filters = {}) {
  var _a, _b, _c, _d;
  const conditions = [];
  if (filters.action) {
    conditions.push(eq(auditLogs.action, filters.action));
  }
  if (filters.userId) {
    conditions.push(eq(auditLogs.userId, filters.userId));
  }
  if (filters.targetType) {
    conditions.push(eq(auditLogs.targetType, filters.targetType));
  }
  const where = conditions.length > 0 ? and(...conditions) : void 0;
  const limit = Math.min((_a = filters.limit) != null ? _a : 50, 100);
  const offset = (_b = filters.offset) != null ? _b : 0;
  const [rows, countResult] = await Promise.all([
    db.select({
      log: auditLogs,
      user: {
        id: users.id,
        username: users.username,
        displayName: users.displayName
      }
    }).from(auditLogs).innerJoin(users, eq(auditLogs.userId, users.id)).where(where).orderBy(desc(auditLogs.createdAt)).limit(limit).offset(offset),
    db.select({ count: sql`count(*)::int` }).from(auditLogs).where(where)
  ]);
  const items = rows.map((row) => ({
    id: row.log.id,
    action: row.log.action,
    targetType: row.log.targetType,
    targetId: row.log.targetId,
    metadata: row.log.metadata,
    ipAddress: row.log.ipAddress,
    createdAt: row.log.createdAt,
    user: {
      id: row.user.id,
      username: row.user.username,
      displayName: row.user.displayName
    }
  }));
  return { items, total: (_d = (_c = countResult[0]) == null ? void 0 : _c.count) != null ? _d : 0 };
}
async function getPlatformStats(db) {
  var _a, _b, _c, _d, _e, _f;
  const [usersByRole, usersByStatus, contentByType, contentByStatus, communityCount, pendingReports, totalReports] = await Promise.all([
    db.select({ role: users.role, count: sql`count(*)::int` }).from(users).groupBy(users.role),
    db.select({ status: users.status, count: sql`count(*)::int` }).from(users).groupBy(users.status),
    db.select({ type: contentItems.type, count: sql`count(*)::int` }).from(contentItems).groupBy(contentItems.type),
    db.select({ status: contentItems.status, count: sql`count(*)::int` }).from(contentItems).groupBy(contentItems.status),
    db.select({ count: sql`count(*)::int` }).from(communities),
    db.select({ count: sql`count(*)::int` }).from(reports).where(eq(reports.status, "pending")),
    db.select({ count: sql`count(*)::int` }).from(reports)
  ]);
  const byRole = {};
  let totalUsers = 0;
  for (const row of usersByRole) {
    byRole[row.role] = row.count;
    totalUsers += row.count;
  }
  const byStatus = {};
  for (const row of usersByStatus) {
    byStatus[row.status] = row.count;
  }
  const byType = {};
  let totalContent = 0;
  for (const row of contentByType) {
    byType[row.type] = row.count;
    totalContent += row.count;
  }
  const byContentStatus = {};
  for (const row of contentByStatus) {
    byContentStatus[row.status] = row.count;
  }
  return {
    users: { total: totalUsers, byRole, byStatus },
    content: { total: totalContent, byType, byStatus: byContentStatus },
    communities: { total: (_b = (_a = communityCount[0]) == null ? void 0 : _a.count) != null ? _b : 0 },
    reports: {
      pending: (_d = (_c = pendingReports[0]) == null ? void 0 : _c.count) != null ? _d : 0,
      total: (_f = (_e = totalReports[0]) == null ? void 0 : _e.count) != null ? _f : 0
    }
  };
}
async function listUsers(db, filters = {}) {
  var _a, _b, _c, _d;
  const conditions = [];
  if (filters.search) {
    const term = `%${filters.search}%`;
    conditions.push(sql`(${ilike(users.username, term)} OR ${ilike(users.email, term)})`);
  }
  if (filters.role) {
    conditions.push(eq(users.role, filters.role));
  }
  if (filters.status) {
    conditions.push(eq(users.status, filters.status));
  }
  const where = conditions.length > 0 ? and(...conditions) : void 0;
  const limit = Math.min((_a = filters.limit) != null ? _a : 20, 100);
  const offset = (_b = filters.offset) != null ? _b : 0;
  const [rows, countResult] = await Promise.all([
    db.select({
      id: users.id,
      email: users.email,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      role: users.role,
      status: users.status,
      createdAt: users.createdAt
    }).from(users).where(where).orderBy(desc(users.createdAt)).limit(limit).offset(offset),
    db.select({ count: sql`count(*)::int` }).from(users).where(where)
  ]);
  return {
    items: rows,
    total: (_d = (_c = countResult[0]) == null ? void 0 : _c.count) != null ? _d : 0
  };
}
async function updateUserRole(db, userId, newRole, adminId, ip) {
  const [user] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId));
  if (!user)
    throw new Error("User not found");
  await db.update(users).set({
    role: newRole,
    updatedAt: /* @__PURE__ */ new Date()
  }).where(eq(users.id, userId));
  await createAuditEntry(db, {
    userId: adminId,
    action: "user.role_changed",
    targetType: "user",
    targetId: userId,
    metadata: { previousRole: user.role, newRole },
    ipAddress: ip
  });
}
async function updateUserStatus(db, userId, newStatus, adminId, ip) {
  const [user] = await db.select({ status: users.status }).from(users).where(eq(users.id, userId));
  if (!user)
    throw new Error("User not found");
  await db.update(users).set({ status: newStatus, updatedAt: /* @__PURE__ */ new Date() }).where(eq(users.id, userId));
  await createAuditEntry(db, {
    userId: adminId,
    action: "user.status_changed",
    targetType: "user",
    targetId: userId,
    metadata: { previousStatus: user.status, newStatus },
    ipAddress: ip
  });
}
async function listReports(db, filters = {}) {
  var _a, _b, _c, _d;
  const conditions = [];
  if (filters.status) {
    conditions.push(eq(reports.status, filters.status));
  }
  const where = conditions.length > 0 ? and(...conditions) : void 0;
  const limit = Math.min((_a = filters.limit) != null ? _a : 20, 100);
  const offset = (_b = filters.offset) != null ? _b : 0;
  const reviewerAlias = alias(users, "reviewer");
  const [rows, countResult] = await Promise.all([
    db.select({
      report: reports,
      reporter: {
        id: users.id,
        username: users.username
      },
      reviewer: {
        id: reviewerAlias.id,
        username: reviewerAlias.username
      }
    }).from(reports).innerJoin(users, eq(reports.reporterId, users.id)).leftJoin(reviewerAlias, eq(reports.reviewedById, reviewerAlias.id)).where(where).orderBy(desc(reports.createdAt)).limit(limit).offset(offset),
    db.select({ count: sql`count(*)::int` }).from(reports).where(where)
  ]);
  const items = rows.map((row) => {
    var _a2;
    return {
      id: row.report.id,
      targetType: row.report.targetType,
      targetId: row.report.targetId,
      reason: row.report.reason,
      description: row.report.description,
      status: row.report.status,
      resolution: row.report.resolution,
      createdAt: row.report.createdAt,
      reporter: { id: row.reporter.id, username: row.reporter.username },
      reviewer: ((_a2 = row.reviewer) == null ? void 0 : _a2.id) ? { id: row.reviewer.id, username: row.reviewer.username } : null
    };
  });
  return { items, total: (_d = (_c = countResult[0]) == null ? void 0 : _c.count) != null ? _d : 0 };
}
async function resolveReport(db, reportId, resolution, status, adminId, ip) {
  const [report] = await db.select().from(reports).where(eq(reports.id, reportId));
  if (!report)
    throw new Error("Report not found");
  await db.update(reports).set({
    status,
    resolution,
    reviewedById: adminId,
    reviewedAt: /* @__PURE__ */ new Date()
  }).where(eq(reports.id, reportId));
  await createAuditEntry(db, {
    userId: adminId,
    action: `report.${status}`,
    targetType: "report",
    targetId: reportId,
    metadata: {
      reason: report.reason,
      targetType: report.targetType,
      targetId: report.targetId
    },
    ipAddress: ip
  });
}
async function getInstanceSettings(db) {
  const rows = await db.select().from(instanceSettings);
  const map = /* @__PURE__ */ new Map();
  for (const row of rows) {
    map.set(row.key, row.value);
  }
  return map;
}
async function setInstanceSetting(db, key, value, adminId, ip) {
  const existing = await db.select().from(instanceSettings).where(eq(instanceSettings.key, key));
  if (existing.length > 0) {
    await db.update(instanceSettings).set({ value, updatedBy: adminId, updatedAt: /* @__PURE__ */ new Date() }).where(eq(instanceSettings.key, key));
  } else {
    await db.insert(instanceSettings).values({
      key,
      value,
      updatedBy: adminId,
      updatedAt: /* @__PURE__ */ new Date()
    });
  }
  await createAuditEntry(db, {
    userId: adminId,
    action: "setting.updated",
    targetType: "instance_setting",
    targetId: key,
    metadata: { value },
    ipAddress: ip
  });
}
async function deleteUser(db, userId, adminId, ip) {
  const [user] = await db.select({ id: users.id, username: users.username }).from(users).where(eq(users.id, userId));
  if (!user)
    throw new Error("User not found");
  await db.transaction(async (tx) => {
    const userLikes = await tx.select({ targetType: likes.targetType, targetId: likes.targetId }).from(likes).where(eq(likes.userId, userId));
    for (const like of userLikes) {
      switch (like.targetType) {
        case "comment":
          await tx.update(comments).set({ likeCount: sql`GREATEST(${comments.likeCount} - 1, 0)` }).where(eq(comments.id, like.targetId));
          break;
        case "post":
          await tx.update(communityPosts).set({ likeCount: sql`GREATEST(${communityPosts.likeCount} - 1, 0)` }).where(eq(communityPosts.id, like.targetId));
          break;
        default:
          await tx.update(contentItems).set({ likeCount: sql`GREATEST(${contentItems.likeCount} - 1, 0)` }).where(eq(contentItems.id, like.targetId));
          break;
      }
    }
    const userComments = await tx.select({ targetType: comments.targetType, targetId: comments.targetId }).from(comments).where(eq(comments.authorId, userId));
    for (const comment of userComments) {
      if (comment.targetType === "post") {
        await tx.update(communityPosts).set({ replyCount: sql`GREATEST(${communityPosts.replyCount} - 1, 0)` }).where(eq(communityPosts.id, comment.targetId));
      } else {
        await tx.update(contentItems).set({ commentCount: sql`GREATEST(${contentItems.commentCount} - 1, 0)` }).where(eq(contentItems.id, comment.targetId));
      }
    }
    const memberships = await tx.select({ communityId: communityMembers.communityId }).from(communityMembers).where(eq(communityMembers.userId, userId));
    for (const m of memberships) {
      await tx.update(communities).set({ memberCount: sql`GREATEST(${communities.memberCount} - 1, 0)` }).where(eq(communities.id, m.communityId));
    }
    const userEnrollments = await tx.select({ pathId: enrollments.pathId }).from(enrollments).where(eq(enrollments.userId, userId));
    for (const e of userEnrollments) {
      await tx.update(learningPaths).set({ enrollmentCount: sql`GREATEST(${learningPaths.enrollmentCount} - 1, 0)` }).where(eq(learningPaths.id, e.pathId));
    }
    await tx.delete(users).where(eq(users.id, userId));
  });
  await createAuditEntry(db, {
    userId: adminId,
    action: "user.deleted",
    targetType: "user",
    targetId: userId,
    metadata: { username: user.username },
    ipAddress: ip
  });
}
async function removeContent(db, contentId, adminId, ip) {
  const [item] = await db.select({
    id: contentItems.id,
    title: contentItems.title,
    authorId: contentItems.authorId
  }).from(contentItems).where(eq(contentItems.id, contentId));
  if (!item)
    throw new Error("Content not found");
  await db.update(contentItems).set({ status: "archived" }).where(eq(contentItems.id, contentId));
  await createAuditEntry(db, {
    userId: adminId,
    action: "content.removed",
    targetType: "content",
    targetId: contentId,
    metadata: { title: item.title, authorId: item.authorId },
    ipAddress: ip
  });
}

async function getUserByUsername(db, username) {
  var _a, _b, _c, _d, _e, _f, _g;
  const rows = await db.select().from(users).where(eq(users.username, username)).limit(1);
  if (rows.length === 0)
    return null;
  const user = rows[0];
  const contentCounts = await db.select({
    type: contentItems.type,
    count: sql`count(*)::int`
  }).from(contentItems).where(and(eq(contentItems.authorId, user.id), eq(contentItems.status, "published"))).groupBy(contentItems.type);
  const countMap = {};
  for (const row of contentCounts) {
    countMap[row.type] = row.count;
  }
  const [followerResult] = await db.select({ count: sql`count(*)::int` }).from(follows).where(eq(follows.followingId, user.id));
  const [followingResult] = await db.select({ count: sql`count(*)::int` }).from(follows).where(eq(follows.followerId, user.id));
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    bio: (_a = user.bio) != null ? _a : null,
    createdAt: user.createdAt,
    stats: {
      projects: (_b = countMap["project"]) != null ? _b : 0,
      guides: (_c = countMap["guide"]) != null ? _c : 0,
      explainers: (_d = countMap["explainer"]) != null ? _d : 0,
      articles: (_e = countMap["article"]) != null ? _e : 0,
      followers: (_f = followerResult == null ? void 0 : followerResult.count) != null ? _f : 0,
      following: (_g = followingResult == null ? void 0 : followingResult.count) != null ? _g : 0
    }
  };
}
async function getUserContent(db, userId, type) {
  return listContent(db, {
    authorId: userId,
    status: "published",
    type,
    limit: 20
  });
}

var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
function getSecurityHeaders(isDev) {
  const headers = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
  };
  if (!isDev) {
    headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
  }
  return headers;
}
function generateNonce() {
  return crypto.randomUUID().replace(/-/g, "");
}
class RateLimitStore {
  constructor() {
    __publicField(this, "windows", /* @__PURE__ */ new Map());
    __publicField(this, "cleanupInterval", null);
    this.cleanupInterval = setInterval(() => this.cleanup(), 6e4);
  }
  /** Check if a key has exceeded its limit. Returns remaining requests. */
  check(key, tier) {
    const now = Date.now();
    const existing = this.windows.get(key);
    if (!existing || now >= existing.resetAt) {
      const entry = { count: 1, resetAt: now + tier.windowMs };
      this.windows.set(key, entry);
      return { allowed: true, remaining: tier.limit - 1, resetAt: entry.resetAt };
    }
    existing.count++;
    if (existing.count > tier.limit) {
      return { allowed: false, remaining: 0, resetAt: existing.resetAt };
    }
    return { allowed: true, remaining: tier.limit - existing.count, resetAt: existing.resetAt };
  }
  /** Remove expired entries */
  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.windows) {
      if (now >= entry.resetAt) {
        this.windows.delete(key);
      }
    }
  }
  /** Stop the cleanup interval (for tests/shutdown) */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}
const DEFAULT_TIERS = {
  auth: { limit: 5, windowMs: 6e4 },
  social: { limit: 30, windowMs: 6e4 },
  federation: { limit: 60, windowMs: 6e4 },
  api: { limit: 60, windowMs: 6e4 },
  general: { limit: 120, windowMs: 6e4 }
};
function getTierForPath(pathname) {
  if (pathname.startsWith("/auth/") || pathname.startsWith("/api/auth/")) {
    return DEFAULT_TIERS.auth;
  }
  if (pathname.startsWith("/api/social/")) {
    return DEFAULT_TIERS.social;
  }
  if (pathname.startsWith("/api/federation/") || pathname.startsWith("/inbox") || pathname.startsWith("/users/")) {
    return DEFAULT_TIERS.federation;
  }
  if (pathname.startsWith("/api/")) {
    return DEFAULT_TIERS.api;
  }
  return DEFAULT_TIERS.general;
}
function shouldSkipRateLimit(pathname) {
  return pathname.startsWith("/_app/") || pathname.startsWith("/favicon") || pathname.endsWith(".css") || pathname.endsWith(".js") || pathname.endsWith(".png") || pathname.endsWith(".jpg") || pathname.endsWith(".svg") || pathname.endsWith(".woff2");
}
function checkRateLimit(store, ip, pathname) {
  const tier = getTierForPath(pathname);
  const key = `${ip}:${pathname.split("/").slice(0, 3).join("/")}`;
  const result = store.check(key, tier);
  const headers = {
    "X-RateLimit-Limit": String(tier.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1e3))
  };
  if (!result.allowed) {
    const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1e3);
    headers["Retry-After"] = String(retryAfter);
  }
  return { result, headers };
}

async function listContests(db, filters = {}) {
  return { items: [], total: 0 };
}
async function getContestBySlug(db, slug) {
  return null;
}
async function createContest(db, input) {
  var _a, _b, _c, _d, _e, _f;
  const id = crypto.randomUUID();
  return {
    id,
    title: input.title,
    slug: input.slug,
    description: (_a = input.description) != null ? _a : null,
    status: "draft",
    startDate: (_b = input.startDate) != null ? _b : null,
    endDate: (_c = input.endDate) != null ? _c : null,
    entryCount: 0,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    rules: (_d = input.rules) != null ? _d : null,
    prizes: (_e = input.prizes) != null ? _e : null,
    judgingCriteria: (_f = input.judgingCriteria) != null ? _f : null,
    createdBy: input.createdBy
  };
}
async function updateContest(db, slug, data) {
  return null;
}
async function listContestEntries(db, contestId) {
  return [];
}
async function submitContestEntry(db, contestId, contentId, userId) {
  return {
    id: crypto.randomUUID(),
    contestId,
    contentId,
    userId,
    score: null,
    rank: null,
    submittedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function judgeContestEntry(db, entryId, score, judgeId) {
}

async function listNotifications(db, filters) {
  return { items: [], total: 0 };
}
async function getUnreadCount(db, userId) {
  return 0;
}
async function markNotificationRead(db, notificationId, userId) {
}
async function markAllNotificationsRead(db, userId) {
}
async function deleteNotification(db, notificationId, userId) {
}

async function listConversations(db, userId) {
  return [];
}
async function getConversationMessages(db, conversationId, userId) {
  return [];
}
async function createConversation(db, participants) {
  const id = crypto.randomUUID();
  return {
    id,
    participants,
    lastMessageAt: /* @__PURE__ */ new Date(),
    lastMessage: null,
    createdAt: /* @__PURE__ */ new Date()
  };
}
async function sendMessage(db, conversationId, senderId, body) {
  const id = crypto.randomUUID();
  return {
    id,
    conversationId,
    senderId,
    body,
    createdAt: /* @__PURE__ */ new Date(),
    readAt: null
  };
}
async function markMessagesRead(db, conversationId, userId) {
}

async function listVideos(db, filters = {}) {
  return { items: [], total: 0 };
}
async function getVideoById(db, id) {
  return null;
}
async function createVideo(db, input) {
  var _a, _b, _c, _d;
  const id = crypto.randomUUID();
  return {
    id,
    title: input.title,
    url: input.url,
    thumbnailUrl: (_a = input.thumbnailUrl) != null ? _a : null,
    duration: (_b = input.duration) != null ? _b : null,
    viewCount: 0,
    categoryId: (_c = input.categoryId) != null ? _c : null,
    authorId: input.authorId,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    description: (_d = input.description) != null ? _d : null,
    tags: []
  };
}
async function listVideoCategories(db) {
  return [];
}
async function incrementVideoViewCount(db, id) {
}

const store = new RateLimitStore();
const _8L1GON = defineEventHandler((event) => {
  var _a, _b;
  const url = getRequestURL(event);
  const pathname = url.pathname;
  if (shouldSkipRateLimit(pathname)) return;
  const ip = ((_b = (_a = getRequestHeader(event, "x-forwarded-for")) == null ? void 0 : _a.split(",")[0]) == null ? void 0 : _b.trim()) || getRequestHeader(event, "x-real-ip") || "unknown";
  const { result, headers: rlHeaders } = checkRateLimit(store, ip, pathname);
  for (const [key, value] of Object.entries(rlHeaders)) {
    setResponseHeader(event, key, value);
  }
  if (!result.allowed) {
    throw createError$1({
      statusCode: 429,
      statusMessage: "Too Many Requests"
    });
  }
  const nonce = generateNonce();
  const headers = getSecurityHeaders(nonce);
  for (const [key, value] of Object.entries(headers)) {
    setResponseHeader(event, key, value);
  }
});

const _SxA8c9 = defineEventHandler(() => {});

const _lazy_FHTzZS = () => import('../routes/api/admin/audit.get.mjs');
const _lazy_8Q5Vj4 = () => import('../routes/api/admin/content/_id_.delete.mjs');
const _lazy_2Cg2ym = () => import('../routes/api/admin/reports.get.mjs');
const _lazy_JBIzUV = () => import('../routes/api/admin/reports/_id/resolve.post.mjs');
const _lazy_few2l1 = () => import('../routes/api/admin/settings.get.mjs');
const _lazy_kn45dY = () => import('../routes/api/admin/settings.put.mjs');
const _lazy_k251rA = () => import('../routes/api/admin/stats.get.mjs');
const _lazy_Wew5oZ = () => import('../routes/api/admin/users.get.mjs');
const _lazy_AncTe6 = () => import('../routes/api/admin/users/_id_.delete.mjs');
const _lazy_rnRD3x = () => import('../routes/api/admin/users/_id/role.put.mjs');
const _lazy_mSN0U6 = () => import('../routes/api/admin/users/_id/status.put.mjs');
const _lazy_rdtCyC = () => import('../routes/api/communities/_slug_.get.mjs');
const _lazy_FXFCIP = () => import('../routes/api/communities/_slug/bans.get.mjs');
const _lazy_76RHNH = () => import('../routes/api/communities/_slug/bans.post.mjs');
const _lazy_XceibV = () => import('../routes/api/communities/_slug/bans/_userId_.delete.mjs');
const _lazy_fH_iYK = () => import('../routes/api/communities/_slug/invites.get.mjs');
const _lazy_WWo4X_ = () => import('../routes/api/communities/_slug/invites.post.mjs');
const _lazy_69seWK = () => import('../routes/api/communities/_slug/join.post.mjs');
const _lazy_2jYnWX = () => import('../routes/api/communities/_slug/leave.post.mjs');
const _lazy_g_ykBy = () => import('../routes/api/communities/_slug/members.get.mjs');
const _lazy_AQHBBL = () => import('../routes/api/communities/_slug/members/_userId_.delete.mjs');
const _lazy_HViDPq = () => import('../routes/api/communities/_slug/members/_userId_.put.mjs');
const _lazy_APnU2p = () => import('../routes/api/communities/_slug/posts/_postId_.delete.mjs');
const _lazy_cArUZn = () => import('../routes/api/communities/_slug/posts/_postId/replies.get.mjs');
const _lazy_thmyQh = () => import('../routes/api/communities/_slug/posts/_postId/replies.post.mjs');
const _lazy_uvlwsD = () => import('../routes/api/communities/_slug/index.get.mjs');
const _lazy_Xw9Ewa = () => import('../routes/api/communities/_slug/index.post.mjs');
const _lazy_svxkl4 = () => import('../routes/api/communities/_slug/share.post.mjs');
const _lazy_i0eoRo = () => import('../routes/api/index.get.mjs');
const _lazy_jYpP2c = () => import('../routes/api/index.post.mjs');
const _lazy_aketXu = () => import('../routes/api/content/_id_.delete.mjs');
const _lazy_wWJcsH = () => import('../routes/api/content/_id_.put.mjs');
const _lazy_nvGW0A = () => import('../routes/api/content/_id/publish.post.mjs');
const _lazy_5xwqzL = () => import('../routes/api/content/_id/view.post.mjs');
const _lazy_vM03Hh = () => import('../routes/api/content/_slug_.get.mjs');
const _lazy_x5oiU1 = () => import('../routes/api/index.get2.mjs');
const _lazy_d1wpDk = () => import('../routes/api/index.post2.mjs');
const _lazy_T6VRVr = () => import('../routes/api/contests/_slug_.get.mjs');
const _lazy_L6tGde = () => import('../routes/api/contests/_slug_.put.mjs');
const _lazy_aWSNzD = () => import('../routes/api/contests/_slug/entries.get.mjs');
const _lazy_2Vbyzt = () => import('../routes/api/contests/_slug/entries.post.mjs');
const _lazy_KvT54o = () => import('../routes/api/contests/_slug/judge.post.mjs');
const _lazy_DECgZ5 = () => import('../routes/api/index.get3.mjs');
const _lazy_XOr96X = () => import('../routes/api/index.post3.mjs');
const _lazy_4b7WPd = () => import('../routes/api/docs/_siteSlug_.delete.mjs');
const _lazy_XjmqdF = () => import('../routes/api/docs/_siteSlug_.get.mjs');
const _lazy_HQRiJL = () => import('../routes/api/docs/_siteSlug_.put.mjs');
const _lazy_Lm1t5u = () => import('../routes/api/docs/_siteSlug/nav.get.mjs');
const _lazy_TB2PWK = () => import('../routes/api/docs/_siteSlug/pages.get.mjs');
const _lazy_t6h8n4 = () => import('../routes/api/docs/_siteSlug/pages.post.mjs');
const _lazy_uvwSIz = () => import('../routes/api/docs/_siteSlug/pages/_pageId_.put.mjs');
const _lazy_kwKJ8K = () => import('../routes/api/docs/_siteSlug/search.get.mjs');
const _lazy_9ZpYPh = () => import('../routes/api/docs/_siteSlug/versions.post.mjs');
const _lazy_qgBaDe = () => import('../routes/api/index.get4.mjs');
const _lazy_d2gy1E = () => import('../routes/api/index.post4.mjs');
const _lazy_Z1yxwm = () => import('../routes/api/health.get.mjs');
const _lazy_VFAI03 = () => import('../routes/api/learn/_slug_.delete.mjs');
const _lazy_PrU_Zc = () => import('../routes/api/learn/_slug_.get.mjs');
const _lazy_Ub23ql = () => import('../routes/api/learn/_slug_.put.mjs');
const _lazy_1zJXwa = () => import('../routes/api/learn/_slug/_lessonSlug_.get.mjs');
const _lazy_OyZPOn = () => import('../routes/api/learn/_slug/_lessonSlug/complete.post.mjs');
const _lazy_DQT6YB = () => import('../routes/api/learn/_slug/enroll.post.mjs');
const _lazy_Rwf2_Q = () => import('../routes/api/learn/_slug/lessons.post.mjs');
const _lazy_JWIgCr = () => import('../routes/api/learn/_slug/modules.post.mjs');
const _lazy_Lmvao6 = () => import('../routes/api/learn/_slug/modules/_moduleId_.put.mjs');
const _lazy_d1qV60 = () => import('../routes/api/learn/_slug/publish.post.mjs');
const _lazy_QicDxD = () => import('../routes/api/learn/_slug/unenroll.post.mjs');
const _lazy_R_OGzY = () => import('../routes/api/learn/certificates.get.mjs');
const _lazy_KegwTJ = () => import('../routes/api/learn/enrollments.get.mjs');
const _lazy_y83Zc3 = () => import('../routes/api/index.get5.mjs');
const _lazy_QJK2we = () => import('../routes/api/index.post5.mjs');
const _lazy_MJWCL7 = () => import('../routes/api/messages/_conversationId_.get.mjs');
const _lazy_bdtAxU = () => import('../routes/api/messages/_conversationId_.post.mjs');
const _lazy_hB4OMw = () => import('../routes/api/index.get6.mjs');
const _lazy_FyqIjH = () => import('../routes/api/index.post6.mjs');
const _lazy_vP0SVO = () => import('../routes/api/notifications/_id_.delete.mjs');
const _lazy_25WxSl = () => import('../routes/api/notifications/count.get.mjs');
const _lazy_jIohCW = () => import('../routes/api/index.get7.mjs');
const _lazy_RPIH2G = () => import('../routes/api/notifications/read.post.mjs');
const _lazy_Jk2q9O = () => import('../routes/api/search.get.mjs');
const _lazy_RZKWJe = () => import('../routes/api/social/bookmark.post.mjs');
const _lazy_zTkwK8 = () => import('../routes/api/social/comments.get.mjs');
const _lazy_j5WvfR = () => import('../routes/api/social/comments.post.mjs');
const _lazy_BFGQGB = () => import('../routes/api/social/comments/_id_.delete.mjs');
const _lazy_H_NnLL = () => import('../routes/api/social/like.get.mjs');
const _lazy__1MI6F = () => import('../routes/api/social/like.post.mjs');
const _lazy_9ZZaRw = () => import('../routes/api/stats.get.mjs');
const _lazy_H03rTy = () => import('../routes/api/users/_username_.get.mjs');
const _lazy_04EajR = () => import('../routes/api/users/_username/content.get.mjs');
const _lazy_41m87_ = () => import('../routes/api/videos/_id_.get.mjs');
const _lazy_TNPVVm = () => import('../routes/api/videos/categories.get.mjs');
const _lazy_SM0QnG = () => import('../routes/api/index.get8.mjs');
const _lazy_V2m1Rm = () => import('../routes/api/index.post7.mjs');
const _lazy_UfE1f_ = () => import('../routes/.well-known/nodeinfo.mjs');
const _lazy_SYVK3d = () => import('../routes/.well-known/webfinger.mjs');
const _lazy_JOhz5F = () => import('../routes/inbox.mjs');
const _lazy_5I7kwM = () => import('../routes/nodeinfo/2.1.mjs');
const _lazy_8dZriH = () => import('../routes/users/_username_.mjs');
const _lazy_iUTKuI = () => import('../routes/users/_username/followers.mjs');
const _lazy_8IfJxf = () => import('../routes/users/_username/following.mjs');
const _lazy_joGsUR = () => import('../routes/users/_username/inbox.mjs');
const _lazy_pgkIhY = () => import('../routes/users/_username/outbox.mjs');
const _lazy_Ax7YdN = () => import('../routes/renderer.mjs').then(function (n) { return n.r; });

const handlers = [
  { route: '', handler: _M7d2_t, lazy: false, middleware: true, method: undefined },
  { route: '', handler: _KEWnTz, lazy: false, middleware: true, method: undefined },
  { route: '', handler: _8L1GON, lazy: false, middleware: true, method: undefined },
  { route: '/api/admin/audit', handler: _lazy_FHTzZS, lazy: true, middleware: false, method: "get" },
  { route: '/api/admin/content/:id', handler: _lazy_8Q5Vj4, lazy: true, middleware: false, method: "delete" },
  { route: '/api/admin/reports', handler: _lazy_2Cg2ym, lazy: true, middleware: false, method: "get" },
  { route: '/api/admin/reports/:id/resolve', handler: _lazy_JBIzUV, lazy: true, middleware: false, method: "post" },
  { route: '/api/admin/settings', handler: _lazy_few2l1, lazy: true, middleware: false, method: "get" },
  { route: '/api/admin/settings', handler: _lazy_kn45dY, lazy: true, middleware: false, method: "put" },
  { route: '/api/admin/stats', handler: _lazy_k251rA, lazy: true, middleware: false, method: "get" },
  { route: '/api/admin/users', handler: _lazy_Wew5oZ, lazy: true, middleware: false, method: "get" },
  { route: '/api/admin/users/:id', handler: _lazy_AncTe6, lazy: true, middleware: false, method: "delete" },
  { route: '/api/admin/users/:id/role', handler: _lazy_rnRD3x, lazy: true, middleware: false, method: "put" },
  { route: '/api/admin/users/:id/status', handler: _lazy_mSN0U6, lazy: true, middleware: false, method: "put" },
  { route: '/api/communities/:slug', handler: _lazy_rdtCyC, lazy: true, middleware: false, method: "get" },
  { route: '/api/communities/:slug/bans', handler: _lazy_FXFCIP, lazy: true, middleware: false, method: "get" },
  { route: '/api/communities/:slug/bans', handler: _lazy_76RHNH, lazy: true, middleware: false, method: "post" },
  { route: '/api/communities/:slug/bans/:userId', handler: _lazy_XceibV, lazy: true, middleware: false, method: "delete" },
  { route: '/api/communities/:slug/invites', handler: _lazy_fH_iYK, lazy: true, middleware: false, method: "get" },
  { route: '/api/communities/:slug/invites', handler: _lazy_WWo4X_, lazy: true, middleware: false, method: "post" },
  { route: '/api/communities/:slug/join', handler: _lazy_69seWK, lazy: true, middleware: false, method: "post" },
  { route: '/api/communities/:slug/leave', handler: _lazy_2jYnWX, lazy: true, middleware: false, method: "post" },
  { route: '/api/communities/:slug/members', handler: _lazy_g_ykBy, lazy: true, middleware: false, method: "get" },
  { route: '/api/communities/:slug/members/:userId', handler: _lazy_AQHBBL, lazy: true, middleware: false, method: "delete" },
  { route: '/api/communities/:slug/members/:userId', handler: _lazy_HViDPq, lazy: true, middleware: false, method: "put" },
  { route: '/api/communities/:slug/posts/:postId', handler: _lazy_APnU2p, lazy: true, middleware: false, method: "delete" },
  { route: '/api/communities/:slug/posts/:postId/replies', handler: _lazy_cArUZn, lazy: true, middleware: false, method: "get" },
  { route: '/api/communities/:slug/posts/:postId/replies', handler: _lazy_thmyQh, lazy: true, middleware: false, method: "post" },
  { route: '/api/communities/:slug/posts', handler: _lazy_uvlwsD, lazy: true, middleware: false, method: "get" },
  { route: '/api/communities/:slug/posts', handler: _lazy_Xw9Ewa, lazy: true, middleware: false, method: "post" },
  { route: '/api/communities/:slug/share', handler: _lazy_svxkl4, lazy: true, middleware: false, method: "post" },
  { route: '/api/communities', handler: _lazy_i0eoRo, lazy: true, middleware: false, method: "get" },
  { route: '/api/communities', handler: _lazy_jYpP2c, lazy: true, middleware: false, method: "post" },
  { route: '/api/content/:id', handler: _lazy_aketXu, lazy: true, middleware: false, method: "delete" },
  { route: '/api/content/:id', handler: _lazy_wWJcsH, lazy: true, middleware: false, method: "put" },
  { route: '/api/content/:id/publish', handler: _lazy_nvGW0A, lazy: true, middleware: false, method: "post" },
  { route: '/api/content/:id/view', handler: _lazy_5xwqzL, lazy: true, middleware: false, method: "post" },
  { route: '/api/content/:slug', handler: _lazy_vM03Hh, lazy: true, middleware: false, method: "get" },
  { route: '/api/content', handler: _lazy_x5oiU1, lazy: true, middleware: false, method: "get" },
  { route: '/api/content', handler: _lazy_d1wpDk, lazy: true, middleware: false, method: "post" },
  { route: '/api/contests/:slug', handler: _lazy_T6VRVr, lazy: true, middleware: false, method: "get" },
  { route: '/api/contests/:slug', handler: _lazy_L6tGde, lazy: true, middleware: false, method: "put" },
  { route: '/api/contests/:slug/entries', handler: _lazy_aWSNzD, lazy: true, middleware: false, method: "get" },
  { route: '/api/contests/:slug/entries', handler: _lazy_2Vbyzt, lazy: true, middleware: false, method: "post" },
  { route: '/api/contests/:slug/judge', handler: _lazy_KvT54o, lazy: true, middleware: false, method: "post" },
  { route: '/api/contests', handler: _lazy_DECgZ5, lazy: true, middleware: false, method: "get" },
  { route: '/api/contests', handler: _lazy_XOr96X, lazy: true, middleware: false, method: "post" },
  { route: '/api/docs/:siteSlug', handler: _lazy_4b7WPd, lazy: true, middleware: false, method: "delete" },
  { route: '/api/docs/:siteSlug', handler: _lazy_XjmqdF, lazy: true, middleware: false, method: "get" },
  { route: '/api/docs/:siteSlug', handler: _lazy_HQRiJL, lazy: true, middleware: false, method: "put" },
  { route: '/api/docs/:siteSlug/nav', handler: _lazy_Lm1t5u, lazy: true, middleware: false, method: "get" },
  { route: '/api/docs/:siteSlug/pages', handler: _lazy_TB2PWK, lazy: true, middleware: false, method: "get" },
  { route: '/api/docs/:siteSlug/pages', handler: _lazy_t6h8n4, lazy: true, middleware: false, method: "post" },
  { route: '/api/docs/:siteSlug/pages/:pageId', handler: _lazy_uvwSIz, lazy: true, middleware: false, method: "put" },
  { route: '/api/docs/:siteSlug/search', handler: _lazy_kwKJ8K, lazy: true, middleware: false, method: "get" },
  { route: '/api/docs/:siteSlug/versions', handler: _lazy_9ZpYPh, lazy: true, middleware: false, method: "post" },
  { route: '/api/docs', handler: _lazy_qgBaDe, lazy: true, middleware: false, method: "get" },
  { route: '/api/docs', handler: _lazy_d2gy1E, lazy: true, middleware: false, method: "post" },
  { route: '/api/health', handler: _lazy_Z1yxwm, lazy: true, middleware: false, method: "get" },
  { route: '/api/learn/:slug', handler: _lazy_VFAI03, lazy: true, middleware: false, method: "delete" },
  { route: '/api/learn/:slug', handler: _lazy_PrU_Zc, lazy: true, middleware: false, method: "get" },
  { route: '/api/learn/:slug', handler: _lazy_Ub23ql, lazy: true, middleware: false, method: "put" },
  { route: '/api/learn/:slug/:lessonSlug', handler: _lazy_1zJXwa, lazy: true, middleware: false, method: "get" },
  { route: '/api/learn/:slug/:lessonSlug/complete', handler: _lazy_OyZPOn, lazy: true, middleware: false, method: "post" },
  { route: '/api/learn/:slug/enroll', handler: _lazy_DQT6YB, lazy: true, middleware: false, method: "post" },
  { route: '/api/learn/:slug/lessons', handler: _lazy_Rwf2_Q, lazy: true, middleware: false, method: "post" },
  { route: '/api/learn/:slug/modules', handler: _lazy_JWIgCr, lazy: true, middleware: false, method: "post" },
  { route: '/api/learn/:slug/modules/:moduleId', handler: _lazy_Lmvao6, lazy: true, middleware: false, method: "put" },
  { route: '/api/learn/:slug/publish', handler: _lazy_d1qV60, lazy: true, middleware: false, method: "post" },
  { route: '/api/learn/:slug/unenroll', handler: _lazy_QicDxD, lazy: true, middleware: false, method: "post" },
  { route: '/api/learn/certificates', handler: _lazy_R_OGzY, lazy: true, middleware: false, method: "get" },
  { route: '/api/learn/enrollments', handler: _lazy_KegwTJ, lazy: true, middleware: false, method: "get" },
  { route: '/api/learn', handler: _lazy_y83Zc3, lazy: true, middleware: false, method: "get" },
  { route: '/api/learn', handler: _lazy_QJK2we, lazy: true, middleware: false, method: "post" },
  { route: '/api/messages/:conversationId', handler: _lazy_MJWCL7, lazy: true, middleware: false, method: "get" },
  { route: '/api/messages/:conversationId', handler: _lazy_bdtAxU, lazy: true, middleware: false, method: "post" },
  { route: '/api/messages', handler: _lazy_hB4OMw, lazy: true, middleware: false, method: "get" },
  { route: '/api/messages', handler: _lazy_FyqIjH, lazy: true, middleware: false, method: "post" },
  { route: '/api/notifications/:id', handler: _lazy_vP0SVO, lazy: true, middleware: false, method: "delete" },
  { route: '/api/notifications/count', handler: _lazy_25WxSl, lazy: true, middleware: false, method: "get" },
  { route: '/api/notifications', handler: _lazy_jIohCW, lazy: true, middleware: false, method: "get" },
  { route: '/api/notifications/read', handler: _lazy_RPIH2G, lazy: true, middleware: false, method: "post" },
  { route: '/api/search', handler: _lazy_Jk2q9O, lazy: true, middleware: false, method: "get" },
  { route: '/api/social/bookmark', handler: _lazy_RZKWJe, lazy: true, middleware: false, method: "post" },
  { route: '/api/social/comments', handler: _lazy_zTkwK8, lazy: true, middleware: false, method: "get" },
  { route: '/api/social/comments', handler: _lazy_j5WvfR, lazy: true, middleware: false, method: "post" },
  { route: '/api/social/comments/:id', handler: _lazy_BFGQGB, lazy: true, middleware: false, method: "delete" },
  { route: '/api/social/like', handler: _lazy_H_NnLL, lazy: true, middleware: false, method: "get" },
  { route: '/api/social/like', handler: _lazy__1MI6F, lazy: true, middleware: false, method: "post" },
  { route: '/api/stats', handler: _lazy_9ZZaRw, lazy: true, middleware: false, method: "get" },
  { route: '/api/users/:username', handler: _lazy_H03rTy, lazy: true, middleware: false, method: "get" },
  { route: '/api/users/:username/content', handler: _lazy_04EajR, lazy: true, middleware: false, method: "get" },
  { route: '/api/videos/:id', handler: _lazy_41m87_, lazy: true, middleware: false, method: "get" },
  { route: '/api/videos/categories', handler: _lazy_TNPVVm, lazy: true, middleware: false, method: "get" },
  { route: '/api/videos', handler: _lazy_SM0QnG, lazy: true, middleware: false, method: "get" },
  { route: '/api/videos', handler: _lazy_V2m1Rm, lazy: true, middleware: false, method: "post" },
  { route: '/.well-known/nodeinfo', handler: _lazy_UfE1f_, lazy: true, middleware: false, method: undefined },
  { route: '/.well-known/webfinger', handler: _lazy_SYVK3d, lazy: true, middleware: false, method: undefined },
  { route: '/inbox', handler: _lazy_JOhz5F, lazy: true, middleware: false, method: undefined },
  { route: '/nodeinfo/2.1', handler: _lazy_5I7kwM, lazy: true, middleware: false, method: undefined },
  { route: '/users/:username', handler: _lazy_8dZriH, lazy: true, middleware: false, method: undefined },
  { route: '/users/:username/followers', handler: _lazy_iUTKuI, lazy: true, middleware: false, method: undefined },
  { route: '/users/:username/following', handler: _lazy_8IfJxf, lazy: true, middleware: false, method: undefined },
  { route: '/users/:username/inbox', handler: _lazy_joGsUR, lazy: true, middleware: false, method: undefined },
  { route: '/users/:username/outbox', handler: _lazy_pgkIhY, lazy: true, middleware: false, method: undefined },
  { route: '/__nuxt_error', handler: _lazy_Ax7YdN, lazy: true, middleware: false, method: undefined },
  { route: '/__nuxt_island/**', handler: _SxA8c9, lazy: false, middleware: false, method: undefined },
  { route: '/**', handler: _lazy_Ax7YdN, lazy: true, middleware: false, method: undefined }
];

function createNitroApp() {
  const config = useRuntimeConfig();
  const hooks = createHooks();
  const captureError = (error, context = {}) => {
    const promise = hooks.callHookParallel("error", error, context).catch((error_) => {
      console.error("Error while capturing another error", error_);
    });
    if (context.event && isEvent(context.event)) {
      const errors = context.event.context.nitro?.errors;
      if (errors) {
        errors.push({ error, context });
      }
      if (context.event.waitUntil) {
        context.event.waitUntil(promise);
      }
    }
  };
  const h3App = createApp({
    debug: destr(false),
    onError: (error, event) => {
      captureError(error, { event, tags: ["request"] });
      return errorHandler(error, event);
    },
    onRequest: async (event) => {
      event.context.nitro = event.context.nitro || { errors: [] };
      const fetchContext = event.node.req?.__unenv__;
      if (fetchContext?._platform) {
        event.context = {
          _platform: fetchContext?._platform,
          // #3335
          ...fetchContext._platform,
          ...event.context
        };
      }
      if (!event.context.waitUntil && fetchContext?.waitUntil) {
        event.context.waitUntil = fetchContext.waitUntil;
      }
      event.fetch = (req, init) => fetchWithEvent(event, req, init, { fetch: localFetch });
      event.$fetch = (req, init) => fetchWithEvent(event, req, init, {
        fetch: $fetch
      });
      event.waitUntil = (promise) => {
        if (!event.context.nitro._waitUntilPromises) {
          event.context.nitro._waitUntilPromises = [];
        }
        event.context.nitro._waitUntilPromises.push(promise);
        if (event.context.waitUntil) {
          event.context.waitUntil(promise);
        }
      };
      event.captureError = (error, context) => {
        captureError(error, { event, ...context });
      };
      await nitroApp$1.hooks.callHook("request", event).catch((error) => {
        captureError(error, { event, tags: ["request"] });
      });
    },
    onBeforeResponse: async (event, response) => {
      await nitroApp$1.hooks.callHook("beforeResponse", event, response).catch((error) => {
        captureError(error, { event, tags: ["request", "response"] });
      });
    },
    onAfterResponse: async (event, response) => {
      await nitroApp$1.hooks.callHook("afterResponse", event, response).catch((error) => {
        captureError(error, { event, tags: ["request", "response"] });
      });
    }
  });
  const router = createRouter({
    preemptive: true
  });
  const nodeHandler = toNodeListener(h3App);
  const localCall = (aRequest) => b(
    nodeHandler,
    aRequest
  );
  const localFetch = (input, init) => {
    if (!input.toString().startsWith("/")) {
      return globalThis.fetch(input, init);
    }
    return C(
      nodeHandler,
      input,
      init
    ).then((response) => normalizeFetchResponse(response));
  };
  const $fetch = createFetch({
    fetch: localFetch,
    Headers: Headers$1,
    defaults: { baseURL: config.app.baseURL }
  });
  globalThis.$fetch = $fetch;
  h3App.use(createRouteRulesHandler({ localFetch }));
  for (const h of handlers) {
    let handler = h.lazy ? lazyEventHandler(h.handler) : h.handler;
    if (h.middleware || !h.route) {
      const middlewareBase = (config.app.baseURL + (h.route || "/")).replace(
        /\/+/g,
        "/"
      );
      h3App.use(middlewareBase, handler);
    } else {
      const routeRules = getRouteRulesForPath(
        h.route.replace(/:\w+|\*\*/g, "_")
      );
      if (routeRules.cache) {
        handler = cachedEventHandler(handler, {
          group: "nitro/routes",
          ...routeRules.cache
        });
      }
      router.use(h.route, handler, h.method);
    }
  }
  h3App.use(config.app.baseURL, router.handler);
  const app = {
    hooks,
    h3App,
    router,
    localCall,
    localFetch,
    captureError
  };
  return app;
}
function runNitroPlugins(nitroApp2) {
  for (const plugin of plugins) {
    try {
      plugin(nitroApp2);
    } catch (error) {
      nitroApp2.captureError(error, { tags: ["plugin"] });
      throw error;
    }
  }
}
const nitroApp$1 = createNitroApp();
function useNitroApp() {
  return nitroApp$1;
}
runNitroPlugins(nitroApp$1);

function defineRenderHandler(render) {
  const runtimeConfig = useRuntimeConfig();
  return eventHandler(async (event) => {
    const nitroApp = useNitroApp();
    const ctx = { event, render, response: void 0 };
    await nitroApp.hooks.callHook("render:before", ctx);
    if (!ctx.response) {
      if (event.path === `${runtimeConfig.app.baseURL}favicon.ico`) {
        setResponseHeader(event, "Content-Type", "image/x-icon");
        return send(
          event,
          "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
        );
      }
      ctx.response = await ctx.render(event);
      if (!ctx.response) {
        const _currentStatus = getResponseStatus(event);
        setResponseStatus(event, _currentStatus === 200 ? 500 : _currentStatus);
        return send(
          event,
          "No response returned from render handler: " + event.path
        );
      }
    }
    await nitroApp.hooks.callHook("render:response", ctx.response, ctx);
    if (ctx.response.headers) {
      setResponseHeaders(event, ctx.response.headers);
    }
    if (ctx.response.statusCode || ctx.response.statusMessage) {
      setResponseStatus(
        event,
        ctx.response.statusCode,
        ctx.response.statusMessage
      );
    }
    return ctx.response.body;
  });
}

const debug = (...args) => {
};
function GracefulShutdown(server, opts) {
  opts = opts || {};
  const options = Object.assign(
    {
      signals: "SIGINT SIGTERM",
      timeout: 3e4,
      development: false,
      forceExit: true,
      onShutdown: (signal) => Promise.resolve(signal),
      preShutdown: (signal) => Promise.resolve(signal)
    },
    opts
  );
  let isShuttingDown = false;
  const connections = {};
  let connectionCounter = 0;
  const secureConnections = {};
  let secureConnectionCounter = 0;
  let failed = false;
  let finalRun = false;
  function onceFactory() {
    let called = false;
    return (emitter, events, callback) => {
      function call() {
        if (!called) {
          called = true;
          return Reflect.apply(callback, this, arguments);
        }
      }
      for (const e of events) {
        emitter.on(e, call);
      }
    };
  }
  const signals = options.signals.split(" ").map((s) => s.trim()).filter((s) => s.length > 0);
  const once = onceFactory();
  once(process, signals, (signal) => {
    debug("received shut down signal", signal);
    shutdown(signal).then(() => {
      if (options.forceExit) {
        process.exit(failed ? 1 : 0);
      }
    }).catch((error) => {
      debug("server shut down error occurred", error);
      process.exit(1);
    });
  });
  function isFunction(functionToCheck) {
    const getType = Object.prototype.toString.call(functionToCheck);
    return /^\[object\s([A-Za-z]+)?Function]$/.test(getType);
  }
  function destroy(socket, force = false) {
    if (socket._isIdle && isShuttingDown || force) {
      socket.destroy();
      if (socket.server instanceof http.Server) {
        delete connections[socket._connectionId];
      } else {
        delete secureConnections[socket._connectionId];
      }
    }
  }
  function destroyAllConnections(force = false) {
    debug("Destroy Connections : " + (force ? "forced close" : "close"));
    let counter = 0;
    let secureCounter = 0;
    for (const key of Object.keys(connections)) {
      const socket = connections[key];
      const serverResponse = socket._httpMessage;
      if (serverResponse && !force) {
        if (!serverResponse.headersSent) {
          serverResponse.setHeader("connection", "close");
        }
      } else {
        counter++;
        destroy(socket);
      }
    }
    debug("Connections destroyed : " + counter);
    debug("Connection Counter    : " + connectionCounter);
    for (const key of Object.keys(secureConnections)) {
      const socket = secureConnections[key];
      const serverResponse = socket._httpMessage;
      if (serverResponse && !force) {
        if (!serverResponse.headersSent) {
          serverResponse.setHeader("connection", "close");
        }
      } else {
        secureCounter++;
        destroy(socket);
      }
    }
    debug("Secure Connections destroyed : " + secureCounter);
    debug("Secure Connection Counter    : " + secureConnectionCounter);
  }
  server.on("request", (req, res) => {
    req.socket._isIdle = false;
    if (isShuttingDown && !res.headersSent) {
      res.setHeader("connection", "close");
    }
    res.on("finish", () => {
      req.socket._isIdle = true;
      destroy(req.socket);
    });
  });
  server.on("connection", (socket) => {
    if (isShuttingDown) {
      socket.destroy();
    } else {
      const id = connectionCounter++;
      socket._isIdle = true;
      socket._connectionId = id;
      connections[id] = socket;
      socket.once("close", () => {
        delete connections[socket._connectionId];
      });
    }
  });
  server.on("secureConnection", (socket) => {
    if (isShuttingDown) {
      socket.destroy();
    } else {
      const id = secureConnectionCounter++;
      socket._isIdle = true;
      socket._connectionId = id;
      secureConnections[id] = socket;
      socket.once("close", () => {
        delete secureConnections[socket._connectionId];
      });
    }
  });
  process.on("close", () => {
    debug("closed");
  });
  function shutdown(sig) {
    function cleanupHttp() {
      destroyAllConnections();
      debug("Close http server");
      return new Promise((resolve, reject) => {
        server.close((err) => {
          if (err) {
            return reject(err);
          }
          return resolve(true);
        });
      });
    }
    debug("shutdown signal - " + sig);
    if (options.development) {
      debug("DEV-Mode - immediate forceful shutdown");
      return process.exit(0);
    }
    function finalHandler() {
      if (!finalRun) {
        finalRun = true;
        if (options.finally && isFunction(options.finally)) {
          debug("executing finally()");
          options.finally();
        }
      }
      return Promise.resolve();
    }
    function waitForReadyToShutDown(totalNumInterval) {
      debug(`waitForReadyToShutDown... ${totalNumInterval}`);
      if (totalNumInterval === 0) {
        debug(
          `Could not close connections in time (${options.timeout}ms), will forcefully shut down`
        );
        return Promise.resolve(true);
      }
      const allConnectionsClosed = Object.keys(connections).length === 0 && Object.keys(secureConnections).length === 0;
      if (allConnectionsClosed) {
        debug("All connections closed. Continue to shutting down");
        return Promise.resolve(false);
      }
      debug("Schedule the next waitForReadyToShutdown");
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(waitForReadyToShutDown(totalNumInterval - 1));
        }, 250);
      });
    }
    if (isShuttingDown) {
      return Promise.resolve();
    }
    debug("shutting down");
    return options.preShutdown(sig).then(() => {
      isShuttingDown = true;
      cleanupHttp();
    }).then(() => {
      const pollIterations = options.timeout ? Math.round(options.timeout / 250) : 0;
      return waitForReadyToShutDown(pollIterations);
    }).then((force) => {
      debug("Do onShutdown now");
      if (force) {
        destroyAllConnections(force);
      }
      return options.onShutdown(sig);
    }).then(finalHandler).catch((error) => {
      const errString = typeof error === "string" ? error : JSON.stringify(error);
      debug(errString);
      failed = true;
      throw errString;
    });
  }
  function shutdownManual() {
    return shutdown("manual");
  }
  return shutdownManual;
}

function getGracefulShutdownConfig() {
  return {
    disabled: !!process.env.NITRO_SHUTDOWN_DISABLED,
    signals: (process.env.NITRO_SHUTDOWN_SIGNALS || "SIGTERM SIGINT").split(" ").map((s) => s.trim()),
    timeout: Number.parseInt(process.env.NITRO_SHUTDOWN_TIMEOUT || "", 10) || 3e4,
    forceExit: !process.env.NITRO_SHUTDOWN_NO_FORCE_EXIT
  };
}
function setupGracefulShutdown(listener, nitroApp) {
  const shutdownConfig = getGracefulShutdownConfig();
  if (shutdownConfig.disabled) {
    return;
  }
  GracefulShutdown(listener, {
    signals: shutdownConfig.signals.join(" "),
    timeout: shutdownConfig.timeout,
    forceExit: shutdownConfig.forceExit,
    onShutdown: async () => {
      await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.warn("Graceful shutdown timeout, force exiting...");
          resolve();
        }, shutdownConfig.timeout);
        nitroApp.hooks.callHook("close").catch((error) => {
          console.error(error);
        }).finally(() => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }
  });
}

const cert = process.env.NITRO_SSL_CERT;
const key = process.env.NITRO_SSL_KEY;
const nitroApp = useNitroApp();
const server = cert && key ? new Server({ key, cert }, toNodeListener(nitroApp.h3App)) : new Server$1(toNodeListener(nitroApp.h3App));
const port = destr(process.env.NITRO_PORT || process.env.PORT) || 3e3;
const host = process.env.NITRO_HOST || process.env.HOST;
const path = process.env.NITRO_UNIX_SOCKET;
const listener = server.listen(path ? { path } : { port, host }, (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  const protocol = cert && key ? "https" : "http";
  const addressInfo = listener.address();
  if (typeof addressInfo === "string") {
    console.log(`Listening on unix socket ${addressInfo}`);
    return;
  }
  const baseURL = (useRuntimeConfig().app.baseURL || "").replace(/\/$/, "");
  const url = `${protocol}://${addressInfo.family === "IPv6" ? `[${addressInfo.address}]` : addressInfo.address}:${addressInfo.port}${baseURL}`;
  console.log(`Listening on ${url}`);
});
trapUnhandledNodeErrors();
setupGracefulShutdown(listener, nitroApp);
const nodeServer = {};

export { deleteDocsSite as $, kickMember as A, changeRole as B, deletePost as C, listReplies as D, createReply as E, listPosts as F, createPost as G, shareContent as H, listCommunities as I, createCommunity as J, deleteContent as K, updateContent as L, useConfig as M, publishContent as N, onContentPublished as O, incrementViewCount as P, getContentBySlug as Q, listContent as R, createContent as S, getContestBySlug as T, updateContest as U, listContestEntries as V, submitContestEntry as W, judgeContestEntry as X, listContests as Y, createContest as Z, getDocsSiteBySlug as _, getRouterParam as a, getResponseStatus as a$, updateDocsSite as a0, getDocsNav as a1, listDocsPages as a2, createDocsPage as a3, updateDocsPage as a4, searchDocsPages as a5, createDocsVersion as a6, listDocsSites as a7, createDocsSite as a8, getPathBySlug as a9, createComment as aA, deleteComment as aB, isLiked as aC, toggleLike as aD, getUserByUsername as aE, getUserContent as aF, getVideoById as aG, incrementVideoViewCount as aH, listVideoCategories as aI, listVideos as aJ, createVideo as aK, getRequestURL as aL, parseWebFingerResource as aM, setResponseHeader as aN, buildWebFingerResponse as aO, getMethod as aP, processInboxActivity as aQ, buildNodeInfoResponse as aR, getRequestHeader as aS, sendRedirect as aT, getOrCreateActorKeypair as aU, getFollowers as aV, getFollowing as aW, generateOutboxCollection as aX, joinRelativeURL as aY, useRuntimeConfig as aZ, getResponseStatusText as a_, deletePath as aa, updatePath as ab, getLessonBySlug as ac, markLessonComplete as ad, enroll as ae, createLesson as af, createModule as ag, updateModule as ah, publishPath as ai, unenroll as aj, getUserCertificates as ak, getUserEnrollments as al, listPaths as am, createPath as an, getConversationMessages as ao, markMessagesRead as ap, sendMessage as aq, listConversations as ar, createConversation as as, deleteNotification as at, getUnreadCount as au, listNotifications as av, markNotificationRead as aw, markAllNotificationsRead as ax, toggleBookmark as ay, listComments as az, listReports as b, defineRenderHandler as b0, getRouteRules as b1, joinURL as b2, useNitroApp as b3, parseURL as b4, encodePath as b5, decodePath as b6, hasProtocol as b7, isScriptProtocol as b8, withQuery as b9, sanitizeStatusCode as ba, getContext as bb, $fetch as bc, createHooks as bd, defu as be, executeAsync as bf, parseQuery as bg, withTrailingSlash as bh, withoutTrailingSlash as bi, hash$1 as bj, nodeServer as bk, readBody as c, defineEventHandler as d, resolveReport as e, getInstanceSettings as f, getQuery as g, getPlatformStats as h, listUsers as i, deleteUser as j, updateUserRole as k, listAuditLogs as l, updateUserStatus as m, getCommunityBySlug as n, createError$1 as o, listBans as p, banUser as q, removeContent as r, setInstanceSetting as s, unbanUser as t, useDB as u, listInvites as v, createInvite as w, joinCommunity as x, leaveCommunity as y, listMembers as z };
//# sourceMappingURL=nitro.mjs.map
