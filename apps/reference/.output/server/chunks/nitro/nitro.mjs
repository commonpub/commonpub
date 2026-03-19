import process from 'node:process';globalThis._importMeta_=globalThis._importMeta_||{url:"file:///_entry.js",env:process.env};import { relations, sql, eq, ne, and, desc, inArray, ilike, asc, isNull } from 'drizzle-orm';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkFrontmatter from 'remark-frontmatter';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import rehypeSlug from 'rehype-slug';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { parse as parse$1 } from 'yaml';
import { pgEnum, pgTable, timestamp, jsonb, varchar, text, boolean, uuid, integer, index, unique, primaryKey, uniqueIndex, numeric, alias } from 'drizzle-orm/pg-core';
import { generateKeyPair, exportSPKI, exportPKCS8 } from 'jose';
import { promises, existsSync, createWriteStream } from 'node:fs';
import { mkdir, unlink as unlink$1 } from 'node:fs/promises';
import { resolve as resolve$1, dirname as dirname$1, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createHash, randomUUID } from 'node:crypto';
import http, { Server as Server$1 } from 'node:http';
import https, { Server } from 'node:https';
import { EventEmitter } from 'node:events';
import { Buffer as Buffer$1 } from 'node:buffer';
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

function parse(multipartBodyBuffer, boundary) {
  let lastline = "";
  let state = 0 /* INIT */;
  let buffer = [];
  const allParts = [];
  let currentPartHeaders = [];
  for (let i = 0; i < multipartBodyBuffer.length; i++) {
    const prevByte = i > 0 ? multipartBodyBuffer[i - 1] : null;
    const currByte = multipartBodyBuffer[i];
    const newLineChar = currByte === 10 || currByte === 13;
    if (!newLineChar) {
      lastline += String.fromCodePoint(currByte);
    }
    const newLineDetected = currByte === 10 && prevByte === 13;
    if (0 /* INIT */ === state && newLineDetected) {
      if ("--" + boundary === lastline) {
        state = 1 /* READING_HEADERS */;
      }
      lastline = "";
    } else if (1 /* READING_HEADERS */ === state && newLineDetected) {
      if (lastline.length > 0) {
        const i2 = lastline.indexOf(":");
        if (i2 > 0) {
          const name = lastline.slice(0, i2).toLowerCase();
          const value = lastline.slice(i2 + 1).trim();
          currentPartHeaders.push([name, value]);
        }
      } else {
        state = 2 /* READING_DATA */;
        buffer = [];
      }
      lastline = "";
    } else if (2 /* READING_DATA */ === state) {
      if (lastline.length > boundary.length + 4) {
        lastline = "";
      }
      if ("--" + boundary === lastline) {
        const j = buffer.length - lastline.length;
        const part = buffer.slice(0, j - 1);
        allParts.push(process$1(part, currentPartHeaders));
        buffer = [];
        currentPartHeaders = [];
        lastline = "";
        state = 3 /* READING_PART_SEPARATOR */;
      } else {
        buffer.push(currByte);
      }
      if (newLineDetected) {
        lastline = "";
      }
    } else if (3 /* READING_PART_SEPARATOR */ === state && newLineDetected) {
      state = 1 /* READING_HEADERS */;
    }
  }
  return allParts;
}
function process$1(data, headers) {
  const dataObj = {};
  const contentDispositionHeader = headers.find((h) => h[0] === "content-disposition")?.[1] || "";
  for (const i of contentDispositionHeader.split(";")) {
    const s = i.split("=");
    if (s.length !== 2) {
      continue;
    }
    const key = (s[0] || "").trim();
    if (key === "name" || key === "filename") {
      const _value = (s[1] || "").trim().replace(/"/g, "");
      dataObj[key] = Buffer.from(_value, "latin1").toString("utf8");
    }
  }
  const contentType = headers.find((h) => h[0] === "content-type")?.[1] || "";
  if (contentType) {
    dataObj.type = contentType;
  }
  dataObj.data = Buffer.from(data);
  return dataObj;
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
async function readMultipartFormData(event) {
  const contentType = getRequestHeader(event, "content-type");
  if (!contentType || !contentType.startsWith("multipart/form-data")) {
    return;
  }
  const boundary = contentType.match(/boundary=([^;]*)(;|$)/i)?.[1];
  if (!boundary) {
    return;
  }
  const body = await readRawBody(event, false);
  if (!body) {
    return;
  }
  return parse(body, boundary);
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
    "buildId": "4220b328-6e01-47d0-a7ba-fa6a4c3f9541",
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
      "/api/**": {
        "cors": true,
        "headers": {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "*",
          "access-control-allow-headers": "*",
          "access-control-max-age": "0",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization"
        }
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
      "/uploads/**": {
        "headers": {
          "cache-control": "public, max-age=86400, immutable"
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
  "authSecret": "dev-secret-change-me",
  "s3Bucket": "",
  "s3Region": "us-east-1",
  "s3Endpoint": "",
  "s3AccessKey": "",
  "s3SecretKey": "",
  "s3PublicUrl": "",
  "uploadDir": "./uploads"
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
  "/_nuxt/4er8rlgT.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"b79-loCIYjBErCj/dbJHNFcrp8ya844\"",
    "mtime": "2026-03-19T20:26:57.768Z",
    "size": 2937,
    "path": "../public/_nuxt/4er8rlgT.js"
  },
  "/_nuxt/12aXSaFF.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"2f08-Ef/wrjklm+t1ibkN1xwmH07vfn0\"",
    "mtime": "2026-03-19T20:26:57.768Z",
    "size": 12040,
    "path": "../public/_nuxt/12aXSaFF.js"
  },
  "/_nuxt/1zecQGoQ.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"5c7-StdJqOB0aGxhXQuWu7lknuUTm9c\"",
    "mtime": "2026-03-19T20:26:57.768Z",
    "size": 1479,
    "path": "../public/_nuxt/1zecQGoQ.js"
  },
  "/_nuxt/8SKR_xas.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"b6b-H7ZPphDr/JAKSFcsOyKA9k7TAJo\"",
    "mtime": "2026-03-19T20:26:57.768Z",
    "size": 2923,
    "path": "../public/_nuxt/8SKR_xas.js"
  },
  "/_nuxt/B3zpp6pb.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"444-mKa6CwHXdUc+TaIH9W0rAYPVGgY\"",
    "mtime": "2026-03-19T20:26:57.768Z",
    "size": 1092,
    "path": "../public/_nuxt/B3zpp6pb.js"
  },
  "/_nuxt/AuthorRow.DVy7lpqz.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"39f-+srd0KHDhfamSkh3N4EOSdmT1UE\"",
    "mtime": "2026-03-19T20:26:57.768Z",
    "size": 927,
    "path": "../public/_nuxt/AuthorRow.DVy7lpqz.css"
  },
  "/_nuxt/B6ouhPpK.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"23c-b3EcxBlqjmYX/phB/whbX04Rfys\"",
    "mtime": "2026-03-19T20:26:57.768Z",
    "size": 572,
    "path": "../public/_nuxt/B6ouhPpK.js"
  },
  "/_nuxt/BTgj7tMr.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"959-/BTNH2TU5pHFukhKuaU8hZAz/So\"",
    "mtime": "2026-03-19T20:26:57.769Z",
    "size": 2393,
    "path": "../public/_nuxt/BTgj7tMr.js"
  },
  "/_nuxt/BF1Gdj3t.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"24bb-ypjZtvVwpFVj6hcYdCsYLn2kKK0\"",
    "mtime": "2026-03-19T20:26:57.769Z",
    "size": 9403,
    "path": "../public/_nuxt/BF1Gdj3t.js"
  },
  "/_nuxt/BG8c3LJG.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"2d1a-Pd/isJHV9PlKY3UFj18P27+zOQ4\"",
    "mtime": "2026-03-19T20:26:57.769Z",
    "size": 11546,
    "path": "../public/_nuxt/BG8c3LJG.js"
  },
  "/_nuxt/BTl24G54.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"b12-WmtU6rJLfzYIO8/hK4BuWJQQPXU\"",
    "mtime": "2026-03-19T20:26:57.769Z",
    "size": 2834,
    "path": "../public/_nuxt/BTl24G54.js"
  },
  "/_nuxt/BU4WcE0U.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"1025-awvGOb6zqOq8ys5nVB3323BPpVY\"",
    "mtime": "2026-03-19T20:26:57.769Z",
    "size": 4133,
    "path": "../public/_nuxt/BU4WcE0U.js"
  },
  "/_nuxt/BZNAGjCD.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"47c-qLqQkop/dY4mOrIs9abLV7fRHJQ\"",
    "mtime": "2026-03-19T20:26:57.769Z",
    "size": 1148,
    "path": "../public/_nuxt/BZNAGjCD.js"
  },
  "/_nuxt/BW8tNspC.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"2b63-wZsDNfgE0Bz3fRjNh2T/sEr217A\"",
    "mtime": "2026-03-19T20:26:57.769Z",
    "size": 11107,
    "path": "../public/_nuxt/BW8tNspC.js"
  },
  "/_nuxt/BeBnmlEd.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"254f-bYJ1XTUOqe5bEJJjElEZ9EId+pA\"",
    "mtime": "2026-03-19T20:26:57.769Z",
    "size": 9551,
    "path": "../public/_nuxt/BeBnmlEd.js"
  },
  "/_nuxt/BfgyFA9G.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"8d1-/par2hS5ESiyGGdvXm3najPsESU\"",
    "mtime": "2026-03-19T20:26:57.769Z",
    "size": 2257,
    "path": "../public/_nuxt/BfgyFA9G.js"
  },
  "/_nuxt/BfWZgC-Y.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"16ebb-lRSnWmxK3s+vDC3yDPosdMTXfwc\"",
    "mtime": "2026-03-19T20:26:57.770Z",
    "size": 93883,
    "path": "../public/_nuxt/BfWZgC-Y.js"
  },
  "/_nuxt/BhPGSUFs.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"590a-2aE/H5qc9nR4KL8MF9MyrdFlvRc\"",
    "mtime": "2026-03-19T20:26:57.769Z",
    "size": 22794,
    "path": "../public/_nuxt/BhPGSUFs.js"
  },
  "/_nuxt/Bk9BtoPv.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"d4c-TTQaWkWNlItecyn2ikEemm36M1o\"",
    "mtime": "2026-03-19T20:26:57.769Z",
    "size": 3404,
    "path": "../public/_nuxt/Bk9BtoPv.js"
  },
  "/_nuxt/BpcY-y0l.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"7e9-cVrbcX9qbHsPxHs4XnAfWEi0e1k\"",
    "mtime": "2026-03-19T20:26:57.770Z",
    "size": 2025,
    "path": "../public/_nuxt/BpcY-y0l.js"
  },
  "/_nuxt/Bn9YV9Yb.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"830-bJPNf6hHoT1zRIypC1y00PZ625w\"",
    "mtime": "2026-03-19T20:26:57.770Z",
    "size": 2096,
    "path": "../public/_nuxt/Bn9YV9Yb.js"
  },
  "/_nuxt/BvmV0-eH.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"2d62-WOQBYfY5iLDaY9cxI8stXpPLUvI\"",
    "mtime": "2026-03-19T20:26:57.770Z",
    "size": 11618,
    "path": "../public/_nuxt/BvmV0-eH.js"
  },
  "/_nuxt/Bt4I6CiX.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"39ed-DtG7863wq6c46ShuX2BJ6YV5neE\"",
    "mtime": "2026-03-19T20:26:57.770Z",
    "size": 14829,
    "path": "../public/_nuxt/Bt4I6CiX.js"
  },
  "/_nuxt/Bv_W7u-5.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"b62-ze7TfuT23xtF4AucDv9P/1a+EmU\"",
    "mtime": "2026-03-19T20:26:57.770Z",
    "size": 2914,
    "path": "../public/_nuxt/Bv_W7u-5.js"
  },
  "/_nuxt/BxIjRvrs.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"1bf6-WL5AaRj6FTT44U9U4qJbuv7eNWU\"",
    "mtime": "2026-03-19T20:26:57.770Z",
    "size": 7158,
    "path": "../public/_nuxt/BxIjRvrs.js"
  },
  "/_nuxt/C4KrMw6t.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"8dc-9MypHX0p4w4bLQ06PR0wTXJWXqw\"",
    "mtime": "2026-03-19T20:26:57.770Z",
    "size": 2268,
    "path": "../public/_nuxt/C4KrMw6t.js"
  },
  "/_nuxt/BzMZE2-y.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"22c-+c1/6jEM1WMcUKc6XAWyTIvzmgk\"",
    "mtime": "2026-03-19T20:26:57.770Z",
    "size": 556,
    "path": "../public/_nuxt/BzMZE2-y.js"
  },
  "/_nuxt/C7CmKcUi.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"660-CNglxIWXmeFbMR0vqgsHldS3Wck\"",
    "mtime": "2026-03-19T20:26:57.770Z",
    "size": 1632,
    "path": "../public/_nuxt/C7CmKcUi.js"
  },
  "/_nuxt/BxfnjMcI.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"c4da-AbPenNPpwlMog6z+ovCHtHId/Eo\"",
    "mtime": "2026-03-19T20:26:57.771Z",
    "size": 50394,
    "path": "../public/_nuxt/BxfnjMcI.js"
  },
  "/_nuxt/C7os_Gm1.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"1d21-JcUXFQ4PlddHN04d5WSfIthqmoY\"",
    "mtime": "2026-03-19T20:26:57.771Z",
    "size": 7457,
    "path": "../public/_nuxt/C7os_Gm1.js"
  },
  "/_nuxt/CD5mPEmm.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"ace-T3gLaSrTICFvQr5gaxE7ZTn37QY\"",
    "mtime": "2026-03-19T20:26:57.770Z",
    "size": 2766,
    "path": "../public/_nuxt/CD5mPEmm.js"
  },
  "/_nuxt/CEkxnP39.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"312-6vFnWw2kvicH/fkHjr7Br2mjSrw\"",
    "mtime": "2026-03-19T20:26:57.770Z",
    "size": 786,
    "path": "../public/_nuxt/CEkxnP39.js"
  },
  "/_nuxt/CGimpDfv.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"c0a-Xa7BgnBxntGQ3zRRGtejNpuKy+w\"",
    "mtime": "2026-03-19T20:26:57.771Z",
    "size": 3082,
    "path": "../public/_nuxt/CGimpDfv.js"
  },
  "/_nuxt/CK0PdnNr.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"3e23-qzXMjToE6SpeUKptO60uSBbdAso\"",
    "mtime": "2026-03-19T20:26:57.771Z",
    "size": 15907,
    "path": "../public/_nuxt/CK0PdnNr.js"
  },
  "/_nuxt/CMH88hVu.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"18d4-Ix9LQgFDltJsPOdPTYaP21cAs/Y\"",
    "mtime": "2026-03-19T20:26:57.771Z",
    "size": 6356,
    "path": "../public/_nuxt/CMH88hVu.js"
  },
  "/_nuxt/CNf7kPNf.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"d53-va864PuBUhlLeJqzhtwQ9qWm1sk\"",
    "mtime": "2026-03-19T20:26:57.771Z",
    "size": 3411,
    "path": "../public/_nuxt/CNf7kPNf.js"
  },
  "/_nuxt/CaTdz1yS.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"8ee-/g+fH4XEBfXTeC39H7HF2GQt0/M\"",
    "mtime": "2026-03-19T20:26:57.771Z",
    "size": 2286,
    "path": "../public/_nuxt/CaTdz1yS.js"
  },
  "/_nuxt/CiUc425V.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"64a-/BNP+hOwcy6cVOC6uXMpihSCrtQ\"",
    "mtime": "2026-03-19T20:26:57.772Z",
    "size": 1610,
    "path": "../public/_nuxt/CiUc425V.js"
  },
  "/_nuxt/CgJNPWjq.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"253-EuqC6taOHZ8BNfQExsVWYSBLvY4\"",
    "mtime": "2026-03-19T20:26:57.772Z",
    "size": 595,
    "path": "../public/_nuxt/CgJNPWjq.js"
  },
  "/_nuxt/Clrh_K-L.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"1248-5x13pZ1p7qpPkZTHoSQWmAHeCaU\"",
    "mtime": "2026-03-19T20:26:57.771Z",
    "size": 4680,
    "path": "../public/_nuxt/Clrh_K-L.js"
  },
  "/_nuxt/Cnv8JecW.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"b28-Oc2q5rYBq0Ld00Gq63ocVk4VGns\"",
    "mtime": "2026-03-19T20:26:57.772Z",
    "size": 2856,
    "path": "../public/_nuxt/Cnv8JecW.js"
  },
  "/_nuxt/Cnlp3N1E.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"166b-DxtSzM/Hyl8zOLqZkXjwx4zd8CQ\"",
    "mtime": "2026-03-19T20:26:57.771Z",
    "size": 5739,
    "path": "../public/_nuxt/Cnlp3N1E.js"
  },
  "/_nuxt/Ct8OZQUc.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"2199-vqI37aCuzge82+gYH8qrGd+jAZw\"",
    "mtime": "2026-03-19T20:26:57.773Z",
    "size": 8601,
    "path": "../public/_nuxt/Ct8OZQUc.js"
  },
  "/_nuxt/ContentCard.B-Wxaax8.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"c56-756v3SQmDQURTI02DU90DgfwoIk\"",
    "mtime": "2026-03-19T20:26:57.772Z",
    "size": 3158,
    "path": "../public/_nuxt/ContentCard.B-Wxaax8.css"
  },
  "/_nuxt/CountdownTimer.BJmhrNPV.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"243-RHyp3Ssm+/Ha/l6J7xP790U4ZCU\"",
    "mtime": "2026-03-19T20:26:57.772Z",
    "size": 579,
    "path": "../public/_nuxt/CountdownTimer.BJmhrNPV.css"
  },
  "/_nuxt/ContentTypeBadge.Dnr759Nm.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"31d-HajBbyIPLIzvGA1c1JGWdtfKYss\"",
    "mtime": "2026-03-19T20:26:57.772Z",
    "size": 797,
    "path": "../public/_nuxt/ContentTypeBadge.Dnr759Nm.css"
  },
  "/_nuxt/CvDDPuPS.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"d4a-pbLLZsLCHXvglQeKvEnw/pBS84g\"",
    "mtime": "2026-03-19T20:26:57.773Z",
    "size": 3402,
    "path": "../public/_nuxt/CvDDPuPS.js"
  },
  "/_nuxt/Cu5ZOvrP.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"10b0-JXH0GP9IOFPKP3yOUlSrH2GOTqo\"",
    "mtime": "2026-03-19T20:26:57.773Z",
    "size": 4272,
    "path": "../public/_nuxt/Cu5ZOvrP.js"
  },
  "/_nuxt/CxPO3Wy7.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"385-oU5xLyEXHeLGnSSHiJC50JZA3vc\"",
    "mtime": "2026-03-19T20:26:57.773Z",
    "size": 901,
    "path": "../public/_nuxt/CxPO3Wy7.js"
  },
  "/_nuxt/CzvLRwEW.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"e29-XNIEngygVMPcMOMhDsbuzVlIfUk\"",
    "mtime": "2026-03-19T20:26:57.773Z",
    "size": 3625,
    "path": "../public/_nuxt/CzvLRwEW.js"
  },
  "/_nuxt/D1tZSYnt.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"632-d7uNqqUrDnuqoYaN1JnYdDaKx58\"",
    "mtime": "2026-03-19T20:26:57.773Z",
    "size": 1586,
    "path": "../public/_nuxt/D1tZSYnt.js"
  },
  "/_nuxt/D1Y61VP7.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"5ea-P6vM+ZQpLCH9vee0ULzkO62+Nj4\"",
    "mtime": "2026-03-19T20:26:57.773Z",
    "size": 1514,
    "path": "../public/_nuxt/D1Y61VP7.js"
  },
  "/_nuxt/D3eduOt6.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"1e71-0sfQfuXtfci2vSOKGvLV+0zH+14\"",
    "mtime": "2026-03-19T20:26:57.773Z",
    "size": 7793,
    "path": "../public/_nuxt/D3eduOt6.js"
  },
  "/_nuxt/D40CsV4Y.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"ec4-d6X8F39rJwXyO6keVGxVOr6fceA\"",
    "mtime": "2026-03-19T20:26:57.774Z",
    "size": 3780,
    "path": "../public/_nuxt/D40CsV4Y.js"
  },
  "/_nuxt/D6N8Sz9Y.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"40-hScjRnRePOYMfotgq3C9WyjmOqs\"",
    "mtime": "2026-03-19T20:26:57.773Z",
    "size": 64,
    "path": "../public/_nuxt/D6N8Sz9Y.js"
  },
  "/_nuxt/DDRIMMbW.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"c3d-oHB99fPh3q9S+6ZS0hRZeonGmZQ\"",
    "mtime": "2026-03-19T20:26:57.773Z",
    "size": 3133,
    "path": "../public/_nuxt/DDRIMMbW.js"
  },
  "/_nuxt/D8h08jap.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"87b-fc0tGQeUN+eh8LswOwjO3pApOiQ\"",
    "mtime": "2026-03-19T20:26:57.773Z",
    "size": 2171,
    "path": "../public/_nuxt/D8h08jap.js"
  },
  "/_nuxt/DDVORIXg.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"179-VO8WS0ESuxg1ZFGuUIGdenKkNcM\"",
    "mtime": "2026-03-19T20:26:57.774Z",
    "size": 377,
    "path": "../public/_nuxt/DDVORIXg.js"
  },
  "/_nuxt/DEfS9-7D.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"c22-knlN6K0EmeXAgMB5MA+jgsHalbM\"",
    "mtime": "2026-03-19T20:26:57.774Z",
    "size": 3106,
    "path": "../public/_nuxt/DEfS9-7D.js"
  },
  "/_nuxt/DPktP0bR.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"f29-XwUJ9C5qsJn5TsluZHACW6rycoY\"",
    "mtime": "2026-03-19T20:26:57.774Z",
    "size": 3881,
    "path": "../public/_nuxt/DPktP0bR.js"
  },
  "/_nuxt/DaMrAt-C.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"678-2HnzyKdqWYKF5VkeIunjCPl0RRM\"",
    "mtime": "2026-03-19T20:26:57.774Z",
    "size": 1656,
    "path": "../public/_nuxt/DaMrAt-C.js"
  },
  "/_nuxt/DkjUoHIx.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"487-rKz+5wdqQa2nTDVq/Kph/TNB3Es\"",
    "mtime": "2026-03-19T20:26:57.774Z",
    "size": 1159,
    "path": "../public/_nuxt/DkjUoHIx.js"
  },
  "/_nuxt/DnaAkur7.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"831-oiyzt92a1AVCBqKVotDLf2/hVEs\"",
    "mtime": "2026-03-19T20:26:57.774Z",
    "size": 2097,
    "path": "../public/_nuxt/DnaAkur7.js"
  },
  "/_nuxt/DiqdUuKN.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"2171-052u47gzMeL1mVZDQfp4NhmQLXY\"",
    "mtime": "2026-03-19T20:26:57.774Z",
    "size": 8561,
    "path": "../public/_nuxt/DiqdUuKN.js"
  },
  "/_nuxt/Dq4kg88k.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"56b-tEX2oV4km3zBjKJpbNY/Yx63Buo\"",
    "mtime": "2026-03-19T20:26:57.775Z",
    "size": 1387,
    "path": "../public/_nuxt/Dq4kg88k.js"
  },
  "/_nuxt/GRLnYMq3.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"9c4-nkFLzu5dAF2TY3fusKQGT6f0qsU\"",
    "mtime": "2026-03-19T20:26:57.775Z",
    "size": 2500,
    "path": "../public/_nuxt/GRLnYMq3.js"
  },
  "/_nuxt/Hz5XXIaK.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"dd-U6Mf1uqkjW3VdjkB+xzs+bo2Iag\"",
    "mtime": "2026-03-19T20:26:57.774Z",
    "size": 221,
    "path": "../public/_nuxt/Hz5XXIaK.js"
  },
  "/_nuxt/DucRaouA.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"319e-S8vm5qeA8HOUvGAYVVxlyfIyotE\"",
    "mtime": "2026-03-19T20:26:57.774Z",
    "size": 12702,
    "path": "../public/_nuxt/DucRaouA.js"
  },
  "/_nuxt/ObF1Y5nr.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"300c-4C8rIg4FWY06d9gXPDOiFY3kSLQ\"",
    "mtime": "2026-03-19T20:26:57.775Z",
    "size": 12300,
    "path": "../public/_nuxt/ObF1Y5nr.js"
  },
  "/_nuxt/RhDItHgc.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"63d-tvfehK8A64agoRb3h9wdhdRiubA\"",
    "mtime": "2026-03-19T20:26:57.775Z",
    "size": 1597,
    "path": "../public/_nuxt/RhDItHgc.js"
  },
  "/_nuxt/RiVm3Iqe.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"1a17-05QB1lTRk4odNXZhdyrshwikKzI\"",
    "mtime": "2026-03-19T20:26:57.775Z",
    "size": 6679,
    "path": "../public/_nuxt/RiVm3Iqe.js"
  },
  "/_nuxt/TJxFWwsO.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"770-Bd4DOQvqbe5pszosniSHnn/xRGU\"",
    "mtime": "2026-03-19T20:26:57.775Z",
    "size": 1904,
    "path": "../public/_nuxt/TJxFWwsO.js"
  },
  "/_nuxt/ZYLWyq9r.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"a76-m4YKfTvVlkXq4XHvOZgeZsQC0iU\"",
    "mtime": "2026-03-19T20:26:57.775Z",
    "size": 2678,
    "path": "../public/_nuxt/ZYLWyq9r.js"
  },
  "/_nuxt/D-gCp78O.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"5f398-sNFdZflLUOBBLtMp3dmpbxAOIIg\"",
    "mtime": "2026-03-19T20:26:57.774Z",
    "size": 390040,
    "path": "../public/_nuxt/D-gCp78O.js"
  },
  "/_nuxt/_...BZiavFx7.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"24c8-VQxqHxgj68+vdAgeb3T0nvNR8Ns\"",
    "mtime": "2026-03-19T20:26:57.775Z",
    "size": 9416,
    "path": "../public/_nuxt/_...BZiavFx7.css"
  },
  "/_nuxt/_code_.B4C1AYOc.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"a1d-82uq+22K3JL6KYwc1Ac0GLLyT2w\"",
    "mtime": "2026-03-19T20:26:57.775Z",
    "size": 2589,
    "path": "../public/_nuxt/_code_.B4C1AYOc.css"
  },
  "/_nuxt/_conversationId_.CAYLO5dW.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"4ee-0p9+8noA/6FsL0KRrt8zclWzlqY\"",
    "mtime": "2026-03-19T20:26:57.775Z",
    "size": 1262,
    "path": "../public/_nuxt/_conversationId_.CAYLO5dW.css"
  },
  "/_nuxt/_C_Uflxl.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"e8f-SSyl+4Hh9s7Kqb5cppEpOgHcgcY\"",
    "mtime": "2026-03-19T20:26:57.775Z",
    "size": 3727,
    "path": "../public/_nuxt/_C_Uflxl.js"
  },
  "/_nuxt/_id_.n-usihns.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"723-4NpG9Pt6QWAWvr1TDkN6mh91JR0\"",
    "mtime": "2026-03-19T20:26:57.775Z",
    "size": 1827,
    "path": "../public/_nuxt/_id_.n-usihns.css"
  },
  "/_nuxt/_slug_.sxtVXyZe.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"cdc-08AqZWcSuknSWxI3XfLYx3ZHljU\"",
    "mtime": "2026-03-19T20:26:57.775Z",
    "size": 3292,
    "path": "../public/_nuxt/_slug_.sxtVXyZe.css"
  },
  "/_nuxt/_slug_.DbMYSWC0.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"312-yhHXTSirCswfVOV4CbNo6toq42Y\"",
    "mtime": "2026-03-19T20:26:57.775Z",
    "size": 786,
    "path": "../public/_nuxt/_slug_.DbMYSWC0.css"
  },
  "/_nuxt/about.DklTaeoC.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"81f-WGrxTOPlZ57yXw93mp4xTm5E/Hs\"",
    "mtime": "2026-03-19T20:26:57.776Z",
    "size": 2079,
    "path": "../public/_nuxt/about.DklTaeoC.css"
  },
  "/_nuxt/a9zTdsKT.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"a16-6FJRSMsvZIwLYd0mcDM9oH2aAgY\"",
    "mtime": "2026-03-19T20:26:57.775Z",
    "size": 2582,
    "path": "../public/_nuxt/a9zTdsKT.js"
  },
  "/_nuxt/appearance.C7Vo_EPg.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"2a0-mLKp9Gohe8A0nkPiEaMcbZeLcNI\"",
    "mtime": "2026-03-19T20:26:57.776Z",
    "size": 672,
    "path": "../public/_nuxt/appearance.C7Vo_EPg.css"
  },
  "/_nuxt/cbslpyGE.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"7ca-M0SvQGNzIcAyqgc8zee8wRod1ng\"",
    "mtime": "2026-03-19T20:26:57.776Z",
    "size": 1994,
    "path": "../public/_nuxt/cbslpyGE.js"
  },
  "/_nuxt/admin.CuEkSsjd.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"6c7-JyCbDSjbRN+h1Po/NXTXZWFI54I\"",
    "mtime": "2026-03-19T20:26:57.776Z",
    "size": 1735,
    "path": "../public/_nuxt/admin.CuEkSsjd.css"
  },
  "/_nuxt/content.CSIbBkXB.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"647-SQG1EetbXPwYPFrg8UTDlM9wttw\"",
    "mtime": "2026-03-19T20:26:57.776Z",
    "size": 1607,
    "path": "../public/_nuxt/content.CSIbBkXB.css"
  },
  "/_nuxt/audit.CS-cTV1C.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"376-DsFI4Lp0WNz3d2xzhyQJUBmuNNM\"",
    "mtime": "2026-03-19T20:26:57.776Z",
    "size": 886,
    "path": "../public/_nuxt/audit.CS-cTV1C.css"
  },
  "/_nuxt/account.KPzbs-j0.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"300-TZkKmsn6vmdxaNJP1dqn8v6gwCs\"",
    "mtime": "2026-03-19T20:26:57.776Z",
    "size": 768,
    "path": "../public/_nuxt/account.KPzbs-j0.css"
  },
  "/_nuxt/create.Cl_cQ-qD.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"6cf-1pXTrGiVmuMR7yj6tXjWYH5H+wY\"",
    "mtime": "2026-03-19T20:26:57.776Z",
    "size": 1743,
    "path": "../public/_nuxt/create.Cl_cQ-qD.css"
  },
  "/_nuxt/create.BYssfLYx.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"366-J8ySHWa9hc8BGL+88XAEg62Momk\"",
    "mtime": "2026-03-19T20:26:57.776Z",
    "size": 870,
    "path": "../public/_nuxt/create.BYssfLYx.css"
  },
  "/_nuxt/create.Dovj27ro.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"813-tCNeQJqMSNz9XtrNmskrT6U5mbw\"",
    "mtime": "2026-03-19T20:26:57.776Z",
    "size": 2067,
    "path": "../public/_nuxt/create.Dovj27ro.css"
  },
  "/_nuxt/create.DsfsadPh.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"3a8-jIvu/YzravsGR7P2zWGo28F+ums\"",
    "mtime": "2026-03-19T20:26:57.776Z",
    "size": 936,
    "path": "../public/_nuxt/create.DsfsadPh.css"
  },
  "/_nuxt/create.DKW_DWhv.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"1d5-iwQnFoDNcc52H9jqhPNxL/yAwcc\"",
    "mtime": "2026-03-19T20:26:57.776Z",
    "size": 469,
    "path": "../public/_nuxt/create.DKW_DWhv.css"
  },
  "/_nuxt/dashboard.B-GgcKEV.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"ec6-ofX5fLl0+SY0xV9pcTBpISMKAUw\"",
    "mtime": "2026-03-19T20:26:57.776Z",
    "size": 3782,
    "path": "../public/_nuxt/dashboard.B-GgcKEV.css"
  },
  "/_nuxt/default.CgoeyAD8.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"20e0-cWeOTTwHegibRthPo8cCdOHtUsQ\"",
    "mtime": "2026-03-19T20:26:57.776Z",
    "size": 8416,
    "path": "../public/_nuxt/default.CgoeyAD8.css"
  },
  "/_nuxt/auth.CGrlX6lU.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"2fb-sBGTrldmuACh82QCIcgIYdbwjo4\"",
    "mtime": "2026-03-19T20:26:57.776Z",
    "size": 763,
    "path": "../public/_nuxt/auth.CGrlX6lU.css"
  },
  "/_nuxt/edit.BIILVcI3.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"1454-ymc+okd6ai1RUjxxl2TqXcC4d48\"",
    "mtime": "2026-03-19T20:26:57.776Z",
    "size": 5204,
    "path": "../public/_nuxt/edit.BIILVcI3.css"
  },
  "/_nuxt/edit.CrSvFUNv.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"8e9-/UOgGCzv9DbkWWJkI+R+cLAqPO8\"",
    "mtime": "2026-03-19T20:26:57.777Z",
    "size": 2281,
    "path": "../public/_nuxt/edit.CrSvFUNv.css"
  },
  "/_nuxt/edit.DJCWNWJr.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"1075-y0jrByxOm8bEIFfJTUG8DvsJV10\"",
    "mtime": "2026-03-19T20:26:57.777Z",
    "size": 4213,
    "path": "../public/_nuxt/edit.DJCWNWJr.css"
  },
  "/_nuxt/editor.CqYnHnxn.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"631-DpoInIT6/lQDDA2XEzLeuXKx+8c\"",
    "mtime": "2026-03-19T20:26:57.777Z",
    "size": 1585,
    "path": "../public/_nuxt/editor.CqYnHnxn.css"
  },
  "/_nuxt/edit.gFE7ArRi.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"213e-nlNiFQtcGAWm0H0dz1p+B3LAw3Y\"",
    "mtime": "2026-03-19T20:26:57.777Z",
    "size": 8510,
    "path": "../public/_nuxt/edit.gFE7ArRi.css"
  },
  "/_nuxt/edit.Dq5WwzAr.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"faa6-Ydpk/nPCeMx9Qz1anmvjIKhoxm8\"",
    "mtime": "2026-03-19T20:26:57.777Z",
    "size": 64166,
    "path": "../public/_nuxt/edit.Dq5WwzAr.css"
  },
  "/_nuxt/explore.By4g317l.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"11b7-e41CzWOEMsDgUiRkFvB7SakXWlg\"",
    "mtime": "2026-03-19T20:26:57.777Z",
    "size": 4535,
    "path": "../public/_nuxt/explore.By4g317l.css"
  },
  "/_nuxt/entry.Bz2xTzR-.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"67f-l9VQNGhq9Eebrt1ZLWSnvDryD7M\"",
    "mtime": "2026-03-19T20:26:57.777Z",
    "size": 1663,
    "path": "../public/_nuxt/entry.Bz2xTzR-.css"
  },
  "/_nuxt/feed.BusKX9ua.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"572-KWyNTMOEJXnhbJftclsf1rhxWjk\"",
    "mtime": "2026-03-19T20:26:57.777Z",
    "size": 1394,
    "path": "../public/_nuxt/feed.BusKX9ua.css"
  },
  "/_nuxt/fgQ4-u1Q.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"1d54-iq7xsP1VVlwRbsTzlKYmgl2my/E\"",
    "mtime": "2026-03-19T20:26:57.777Z",
    "size": 7508,
    "path": "../public/_nuxt/fgQ4-u1Q.js"
  },
  "/_nuxt/followers.qDaBP57w.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"57d-Ex3aXz+hMtjjwUUheRkuv6kINDY\"",
    "mtime": "2026-03-19T20:26:57.777Z",
    "size": 1405,
    "path": "../public/_nuxt/followers.qDaBP57w.css"
  },
  "/_nuxt/following._h_0bREx.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"57d-7Yxt70qF/VQyIL/EjlTek5iKvRo\"",
    "mtime": "2026-03-19T20:26:57.777Z",
    "size": 1405,
    "path": "../public/_nuxt/following._h_0bREx.css"
  },
  "/_nuxt/forgot-password.DSLObLdT.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"8cf-M0pokWmx/xZCKjCraH+XZU33NuU\"",
    "mtime": "2026-03-19T20:26:57.777Z",
    "size": 2255,
    "path": "../public/_nuxt/forgot-password.DSLObLdT.css"
  },
  "/_nuxt/index.B0Ub1w7N.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"3ab5-zdLyneiTlYlJX0HN0UwPaoehR1o\"",
    "mtime": "2026-03-19T20:26:57.777Z",
    "size": 15029,
    "path": "../public/_nuxt/index.B0Ub1w7N.css"
  },
  "/_nuxt/index.BWiQdL8I.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"16c6-24/Tjgn+kIkQYi889f1vWxgm38s\"",
    "mtime": "2026-03-19T20:26:57.777Z",
    "size": 5830,
    "path": "../public/_nuxt/index.BWiQdL8I.css"
  },
  "/_nuxt/index.BvmqA84i.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"506-0NcjayD6M9lfS49feUz6YgSRfM8\"",
    "mtime": "2026-03-19T20:26:57.778Z",
    "size": 1286,
    "path": "../public/_nuxt/index.BvmqA84i.css"
  },
  "/_nuxt/index.Bth37xzy.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"b88-AOpCW8q2DPfcyybVENdrQfI1+iY\"",
    "mtime": "2026-03-19T20:26:57.778Z",
    "size": 2952,
    "path": "../public/_nuxt/index.Bth37xzy.css"
  },
  "/_nuxt/index.CItVzstQ.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"2a2-ZpZ0XlRTKgUQVgBDyST6OJmcZ0I\"",
    "mtime": "2026-03-19T20:26:57.778Z",
    "size": 674,
    "path": "../public/_nuxt/index.CItVzstQ.css"
  },
  "/_nuxt/index.C2e1jyFd.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"1e2c-iBAQDtGMRrBHIlT9JRxzjsS5SKM\"",
    "mtime": "2026-03-19T20:26:57.778Z",
    "size": 7724,
    "path": "../public/_nuxt/index.C2e1jyFd.css"
  },
  "/_nuxt/index.CfR808xV.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"295b-FuIuQndSJ7phEme0chObvc2Cs3w\"",
    "mtime": "2026-03-19T20:26:57.778Z",
    "size": 10587,
    "path": "../public/_nuxt/index.CfR808xV.css"
  },
  "/_nuxt/index.DEpFsJqN.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"e228-1CIV8JUtC62cj4HrT+sXmngUZyM\"",
    "mtime": "2026-03-19T20:26:57.778Z",
    "size": 57896,
    "path": "../public/_nuxt/index.DEpFsJqN.css"
  },
  "/_nuxt/index.DFYPTYdo.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"85e-rYwQCzveyxPienIHUAoJBGF0SMI\"",
    "mtime": "2026-03-19T20:26:57.778Z",
    "size": 2142,
    "path": "../public/_nuxt/index.DFYPTYdo.css"
  },
  "/_nuxt/index.DIgCkXGu.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"706-kA/vngw0fFHB+Je/d7AHFk4aSCw\"",
    "mtime": "2026-03-19T20:26:57.778Z",
    "size": 1798,
    "path": "../public/_nuxt/index.DIgCkXGu.css"
  },
  "/_nuxt/index.DJlQMEBm.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"b6f-V1KkRX5LiNvVg4A7r6VZKDD52EE\"",
    "mtime": "2026-03-19T20:26:57.778Z",
    "size": 2927,
    "path": "../public/_nuxt/index.DJlQMEBm.css"
  },
  "/_nuxt/index.Dac7jaCt.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"3361-oKQAXfKpur13KQXoX2marBOYjK4\"",
    "mtime": "2026-03-19T20:26:57.778Z",
    "size": 13153,
    "path": "../public/_nuxt/index.Dac7jaCt.css"
  },
  "/_nuxt/index.DOLKbg1i.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"58d2-qcyYUbTtwUT5zJkkJuxV+gTt544\"",
    "mtime": "2026-03-19T20:26:57.778Z",
    "size": 22738,
    "path": "../public/_nuxt/index.DOLKbg1i.css"
  },
  "/_nuxt/index.DdRQ_3EP.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"47d-fnmetQKrVnIiYlynY/RQtdDSg6M\"",
    "mtime": "2026-03-19T20:26:57.778Z",
    "size": 1149,
    "path": "../public/_nuxt/index.DdRQ_3EP.css"
  },
  "/_nuxt/index.a2CPSbdx.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"33dc-HgRogn0iglpx7989GhT11wNOC0s\"",
    "mtime": "2026-03-19T20:26:57.778Z",
    "size": 13276,
    "path": "../public/_nuxt/index.a2CPSbdx.css"
  },
  "/_nuxt/index.x7k1_5WZ.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"798-WBiq8SB15KYQkrSCSNGCZrdEjMk\"",
    "mtime": "2026-03-19T20:26:57.780Z",
    "size": 1944,
    "path": "../public/_nuxt/index.x7k1_5WZ.css"
  },
  "/_nuxt/jhtFpIFW.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"db9-4PDLQwxIcKAkSsExc2gr1Uh2awY\"",
    "mtime": "2026-03-19T20:26:57.779Z",
    "size": 3513,
    "path": "../public/_nuxt/jhtFpIFW.js"
  },
  "/_nuxt/judge.DbnsmwbT.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"bbd-RH0Ka8Ev0YJpgTM44aA/ARSk8VQ\"",
    "mtime": "2026-03-19T20:26:57.779Z",
    "size": 3005,
    "path": "../public/_nuxt/judge.DbnsmwbT.css"
  },
  "/_nuxt/lFoWRyY8.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"5795-ciY5wXzjs8q6sRnAxbQDrS2fT+A\"",
    "mtime": "2026-03-19T20:26:57.779Z",
    "size": 22421,
    "path": "../public/_nuxt/lFoWRyY8.js"
  },
  "/_nuxt/index.tcrmnQxf.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"26b8-y/k0GJqFzg5FUWj9uqgsZZ74bV8\"",
    "mtime": "2026-03-19T20:26:57.779Z",
    "size": 9912,
    "path": "../public/_nuxt/index.tcrmnQxf.css"
  },
  "/_nuxt/index.fkyCKNjJ.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"3f43-jhWX6VBC5xXhVe1xiw8HybDDk0A\"",
    "mtime": "2026-03-19T20:26:57.778Z",
    "size": 16195,
    "path": "../public/_nuxt/index.fkyCKNjJ.css"
  },
  "/_nuxt/login.CUUQ76s-.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"842-OYAltsLJzG+KE7CGV4WMJgVvmTU\"",
    "mtime": "2026-03-19T20:26:57.779Z",
    "size": 2114,
    "path": "../public/_nuxt/login.CUUQ76s-.css"
  },
  "/_nuxt/members.DLD_br4h.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"987-ctN0bJbJEThlu2enX+6fPWo3Mqs\"",
    "mtime": "2026-03-19T20:26:57.779Z",
    "size": 2439,
    "path": "../public/_nuxt/members.DLD_br4h.css"
  },
  "/_nuxt/notifications.DPrG148p.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"52f-rRKLv3VRAku5tfUEVU2jbQF3sFQ\"",
    "mtime": "2026-03-19T20:26:57.779Z",
    "size": 1327,
    "path": "../public/_nuxt/notifications.DPrG148p.css"
  },
  "/_nuxt/profile.CO5SRBjb.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"16bb-YXVXDSUj9KhpCjrfXTI2f7r/fUc\"",
    "mtime": "2026-03-19T20:26:57.779Z",
    "size": 5819,
    "path": "../public/_nuxt/profile.CO5SRBjb.css"
  },
  "/_nuxt/qoPLoz2B.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"1d1a-byyoYyQDb0+h/Fn2ImaM8ZgvyF8\"",
    "mtime": "2026-03-19T20:26:57.779Z",
    "size": 7450,
    "path": "../public/_nuxt/qoPLoz2B.js"
  },
  "/_nuxt/reports.Dd-6Ubhw.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"70e-Cuacm30s0TM1175Ta+S/qjqWla0\"",
    "mtime": "2026-03-19T20:26:57.779Z",
    "size": 1806,
    "path": "../public/_nuxt/reports.Dd-6Ubhw.css"
  },
  "/_nuxt/register.BIf2l6sv.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"8d4-r+4bzBB4QN3lS7Lflw3JjH9avbU\"",
    "mtime": "2026-03-19T20:26:57.779Z",
    "size": 2260,
    "path": "../public/_nuxt/register.BIf2l6sv.css"
  },
  "/_nuxt/reset-password.BYp2gaQR.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"7cb-KX+SI/aM15slB5p3EoTWE4OtQKs\"",
    "mtime": "2026-03-19T20:26:57.779Z",
    "size": 1995,
    "path": "../public/_nuxt/reset-password.BYp2gaQR.css"
  },
  "/_nuxt/search.Cup0agm2.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"2e55-mPK3XUnHJFX17WUY+mjhLd+qQuY\"",
    "mtime": "2026-03-19T20:26:57.779Z",
    "size": 11861,
    "path": "../public/_nuxt/search.Cup0agm2.css"
  },
  "/_nuxt/settings.BzB5OV_U.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"5ea-AqxZt5wYrk3kuCDtbQ7y0gNx/TE\"",
    "mtime": "2026-03-19T20:26:57.779Z",
    "size": 1514,
    "path": "../public/_nuxt/settings.BzB5OV_U.css"
  },
  "/_nuxt/settings.CbiJXFty.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"6a6-SrxVMWrnT+cjkrF2upxeGy7fZk0\"",
    "mtime": "2026-03-19T20:26:57.780Z",
    "size": 1702,
    "path": "../public/_nuxt/settings.CbiJXFty.css"
  },
  "/_nuxt/u0P4_RPZ.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"b5c-Fj5+Dl+Mx1C3cHQ2roweCn3/K7I\"",
    "mtime": "2026-03-19T20:26:57.780Z",
    "size": 2908,
    "path": "../public/_nuxt/u0P4_RPZ.js"
  },
  "/_nuxt/uOa77k_q.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"32fb9-63qfJD7EnPYmGJXxchySOPEOWuU\"",
    "mtime": "2026-03-19T20:26:57.781Z",
    "size": 208825,
    "path": "../public/_nuxt/uOa77k_q.js"
  },
  "/_nuxt/users.D7VAnrae.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"882-NLZTSnqQNiLOSIUJ4f1cucVWjj4\"",
    "mtime": "2026-03-19T20:26:57.780Z",
    "size": 2178,
    "path": "../public/_nuxt/users.D7VAnrae.css"
  },
  "/_nuxt/verify-email.DtJYGrd_.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"23f-+ScI65B6EoRwPsLxMSE1M6oEKZs\"",
    "mtime": "2026-03-19T20:26:57.780Z",
    "size": 575,
    "path": "../public/_nuxt/verify-email.DtJYGrd_.css"
  },
  "/_nuxt/submit.C9DcTXxB.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"632-LplDxMKrL+7y6UBrJ05eGIB+eBM\"",
    "mtime": "2026-03-19T20:26:57.780Z",
    "size": 1586,
    "path": "../public/_nuxt/submit.C9DcTXxB.css"
  },
  "/uploads/content/1dd04a10-f12d-4060-b8fd-e710cfb3b6d6.png": {
    "type": "image/png",
    "etag": "\"957b-Sa5FkC26jBXpyeqyQ7epHXCfrm0\"",
    "mtime": "2026-03-19T20:26:57.746Z",
    "size": 38267,
    "path": "../public/uploads/content/1dd04a10-f12d-4060-b8fd-e710cfb3b6d6.png"
  },
  "/uploads/content/20cfbf98-6942-4c18-9267-81f45d2d9c97.png": {
    "type": "image/png",
    "etag": "\"db5f-nntplnFKGBDrAJvyMhaQ15dLcPg\"",
    "mtime": "2026-03-19T20:26:57.747Z",
    "size": 56159,
    "path": "../public/uploads/content/20cfbf98-6942-4c18-9267-81f45d2d9c97.png"
  },
  "/uploads/content/7c519b80-8912-4466-9caa-effe38d82f07.png": {
    "type": "image/png",
    "etag": "\"957b-Sa5FkC26jBXpyeqyQ7epHXCfrm0\"",
    "mtime": "2026-03-19T20:26:57.746Z",
    "size": 38267,
    "path": "../public/uploads/content/7c519b80-8912-4466-9caa-effe38d82f07.png"
  },
  "/uploads/content/daa9fc81-6d27-45e7-8015-9d59f943d976.png": {
    "type": "image/png",
    "etag": "\"957b-Sa5FkC26jBXpyeqyQ7epHXCfrm0\"",
    "mtime": "2026-03-19T20:26:57.747Z",
    "size": 38267,
    "path": "../public/uploads/content/daa9fc81-6d27-45e7-8015-9d59f943d976.png"
  },
  "/uploads/content/efbbfc35-45cc-4e90-af24-70d61961389e.png": {
    "type": "image/png",
    "etag": "\"29c08-s1rxj8lFl0AmICI5FY+D62sgRIs\"",
    "mtime": "2026-03-19T20:26:57.747Z",
    "size": 171016,
    "path": "../public/uploads/content/efbbfc35-45cc-4e90-af24-70d61961389e.png"
  },
  "/_nuxt/builds/latest.json": {
    "type": "application/json",
    "etag": "\"47-q0TgV8ioslbDYzh7lrlCTvSlD9Y\"",
    "mtime": "2026-03-19T20:26:57.743Z",
    "size": 71,
    "path": "../public/_nuxt/builds/latest.json"
  },
  "/uploads/content/variants/26dbc58f-d3bf-424c-a605-b7cac3f29d68.webp": {
    "type": "image/webp",
    "etag": "\"568-CVvXVBgWuDZDHS/QPObssvEkT3Y\"",
    "mtime": "2026-03-19T20:26:57.748Z",
    "size": 1384,
    "path": "../public/uploads/content/variants/26dbc58f-d3bf-424c-a605-b7cac3f29d68.webp"
  },
  "/uploads/content/variants/5946d305-b5be-4002-aa64-4e75374d9100.webp": {
    "type": "image/webp",
    "etag": "\"916-k+XQhAJ+t9We9jLBsO4y8Y5aGFU\"",
    "mtime": "2026-03-19T20:26:57.747Z",
    "size": 2326,
    "path": "../public/uploads/content/variants/5946d305-b5be-4002-aa64-4e75374d9100.webp"
  },
  "/uploads/content/variants/21105036-8465-4fff-909f-68173c7cab21.webp": {
    "type": "image/webp",
    "etag": "\"1960-1lVwyZKzUtHMFn1AIbmyhiqMBqQ\"",
    "mtime": "2026-03-19T20:26:57.747Z",
    "size": 6496,
    "path": "../public/uploads/content/variants/21105036-8465-4fff-909f-68173c7cab21.webp"
  },
  "/uploads/content/variants/3256cd97-ba50-4e1c-98c3-7cbb98fdd659.webp": {
    "type": "image/webp",
    "etag": "\"916-k+XQhAJ+t9We9jLBsO4y8Y5aGFU\"",
    "mtime": "2026-03-19T20:26:57.748Z",
    "size": 2326,
    "path": "../public/uploads/content/variants/3256cd97-ba50-4e1c-98c3-7cbb98fdd659.webp"
  },
  "/uploads/content/variants/5967f57b-77f7-46cc-a790-e4737c2009bb.webp": {
    "type": "image/webp",
    "etag": "\"2850-rs98I+OHZnsC57HKp+C0TGLehqA\"",
    "mtime": "2026-03-19T20:26:57.746Z",
    "size": 10320,
    "path": "../public/uploads/content/variants/5967f57b-77f7-46cc-a790-e4737c2009bb.webp"
  },
  "/uploads/content/variants/6c3881ff-9fc9-4203-a6d8-85acd690e1ab.webp": {
    "type": "image/webp",
    "etag": "\"ba4-wKUd2Q4z6sW6MHCxWt2NEbA6s1Y\"",
    "mtime": "2026-03-19T20:26:57.747Z",
    "size": 2980,
    "path": "../public/uploads/content/variants/6c3881ff-9fc9-4203-a6d8-85acd690e1ab.webp"
  },
  "/uploads/content/variants/8f8f51bf-49b1-4a98-8f4d-7b88e563a70e.webp": {
    "type": "image/webp",
    "etag": "\"5072-9ACF0XkaGH8BoTZjiq4baKYuKy0\"",
    "mtime": "2026-03-19T20:26:57.747Z",
    "size": 20594,
    "path": "../public/uploads/content/variants/8f8f51bf-49b1-4a98-8f4d-7b88e563a70e.webp"
  },
  "/uploads/content/variants/9a31accc-c7e5-4301-badc-582d77da8b88.webp": {
    "type": "image/webp",
    "etag": "\"12ec-57QRNisOlmm5IQtlonQICjkWNF0\"",
    "mtime": "2026-03-19T20:26:57.748Z",
    "size": 4844,
    "path": "../public/uploads/content/variants/9a31accc-c7e5-4301-badc-582d77da8b88.webp"
  },
  "/uploads/content/variants/735f8d88-89f8-438d-b6f6-2d2ea07a5a4e.webp": {
    "type": "image/webp",
    "etag": "\"12ec-57QRNisOlmm5IQtlonQICjkWNF0\"",
    "mtime": "2026-03-19T20:26:57.747Z",
    "size": 4844,
    "path": "../public/uploads/content/variants/735f8d88-89f8-438d-b6f6-2d2ea07a5a4e.webp"
  },
  "/uploads/content/variants/9d362228-3797-4b61-9123-7829fea96219.webp": {
    "type": "image/webp",
    "etag": "\"12ec-57QRNisOlmm5IQtlonQICjkWNF0\"",
    "mtime": "2026-03-19T20:26:57.747Z",
    "size": 4844,
    "path": "../public/uploads/content/variants/9d362228-3797-4b61-9123-7829fea96219.webp"
  },
  "/uploads/content/variants/9d38dee7-bc6d-4348-853a-07731d61912c.webp": {
    "type": "image/webp",
    "etag": "\"6c16-BgKnWRN+x3jBRPEO7MaAUSDVOYM\"",
    "mtime": "2026-03-19T20:26:57.747Z",
    "size": 27670,
    "path": "../public/uploads/content/variants/9d38dee7-bc6d-4348-853a-07731d61912c.webp"
  },
  "/uploads/content/variants/c6249783-7a95-4f11-b313-266563abfcd1.webp": {
    "type": "image/webp",
    "etag": "\"916-k+XQhAJ+t9We9jLBsO4y8Y5aGFU\"",
    "mtime": "2026-03-19T20:26:57.747Z",
    "size": 2326,
    "path": "../public/uploads/content/variants/c6249783-7a95-4f11-b313-266563abfcd1.webp"
  },
  "/uploads/content/variants/f0f426f7-a91e-4846-84d0-c6160983d173.webp": {
    "type": "image/webp",
    "etag": "\"36ce-g0/hCWYSncI3vUBfG12TCxizLXg\"",
    "mtime": "2026-03-19T20:26:57.747Z",
    "size": 14030,
    "path": "../public/uploads/content/variants/f0f426f7-a91e-4846-84d0-c6160983d173.webp"
  },
  "/_nuxt/builds/meta/4220b328-6e01-47d0-a7ba-fa6a4c3f9541.json": {
    "type": "application/json",
    "etag": "\"58-LaC/23SB40ScY3YWoTVI9weCJ6o\"",
    "mtime": "2026-03-19T20:26:57.741Z",
    "size": 88,
    "path": "../public/_nuxt/builds/meta/4220b328-6e01-47d0-a7ba-fa6a4c3f9541.json"
  },
  "/_nuxt/builds/meta/dev.json": {
    "type": "application/json",
    "etag": "\"37-LyuVim+OvedabL43imi5djD/6FA\"",
    "mtime": "2026-03-19T20:26:57.741Z",
    "size": 55,
    "path": "../public/_nuxt/builds/meta/dev.json"
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

const publicAssetBases = {"/_nuxt/builds/meta/":{"maxAge":31536000},"/_nuxt/builds/":{"maxAge":1},"/uploads/":{"maxAge":86400},"/_nuxt/":{"maxAge":31536000}};

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
const _1oFHXm = eventHandler((event) => {
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
  hubs: z.boolean().default(true),
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
  contentTypes: z.array(z.enum(["project", "article", "blog", "explainer"])).default(["project", "article", "blog", "explainer"])
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

const userRoleEnum = pgEnum("user_role", ["member", "pro", "verified", "staff", "admin"]);
const userStatusEnum = pgEnum("user_status", ["active", "suspended", "deleted"]);
const profileVisibilityEnum = pgEnum("profile_visibility", ["public", "members", "private"]);
const contentStatusEnum = pgEnum("content_status", ["draft", "published", "archived"]);
const contentTypeEnum = pgEnum("content_type", [
  "project",
  "article",
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
  "post"
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
  "hub",
  "system"
]);
const hubTypeEnum = pgEnum("hub_type", ["community", "product", "company"]);
const hubPrivacyEnum = pgEnum("hub_privacy", ["public", "unlisted", "private"]);
const hubRoleEnum = pgEnum("hub_role", [
  "owner",
  "admin",
  "moderator",
  "member"
]);
const hubJoinPolicyEnum = pgEnum("hub_join_policy", [
  "open",
  "approval",
  "invite"
]);
const hubMemberStatusEnum = pgEnum("hub_member_status", ["pending", "active"]);
const postTypeEnum = pgEnum("post_type", ["text", "link", "share", "poll"]);
const productStatusEnum = pgEnum("product_status", ["active", "discontinued", "preview"]);
const productCategoryEnum = pgEnum("product_category", [
  "microcontroller",
  "sbc",
  "sensor",
  "actuator",
  "display",
  "communication",
  "power",
  "mechanical",
  "software",
  "tool",
  "other"
]);
const lessonTypeEnum = pgEnum("lesson_type", [
  "article",
  "video",
  "quiz",
  "project",
  "explainer"
]);
const contestStatusEnum = pgEnum("contest_status", [
  "upcoming",
  "active",
  "judging",
  "completed"
]);
const videoPlatformEnum = pgEnum("video_platform", ["youtube", "vimeo", "other"]);
const filePurposeEnum = pgEnum("file_purpose", [
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
const tagCategoryEnum = pgEnum("tag_category", [
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
  pronouns: varchar("pronouns", { length: 32 }),
  timezone: varchar("timezone", { length: 64 }),
  emailNotifications: jsonb("email_notifications").$type(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
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
const oauthClients = pgTable("oauth_clients", {
  id: uuid("id").defaultRandom().primaryKey(),
  clientId: varchar("client_id", { length: 255 }).notNull().unique(),
  clientSecret: varchar("client_secret", { length: 512 }).notNull(),
  redirectUris: jsonb("redirect_uris").$type().notNull(),
  instanceDomain: varchar("instance_domain", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
const oauthCodes = pgTable("oauth_codes", {
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
const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  members: many(members),
  federatedAccounts: many(federatedAccounts)
}));
const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] })
}));
const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] })
}));
const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(members)
}));
const membersRelations = relations(members, ({ one }) => ({
  organization: one(organizations, {
    fields: [members.organizationId],
    references: [organizations.id]
  }),
  user: one(users, { fields: [members.userId], references: [users.id] })
}));
const federatedAccountsRelations = relations(federatedAccounts, ({ one }) => ({
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
  // Additional metadata
  licenseType: varchar("license_type", { length: 32 }),
  series: varchar("series", { length: 128 }),
  estimatedMinutes: integer("estimated_minutes"),
  // Federation readiness
  canonicalUrl: text("canonical_url"),
  apObjectId: text("ap_object_id"),
  // Soft delete
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  // Counters (denormalized for read performance)
  viewCount: integer("view_count").default(0).notNull(),
  likeCount: integer("like_count").default(0).notNull(),
  commentCount: integer("comment_count").default(0).notNull(),
  forkCount: integer("fork_count").default(0).notNull(),
  buildCount: integer("build_count").default(0).notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
}, (t) => [
  index("idx_content_items_author_id").on(t.authorId),
  index("idx_content_items_status").on(t.status),
  index("idx_content_items_type").on(t.type),
  index("idx_content_items_published_at").on(t.publishedAt)
]);
const contentVersions = pgTable("content_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  contentId: uuid("content_id").notNull().references(() => contentItems.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  title: varchar("title", { length: 255 }),
  content: jsonb("content"),
  metadata: jsonb("metadata"),
  createdById: uuid("created_by_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, (t) => [
  index("idx_content_versions_content_id").on(t.contentId)
]);
const contentForks = pgTable("content_forks", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourceId: uuid("source_id").notNull().references(() => contentItems.id, { onDelete: "cascade" }),
  forkId: uuid("fork_id").notNull().references(() => contentItems.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, (t) => [
  index("idx_content_forks_source_id").on(t.sourceId),
  index("idx_content_forks_fork_id").on(t.forkId)
]);
const contentBuilds = pgTable("content_builds", {
  id: uuid("id").defaultRandom().primaryKey(),
  contentId: uuid("content_id").notNull().references(() => contentItems.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, (t) => [
  unique("content_builds_user_content").on(t.userId, t.contentId),
  index("idx_content_builds_content_id").on(t.contentId)
]);
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
}, (t) => [
  index("idx_content_tags_content_id").on(t.contentId),
  index("idx_content_tags_tag_id").on(t.tagId)
]);
const contentItemsRelations = relations(contentItems, ({ one, many }) => ({
  author: one(users, { fields: [contentItems.authorId], references: [users.id] }),
  tags: many(contentTags),
  versions: many(contentVersions),
  forksFrom: many(contentForks, { relationName: "forkSource" }),
  forksTo: many(contentForks, { relationName: "forkTarget" })
}));
const contentVersionsRelations = relations(contentVersions, ({ one }) => ({
  content: one(contentItems, {
    fields: [contentVersions.contentId],
    references: [contentItems.id]
  }),
  createdBy: one(users, {
    fields: [contentVersions.createdById],
    references: [users.id]
  })
}));
const contentForksRelations = relations(contentForks, ({ one }) => ({
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
const tagsRelations = relations(tags, ({ many }) => ({
  contentTags: many(contentTags)
}));
const contentTagsRelations = relations(contentTags, ({ one }) => ({
  content: one(contentItems, { fields: [contentTags.contentId], references: [contentItems.id] }),
  tag: one(tags, { fields: [contentTags.tagId], references: [tags.id] })
}));

const likes = pgTable("likes", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  targetType: likeTargetTypeEnum("target_type").notNull(),
  targetId: uuid("target_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, (t) => [
  unique("likes_user_target").on(t.userId, t.targetType, t.targetId),
  index("idx_likes_target").on(t.targetType, t.targetId)
]);
const follows = pgTable("follows", {
  id: uuid("id").defaultRandom().primaryKey(),
  followerId: uuid("follower_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  followingId: uuid("following_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, (t) => [
  unique("follows_pair").on(t.followerId, t.followingId),
  index("idx_follows_follower_id").on(t.followerId),
  index("idx_follows_following_id").on(t.followingId)
]);
const comments = pgTable("comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  authorId: uuid("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  targetType: commentTargetTypeEnum("target_type").notNull(),
  targetId: uuid("target_id").notNull(),
  // Self-referencing FK handled via relations; DB-level constraint added via migration
  parentId: uuid("parent_id"),
  content: text("content").notNull(),
  likeCount: integer("like_count").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
}, (t) => [
  index("idx_comments_author_id").on(t.authorId),
  index("idx_comments_target").on(t.targetType, t.targetId),
  index("idx_comments_parent_id").on(t.parentId)
]);
const bookmarks = pgTable("bookmarks", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  targetType: bookmarkTargetTypeEnum("target_type").notNull(),
  targetId: uuid("target_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, (t) => [
  unique("bookmarks_user_target").on(t.userId, t.targetType, t.targetId),
  index("idx_bookmarks_target").on(t.targetType, t.targetId)
]);
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
}, (t) => [
  index("idx_notifications_user_id").on(t.userId),
  index("idx_notifications_user_read").on(t.userId, t.read)
]);
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
}, (t) => [
  index("idx_reports_reporter_id").on(t.reporterId),
  index("idx_reports_status").on(t.status)
]);
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
}, (t) => [
  index("idx_messages_conversation_id").on(t.conversationId),
  index("idx_messages_sender_id").on(t.senderId)
]);
const likesRelations = relations(likes, ({ one }) => ({
  user: one(users, { fields: [likes.userId], references: [users.id] })
}));
const followsRelations = relations(follows, ({ one }) => ({
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
const commentsRelations = relations(comments, ({ one, many }) => ({
  author: one(users, { fields: [comments.authorId], references: [users.id] }),
  parent: one(comments, {
    fields: [comments.parentId],
    references: [comments.id],
    relationName: "thread"
  }),
  replies: many(comments, { relationName: "thread" })
}));
const bookmarksRelations = relations(bookmarks, ({ one }) => ({
  user: one(users, { fields: [bookmarks.userId], references: [users.id] })
}));
const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
  actor: one(users, { fields: [notifications.actorId], references: [users.id] })
}));
const reportsRelations = relations(reports, ({ one }) => ({
  reporter: one(users, { fields: [reports.reporterId], references: [users.id] }),
  reviewer: one(users, { fields: [reports.reviewedById], references: [users.id] })
}));
const conversationsRelations = relations(conversations, ({ many }) => ({
  messages: many(messages)
}));
const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id]
  }),
  sender: one(users, { fields: [messages.senderId], references: [users.id] })
}));

const hubs = pgTable("hubs", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  description: text("description"),
  rules: text("rules"),
  iconUrl: text("icon_url"),
  bannerUrl: text("banner_url"),
  hubType: hubTypeEnum("hub_type").default("community").notNull(),
  privacy: hubPrivacyEnum("privacy").default("public").notNull(),
  joinPolicy: hubJoinPolicyEnum("join_policy").default("open").notNull(),
  parentHubId: uuid("parent_hub_id"),
  website: varchar("website", { length: 512 }),
  categories: jsonb("categories").$type(),
  createdById: uuid("created_by_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  isOfficial: boolean("is_official").default(false).notNull(),
  memberCount: integer("member_count").default(0).notNull(),
  postCount: integer("post_count").default(0).notNull(),
  apActorId: text("ap_actor_id"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
}, (t) => [
  index("idx_hubs_created_by_id").on(t.createdById),
  index("idx_hubs_hub_type").on(t.hubType)
]);
const hubMembers = pgTable("hub_members", {
  hubId: uuid("hub_id").notNull().references(() => hubs.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: hubRoleEnum("role").default("member").notNull(),
  status: hubMemberStatusEnum("status").default("active").notNull(),
  joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull()
}, (t) => [primaryKey({ columns: [t.hubId, t.userId] })]);
const hubPosts = pgTable("hub_posts", {
  id: uuid("id").defaultRandom().primaryKey(),
  hubId: uuid("hub_id").notNull().references(() => hubs.id, { onDelete: "cascade" }),
  authorId: uuid("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: postTypeEnum("type").default("text").notNull(),
  content: text("content").notNull(),
  isPinned: boolean("is_pinned").default(false).notNull(),
  isLocked: boolean("is_locked").default(false).notNull(),
  likeCount: integer("like_count").default(0).notNull(),
  replyCount: integer("reply_count").default(0).notNull(),
  lastEditedAt: timestamp("last_edited_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
}, (t) => [
  index("idx_hub_posts_hub_id").on(t.hubId),
  index("idx_hub_posts_author_id").on(t.authorId)
]);
const hubPostReplies = pgTable("hub_post_replies", {
  id: uuid("id").defaultRandom().primaryKey(),
  postId: uuid("post_id").notNull().references(() => hubPosts.id, { onDelete: "cascade" }),
  authorId: uuid("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  // Self-referencing FK handled via relations; DB-level constraint added via migration
  parentId: uuid("parent_id"),
  content: text("content").notNull(),
  likeCount: integer("like_count").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
}, (t) => [
  index("idx_hub_post_replies_post_id").on(t.postId),
  index("idx_hub_post_replies_author_id").on(t.authorId)
]);
const hubBans = pgTable("hub_bans", {
  id: uuid("id").defaultRandom().primaryKey(),
  hubId: uuid("hub_id").notNull().references(() => hubs.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  bannedById: uuid("banned_by_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  reason: text("reason"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, (t) => [
  index("idx_hub_bans_hub_id").on(t.hubId),
  index("idx_hub_bans_user_id").on(t.userId)
]);
const hubInvites = pgTable("hub_invites", {
  id: uuid("id").defaultRandom().primaryKey(),
  hubId: uuid("hub_id").notNull().references(() => hubs.id, { onDelete: "cascade" }),
  createdById: uuid("created_by_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 64 }).notNull().unique(),
  maxUses: integer("max_uses"),
  useCount: integer("use_count").default(0).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, (t) => [
  index("idx_hub_invites_hub_id").on(t.hubId)
]);
const hubShares = pgTable("hub_shares", {
  id: uuid("id").defaultRandom().primaryKey(),
  hubId: uuid("hub_id").notNull().references(() => hubs.id, { onDelete: "cascade" }),
  contentId: uuid("content_id").notNull().references(() => contentItems.id, { onDelete: "cascade" }),
  sharedById: uuid("shared_by_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, (t) => [
  index("idx_hub_shares_hub_id").on(t.hubId),
  index("idx_hub_shares_content_id").on(t.contentId)
]);
const hubsRelations = relations(hubs, ({ one, many }) => ({
  createdBy: one(users, { fields: [hubs.createdById], references: [users.id] }),
  parentHub: one(hubs, {
    fields: [hubs.parentHubId],
    references: [hubs.id],
    relationName: "hubHierarchy"
  }),
  childHubs: many(hubs, { relationName: "hubHierarchy" }),
  members: many(hubMembers),
  posts: many(hubPosts),
  bans: many(hubBans),
  invites: many(hubInvites),
  shares: many(hubShares)
}));
const hubMembersRelations = relations(hubMembers, ({ one }) => ({
  hub: one(hubs, {
    fields: [hubMembers.hubId],
    references: [hubs.id]
  }),
  user: one(users, { fields: [hubMembers.userId], references: [users.id] })
}));
const hubPostsRelations = relations(hubPosts, ({ one, many }) => ({
  hub: one(hubs, {
    fields: [hubPosts.hubId],
    references: [hubs.id]
  }),
  author: one(users, { fields: [hubPosts.authorId], references: [users.id] }),
  replies: many(hubPostReplies)
}));
const hubPostRepliesRelations = relations(hubPostReplies, ({ one, many }) => ({
  post: one(hubPosts, {
    fields: [hubPostReplies.postId],
    references: [hubPosts.id]
  }),
  author: one(users, { fields: [hubPostReplies.authorId], references: [users.id] }),
  parent: one(hubPostReplies, {
    fields: [hubPostReplies.parentId],
    references: [hubPostReplies.id],
    relationName: "replyThread"
  }),
  children: many(hubPostReplies, { relationName: "replyThread" })
}));
const hubBansRelations = relations(hubBans, ({ one }) => ({
  hub: one(hubs, {
    fields: [hubBans.hubId],
    references: [hubs.id]
  }),
  user: one(users, { fields: [hubBans.userId], references: [users.id] }),
  bannedBy: one(users, { fields: [hubBans.bannedById], references: [users.id] })
}));
const hubInvitesRelations = relations(hubInvites, ({ one }) => ({
  hub: one(hubs, {
    fields: [hubInvites.hubId],
    references: [hubs.id]
  }),
  createdBy: one(users, { fields: [hubInvites.createdById], references: [users.id] })
}));
const hubSharesRelations = relations(hubShares, ({ one }) => ({
  hub: one(hubs, {
    fields: [hubShares.hubId],
    references: [hubs.id]
  }),
  content: one(contentItems, {
    fields: [hubShares.contentId],
    references: [contentItems.id]
  }),
  sharedBy: one(users, { fields: [hubShares.sharedById], references: [users.id] })
}));

const products = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  description: text("description"),
  hubId: uuid("hub_id").notNull().references(() => hubs.id, { onDelete: "cascade" }),
  category: productCategoryEnum("category"),
  specs: jsonb("specs").$type(),
  imageUrl: text("image_url"),
  purchaseUrl: text("purchase_url"),
  datasheetUrl: text("datasheet_url"),
  alternatives: jsonb("alternatives").$type(),
  pricing: jsonb("pricing").$type(),
  status: productStatusEnum("status").default("active").notNull(),
  createdById: uuid("created_by_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
}, (t) => [
  index("idx_products_hub_id").on(t.hubId),
  index("idx_products_created_by_id").on(t.createdById)
]);
const contentProducts = pgTable("content_products", {
  id: uuid("id").defaultRandom().primaryKey(),
  contentId: uuid("content_id").notNull().references(() => contentItems.id, { onDelete: "cascade" }),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  quantity: integer("quantity").default(1).notNull(),
  role: varchar("role", { length: 64 }),
  notes: text("notes"),
  required: boolean("required").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, (t) => [
  uniqueIndex("idx_content_product_unique").on(t.contentId, t.productId),
  index("idx_content_products_product_id").on(t.productId)
]);
const productsRelations = relations(products, ({ one, many }) => ({
  hub: one(hubs, { fields: [products.hubId], references: [hubs.id] }),
  createdBy: one(users, { fields: [products.createdById], references: [users.id] }),
  contentProducts: many(contentProducts)
}));
const contentProductsRelations = relations(contentProducts, ({ one }) => ({
  content: one(contentItems, {
    fields: [contentProducts.contentId],
    references: [contentItems.id]
  }),
  product: one(products, {
    fields: [contentProducts.productId],
    references: [products.id]
  })
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
}, (t) => [
  index("idx_learning_paths_author_id").on(t.authorId),
  index("idx_learning_paths_status").on(t.status)
]);
const learningModules = pgTable("learning_modules", {
  id: uuid("id").defaultRandom().primaryKey(),
  pathId: uuid("path_id").notNull().references(() => learningPaths.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, (t) => [
  index("idx_learning_modules_path_id").on(t.pathId)
]);
const learningLessons = pgTable("learning_lessons", {
  id: uuid("id").defaultRandom().primaryKey(),
  moduleId: uuid("module_id").notNull().references(() => learningModules.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull(),
  type: lessonTypeEnum("type").notNull(),
  content: jsonb("content"),
  contentItemId: uuid("content_item_id").references(() => contentItems.id, { onDelete: "set null" }),
  duration: integer("duration_minutes"),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
}, (t) => [
  unique("learning_lessons_module_slug").on(t.moduleId, t.slug),
  index("idx_learning_lessons_module_id").on(t.moduleId)
]);
const enrollments = pgTable("enrollments", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  pathId: uuid("path_id").notNull().references(() => learningPaths.id, { onDelete: "cascade" }),
  progress: numeric("progress", { precision: 5, scale: 2 }).default("0").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true })
}, (t) => [
  unique("enrollments_user_path").on(t.userId, t.pathId),
  index("idx_enrollments_user_id").on(t.userId),
  index("idx_enrollments_path_id").on(t.pathId)
]);
const lessonProgress = pgTable("lesson_progress", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  lessonId: uuid("lesson_id").notNull().references(() => learningLessons.id, { onDelete: "cascade" }),
  completed: boolean("completed").default(false).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  quizScore: numeric("quiz_score", { precision: 5, scale: 2 }),
  quizPassed: boolean("quiz_passed")
}, (t) => [
  unique("lesson_progress_user_lesson").on(t.userId, t.lessonId),
  index("idx_lesson_progress_lesson_id").on(t.lessonId)
]);
const certificates = pgTable("certificates", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  pathId: uuid("path_id").notNull().references(() => learningPaths.id, { onDelete: "cascade" }),
  verificationCode: varchar("verification_code", { length: 64 }).notNull().unique(),
  certificateUrl: text("certificate_url"),
  issuedAt: timestamp("issued_at", { withTimezone: true }).defaultNow().notNull()
}, (t) => [
  unique("certificates_user_path").on(t.userId, t.pathId),
  index("idx_certificates_path_id").on(t.pathId)
]);
const learningPathsRelations = relations(learningPaths, ({ one, many }) => ({
  author: one(users, { fields: [learningPaths.authorId], references: [users.id] }),
  modules: many(learningModules),
  enrollments: many(enrollments),
  certificates: many(certificates)
}));
const learningModulesRelations = relations(learningModules, ({ one, many }) => ({
  path: one(learningPaths, { fields: [learningModules.pathId], references: [learningPaths.id] }),
  lessons: many(learningLessons)
}));
const learningLessonsRelations = relations(learningLessons, ({ one }) => ({
  module: one(learningModules, {
    fields: [learningLessons.moduleId],
    references: [learningModules.id]
  }),
  contentItem: one(contentItems, {
    fields: [learningLessons.contentItemId],
    references: [contentItems.id]
  })
}));
const enrollmentsRelations = relations(enrollments, ({ one }) => ({
  user: one(users, { fields: [enrollments.userId], references: [users.id] }),
  path: one(learningPaths, { fields: [enrollments.pathId], references: [learningPaths.id] })
}));
const lessonProgressRelations = relations(lessonProgress, ({ one }) => ({
  user: one(users, { fields: [lessonProgress.userId], references: [users.id] }),
  lesson: one(learningLessons, {
    fields: [lessonProgress.lessonId],
    references: [learningLessons.id]
  })
}));
const certificatesRelations = relations(certificates, ({ one }) => ({
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
}, (t) => [
  index("idx_docs_sites_owner_id").on(t.ownerId)
]);
const docsVersions = pgTable("docs_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  siteId: uuid("site_id").notNull().references(() => docsSites.id, { onDelete: "cascade" }),
  version: varchar("version", { length: 32 }).notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, (t) => [
  unique("docs_versions_site_version").on(t.siteId, t.version),
  index("idx_docs_versions_site_id").on(t.siteId)
]);
const docsPages = pgTable("docs_pages", {
  id: uuid("id").defaultRandom().primaryKey(),
  versionId: uuid("version_id").notNull().references(() => docsVersions.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull(),
  content: text("content").notNull(),
  // Raw markdown (Standing Rule #4)
  sortOrder: integer("sort_order").default(0).notNull(),
  // Self-referencing FK handled via relations; DB-level constraint added via migration
  parentId: uuid("parent_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
}, (t) => [
  index("idx_docs_pages_version_id").on(t.versionId),
  index("idx_docs_pages_parent_id").on(t.parentId)
]);
const docsNav = pgTable("docs_nav", {
  id: uuid("id").defaultRandom().primaryKey(),
  versionId: uuid("version_id").notNull().references(() => docsVersions.id, { onDelete: "cascade" }),
  structure: jsonb("structure").$type(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});
const docsSitesRelations = relations(docsSites, ({ one, many }) => ({
  owner: one(users, { fields: [docsSites.ownerId], references: [users.id] }),
  versions: many(docsVersions)
}));
const docsVersionsRelations = relations(docsVersions, ({ one, many }) => ({
  site: one(docsSites, { fields: [docsVersions.siteId], references: [docsSites.id] }),
  pages: many(docsPages),
  nav: many(docsNav)
}));
const docsPagesRelations = relations(docsPages, ({ one, many }) => ({
  version: one(docsVersions, { fields: [docsPages.versionId], references: [docsVersions.id] }),
  parent: one(docsPages, {
    fields: [docsPages.parentId],
    references: [docsPages.id],
    relationName: "pageHierarchy"
  }),
  children: many(docsPages, { relationName: "pageHierarchy" })
}));
const docsNavRelations = relations(docsNav, ({ one }) => ({
  version: one(docsVersions, { fields: [docsNav.versionId], references: [docsVersions.id] })
}));

const videos = pgTable("videos", {
  id: uuid("id").defaultRandom().primaryKey(),
  authorId: uuid("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  url: text("url").notNull(),
  embedUrl: text("embed_url"),
  platform: videoPlatformEnum("platform").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  duration: varchar("duration", { length: 16 }),
  viewCount: integer("view_count").default(0).notNull(),
  likeCount: integer("like_count").default(0).notNull(),
  commentCount: integer("comment_count").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
}, (t) => [
  index("idx_videos_author_id").on(t.authorId)
]);
const videoCategories = pgTable("video_categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 64 }).notNull().unique(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  description: text("description"),
  sortOrder: integer("sort_order").default(0).notNull()
});
const videosRelations = relations(videos, ({ one }) => ({
  author: one(users, { fields: [videos.authorId], references: [users.id] })
}));

const contests = pgTable("contests", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  description: text("description"),
  rules: text("rules"),
  bannerUrl: text("banner_url"),
  status: contestStatusEnum("status").default("upcoming").notNull(),
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true }).notNull(),
  judgingEndDate: timestamp("judging_end_date", { withTimezone: true }),
  prizes: jsonb("prizes").$type(),
  judges: jsonb("judges").$type(),
  createdById: uuid("created_by_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  entryCount: integer("entry_count").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
}, (t) => [
  index("idx_contests_created_by_id").on(t.createdById),
  index("idx_contests_status").on(t.status)
]);
const contestEntries = pgTable("contest_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  contestId: uuid("contest_id").notNull().references(() => contests.id, { onDelete: "cascade" }),
  contentId: uuid("content_id").notNull().references(() => contentItems.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  score: integer("score"),
  rank: integer("rank"),
  judgeScores: jsonb("judge_scores").$type(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow().notNull()
}, (t) => [
  unique("contest_entries_user_content").on(t.contestId, t.userId, t.contentId),
  index("idx_contest_entries_contest_id").on(t.contestId),
  index("idx_contest_entries_user_id").on(t.userId)
]);
const contestsRelations = relations(contests, ({ one, many }) => ({
  createdBy: one(users, { fields: [contests.createdById], references: [users.id] }),
  entries: many(contestEntries)
}));
const contestEntriesRelations = relations(contestEntries, ({ one }) => ({
  contest: one(contests, { fields: [contestEntries.contestId], references: [contests.id] }),
  content: one(contentItems, {
    fields: [contestEntries.contentId],
    references: [contentItems.id]
  }),
  user: one(users, { fields: [contestEntries.userId], references: [users.id] })
}));

const files = pgTable("files", {
  id: uuid("id").defaultRandom().primaryKey(),
  uploaderId: uuid("uploader_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  filename: varchar("filename", { length: 255 }).notNull(),
  originalName: varchar("original_name", { length: 255 }),
  mimeType: varchar("mime_type", { length: 128 }).notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  storageKey: text("storage_key").notNull(),
  publicUrl: text("public_url"),
  purpose: filePurposeEnum("purpose").default("attachment").notNull(),
  contentId: uuid("content_id").references(() => contentItems.id, { onDelete: "set null" }),
  hubId: uuid("hub_id").references(() => hubs.id, { onDelete: "set null" }),
  width: integer("width"),
  height: integer("height"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, (t) => [
  index("idx_files_uploader_id").on(t.uploaderId),
  index("idx_files_content_id").on(t.contentId)
]);
const filesRelations = relations(files, ({ one }) => ({
  uploader: one(users, { fields: [files.uploaderId], references: [users.id] }),
  content: one(contentItems, { fields: [files.contentId], references: [contentItems.id] }),
  hub: one(hubs, { fields: [files.hubId], references: [hubs.id] })
}));

const remoteActors = pgTable("remote_actors", {
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
}, (t) => [
  index("idx_activities_direction_status").on(t.direction, t.status),
  index("idx_activities_actor_uri").on(t.actorUri),
  index("idx_activities_created_at").on(t.createdAt)
]);
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
const actorKeypairsRelations = relations(actorKeypairs, ({ one }) => ({
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
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  action: varchar("action", { length: 64 }).notNull(),
  targetType: varchar("target_type", { length: 64 }).notNull(),
  targetId: varchar("target_id", { length: 255 }),
  metadata: jsonb("metadata"),
  ipAddress: varchar("ip_address", { length: 45 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, (t) => [
  index("idx_audit_logs_user_id").on(t.userId),
  index("idx_audit_logs_created_at").on(t.createdAt)
]);
const instanceSettingsRelations = relations(instanceSettings, ({ one }) => ({
  updater: one(users, { fields: [instanceSettings.updatedBy], references: [users.id] })
}));
const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, { fields: [auditLogs.userId], references: [users.id] })
}));

const optionalUrl = (maxLen) => {
  const base = maxLen ? z.string().url().max(maxLen) : z.string().url();
  return z.preprocess((val) => typeof val === "string" && val.trim() === "" ? void 0 : val, base.optional());
};
const usernameSchema = z.string().min(3).max(64).regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, hyphens, and underscores");
const emailSchema = z.string().email().max(255);
const displayNameSchema = z.string().min(1).max(128);
const bioSchema = z.string().max(2e3).optional();
const socialLinksSchema = z.object({
  github: optionalUrl(),
  twitter: optionalUrl(),
  linkedin: optionalUrl(),
  youtube: optionalUrl(),
  instagram: optionalUrl(),
  mastodon: optionalUrl(),
  discord: optionalUrl()
}).optional();
const createUserSchema = z.object({
  email: emailSchema,
  username: usernameSchema,
  displayName: displayNameSchema.optional()
});
const updateProfileSchema = z.object({
  displayName: displayNameSchema.optional(),
  bio: bioSchema,
  headline: z.string().max(255).optional(),
  location: z.string().max(128).optional(),
  website: optionalUrl(512),
  socialLinks: socialLinksSchema,
  skills: z.array(z.string().max(64)).max(50).optional(),
  pronouns: z.string().max(32).optional(),
  timezone: z.string().max(64).optional(),
  emailNotifications: z.object({
    digest: z.enum(["daily", "weekly", "none"]).optional(),
    likes: z.boolean().optional(),
    comments: z.boolean().optional(),
    follows: z.boolean().optional(),
    mentions: z.boolean().optional()
  }).optional()
});
const slugSchema = z.string().min(1).max(255).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with hyphens");
const contentTypeSchema = z.enum(["project", "article", "blog", "explainer"]);
const contentStatusSchema = z.enum(["draft", "published", "archived"]);
const difficultySchema = z.enum(["beginner", "intermediate", "advanced"]);
const createContentSchema = z.object({
  type: contentTypeSchema,
  title: z.string().min(1).max(255),
  subtitle: z.string().max(255).optional(),
  description: z.string().max(2e3).optional(),
  content: z.unknown().optional(),
  coverImageUrl: optionalUrl(),
  category: z.string().max(64).optional(),
  difficulty: difficultySchema.optional(),
  buildTime: z.string().max(64).optional(),
  estimatedCost: z.string().max(64).optional(),
  estimatedMinutes: z.preprocess((val) => val === "" || val === null ? void 0 : val, z.number().int().positive().optional()),
  visibility: z.enum(["public", "members", "private"]).optional(),
  seoDescription: z.preprocess((val) => typeof val === "string" && val.trim() === "" ? void 0 : val, z.string().max(320).optional()),
  licenseType: z.string().max(32).optional(),
  series: z.string().max(128).optional(),
  sections: z.unknown().optional(),
  tags: z.array(z.string().max(64)).max(20).optional()
});
const updateContentSchema = createContentSchema.partial().omit({ type: true }).extend({
  status: contentStatusSchema.optional()
});
const likeTargetTypeSchema = z.enum([
  "project",
  "article",
  "blog",
  "comment",
  "post",
  "explainer"
]);
const commentTargetTypeSchema = z.enum([
  "project",
  "article",
  "blog",
  "explainer",
  "post",
  "lesson"
]);
const createCommentSchema = z.object({
  targetType: commentTargetTypeSchema,
  targetId: z.string().uuid(),
  parentId: z.string().uuid().optional(),
  content: z.string().min(1).max(1e4)
});
const hubTypeSchema = z.enum(["community", "product", "company"]);
const createHubSchema = z.object({
  name: z.string().min(1).max(128),
  description: z.string().max(2e3).optional(),
  rules: z.string().max(1e4).optional(),
  hubType: hubTypeSchema.default("community"),
  joinPolicy: z.enum(["open", "approval", "invite"]).default("open"),
  privacy: z.enum(["public", "unlisted", "private"]).default("public"),
  website: optionalUrl(512),
  categories: z.array(z.string().max(64)).max(20).optional(),
  parentHubId: z.string().uuid().optional()
});
const updateHubSchema = createHubSchema.partial();
const createPostSchema = z.object({
  hubId: z.string().uuid(),
  type: z.enum(["text", "link", "share", "poll"]).default("text"),
  content: z.string().min(1).max(1e4),
  sharedContentId: z.string().uuid().optional(),
  pollOptions: z.array(z.string().min(1).max(200)).min(2).max(10).optional(),
  pollMultiSelect: z.boolean().optional()
});
const createReplySchema = z.object({
  postId: z.string().uuid(),
  content: z.string().min(1).max(1e4),
  parentId: z.string().uuid().optional()
});
const createInviteSchema = z.object({
  maxUses: z.number().int().positive().optional(),
  expiresAt: z.string().datetime().optional()
});
const banUserSchema = z.object({
  userId: z.string().uuid(),
  reason: z.string().max(2e3).optional(),
  expiresAt: z.string().datetime().optional()
});
const changeRoleSchema = z.object({
  role: z.enum(["admin", "moderator", "member"])
});
const postTypeSchema = z.enum(["text", "link", "share", "poll"]);
const joinPolicySchema = z.enum(["open", "approval", "invite"]);
const hubPrivacySchema = z.enum(["public", "unlisted", "private"]);
const hubRoleSchema = z.enum(["owner", "admin", "moderator", "member"]);
const createProductSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(5e3).optional(),
  category: z.enum([
    "microcontroller",
    "sbc",
    "sensor",
    "actuator",
    "display",
    "communication",
    "power",
    "mechanical",
    "software",
    "tool",
    "other"
  ]).optional(),
  specs: z.record(z.string(), z.string()).optional(),
  imageUrl: optionalUrl(),
  purchaseUrl: optionalUrl(),
  datasheetUrl: optionalUrl(),
  pricing: z.object({
    min: z.number().min(0).optional(),
    max: z.number().min(0).optional(),
    currency: z.string().max(3).optional()
  }).optional(),
  status: z.enum(["active", "discontinued", "preview"]).default("active")
});
const updateProductSchema = createProductSchema.partial();
const addContentProductSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive().default(1),
  role: z.string().max(64).optional(),
  notes: z.string().max(500).optional(),
  required: z.boolean().default(true)
});
const productStatusSchema = z.enum(["active", "discontinued", "preview"]);
const productCategorySchema = z.enum([
  "microcontroller",
  "sbc",
  "sensor",
  "actuator",
  "display",
  "communication",
  "power",
  "mechanical",
  "software",
  "tool",
  "other"
]);
const createContestSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(1e4).optional(),
  rules: z.string().max(1e4).optional(),
  bannerUrl: optionalUrl(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  judgingEndDate: z.string().datetime().optional(),
  prizes: z.array(z.object({
    place: z.number().int().positive(),
    title: z.string().max(255),
    description: z.string().max(1e3).optional(),
    value: z.string().max(128).optional()
  })).optional(),
  judges: z.array(z.string().uuid()).optional()
});
const updateContestSchema = createContestSchema.partial();
const judgeEntrySchema = z.object({
  entryId: z.string().uuid(),
  score: z.number().int().min(0).max(100),
  feedback: z.string().max(2e3).optional()
});
const contestTransitionSchema = z.object({
  status: z.enum(["upcoming", "active", "judging", "completed"])
});
const contestStatusSchema = z.enum(["upcoming", "active", "judging", "completed"]);
const createVideoSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(5e3).optional(),
  url: z.string().url(),
  embedUrl: optionalUrl(),
  platform: z.enum(["youtube", "vimeo", "other"]).default("other"),
  thumbnailUrl: optionalUrl(),
  duration: z.string().max(16).optional()
});
const videoPlatformSchema = z.enum(["youtube", "vimeo", "other"]);
const createVideoCategorySchema = z.object({
  name: z.string().min(1).max(64),
  description: z.string().max(500).optional(),
  sortOrder: z.number().int().min(0).optional()
});
const createLearningPathSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(2e3).optional(),
  difficulty: difficultySchema.optional(),
  estimatedHours: z.number().positive().max(9999).optional(),
  coverImageUrl: optionalUrl()
});
const updateLearningPathSchema = createLearningPathSchema.partial();
const createModuleSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(2e3).optional()
});
const updateModuleSchema = createModuleSchema.partial();
const lessonTypeSchema = z.enum(["article", "video", "quiz", "project", "explainer"]);
const createLessonSchema = z.object({
  moduleId: z.string().uuid(),
  title: z.string().min(1).max(255),
  type: lessonTypeSchema,
  content: z.unknown().optional(),
  contentItemId: z.string().uuid().optional(),
  duration: z.number().int().positive().max(9999).optional()
});
const updateLessonSchema = createLessonSchema.partial().omit({ moduleId: true }).extend({
  contentItemId: z.string().uuid().nullable().optional()
});
const createConversationSchema = z.object({
  participants: z.array(z.string().uuid()).min(1).max(50)
});
const sendMessageSchema = z.object({
  body: z.string().min(1).max(1e4)
});
const createDocsSiteSchema = z.object({
  name: z.string().min(1).max(128),
  description: z.string().max(2e3).optional()
});
const updateDocsSiteSchema = createDocsSiteSchema.partial();
const createDocsPageSchema = z.object({
  versionId: z.string().uuid().optional(),
  title: z.string().min(1).max(255),
  slug: z.string().max(255).optional(),
  content: z.string().default(""),
  sortOrder: z.number().int().min(0).optional(),
  parentId: z.string().uuid().optional()
});
const updateDocsPageSchema = createDocsPageSchema.partial();
const createDocsVersionSchema = z.object({
  version: z.string().min(1).max(32),
  isDefault: z.boolean().optional(),
  copyFromVersionId: z.string().uuid().optional()
});
const createReportSchema = z.object({
  targetType: z.enum(["project", "article", "blog", "post", "comment", "user", "explainer"]),
  targetId: z.string().uuid(),
  reason: z.enum(["spam", "harassment", "inappropriate", "copyright", "other"]),
  description: z.string().max(2e3).optional()
});
const adminSettingSchema = z.object({
  key: z.string().min(1).max(128),
  value: z.unknown()
});
const adminUpdateRoleSchema = z.object({
  role: z.enum(["member", "pro", "verified", "staff", "admin"])
});
const adminUpdateStatusSchema = z.object({
  status: z.enum(["active", "suspended", "deleted"])
});
const resolveReportSchema = z.object({
  status: z.enum(["resolved", "dismissed"]),
  resolution: z.string().min(1).max(2e3)
});
const actorUriSchema = z.string().url().max(2048);
const activityDirectionSchema = z.enum(["inbound", "outbound"]);
const activityStatusSchema = z.enum(["pending", "delivered", "failed", "processed"]);
const followRelationshipStatusSchema = z.enum(["pending", "accepted", "rejected"]);
const createRemoteActorSchema = z.object({
  actorUri: actorUriSchema,
  inbox: z.string().url(),
  outbox: optionalUrl(),
  publicKeyPem: z.string().optional(),
  preferredUsername: z.string().max(64).optional(),
  displayName: z.string().max(128).optional(),
  avatarUrl: optionalUrl(),
  instanceDomain: z.string().min(1).max(255)
});
const createActivitySchema = z.object({
  type: z.string().min(1).max(64),
  actorUri: actorUriSchema,
  objectUri: actorUriSchema.optional(),
  payload: z.record(z.string(), z.unknown()),
  direction: activityDirectionSchema
});
const createFollowRelationshipSchema = z.object({
  followerActorUri: actorUriSchema,
  followingActorUri: actorUriSchema
});
const contentFiltersSchema = z.object({
  status: contentStatusSchema.optional(),
  type: contentTypeSchema.optional(),
  authorId: z.string().uuid().optional(),
  followedBy: z.string().uuid().optional(),
  featured: z.coerce.boolean().optional(),
  difficulty: difficultySchema.optional(),
  search: z.string().max(200).optional(),
  tag: z.string().max(64).optional(),
  sort: z.enum(["recent", "popular", "featured"]).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional()
});
const hubFiltersSchema = z.object({
  search: z.string().max(200).optional(),
  joinPolicy: joinPolicySchema.optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional()
});
const learningPathFiltersSchema = z.object({
  status: contentStatusSchema.optional(),
  difficulty: difficultySchema.optional(),
  authorId: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional()
});
const videoFiltersSchema = z.object({
  categoryId: z.string().uuid().optional(),
  authorId: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional()
});
const contestFiltersSchema = z.object({
  status: contestStatusSchema.optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional()
});
const hubPostFiltersSchema = z.object({
  hubId: z.string().uuid().optional(),
  type: postTypeSchema.optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional()
});

var _a$1;
function zodToOpenAPI(schema) {
  var _a2, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u;
  if (schema instanceof z.ZodString) {
    const result = { type: "string" };
    for (const check of (_c = (_b = (_a2 = schema._zod) == null ? void 0 : _a2.def) == null ? void 0 : _b.checks) != null ? _c : []) {
      if (check.kind === "min")
        result.minLength = check.value;
      if (check.kind === "max")
        result.maxLength = check.value;
      if (check.kind === "email")
        result.format = "email";
      if (check.kind === "url")
        result.format = "uri";
      if (check.kind === "uuid")
        result.format = "uuid";
      if (check.kind === "datetime")
        result.format = "date-time";
      if (check.kind === "regex")
        result.format = "pattern";
    }
    return result;
  }
  if (schema instanceof z.ZodNumber) {
    const result = { type: "number" };
    for (const check of (_f = (_e = (_d = schema._zod) == null ? void 0 : _d.def) == null ? void 0 : _e.checks) != null ? _f : []) {
      if (check.kind === "min")
        result.minimum = check.value;
      if (check.kind === "max")
        result.maximum = check.value;
      if (check.kind === "int")
        result.type = "integer";
    }
    return result;
  }
  if (schema instanceof z.ZodBoolean) {
    return { type: "boolean" };
  }
  if (schema instanceof z.ZodEnum) {
    const values = (_h = (_g = schema._zod) == null ? void 0 : _g.def) == null ? void 0 : _h.entries;
    return {
      type: "string",
      enum: values ? Object.values(values) : []
    };
  }
  if (schema instanceof z.ZodArray) {
    const inner = (_j = (_i = schema._zod) == null ? void 0 : _i.def) == null ? void 0 : _j.type;
    return {
      type: "array",
      items: inner ? zodToOpenAPI(inner) : {}
    };
  }
  if (schema instanceof z.ZodObject) {
    const shape = (_m = (_l = (_k = schema._zod) == null ? void 0 : _k.def) == null ? void 0 : _l.shape) != null ? _m : {};
    const properties = {};
    const required = [];
    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodToOpenAPI(value);
      if (!(value instanceof z.ZodOptional) && !(value instanceof z.ZodDefault)) {
        const isOptional = (_o = (_n = value == null ? void 0 : value._zod) == null ? void 0 : _n.def) == null ? void 0 : _o.optional;
        if (!isOptional) {
          required.push(key);
        }
      }
    }
    const result = { type: "object", properties };
    if (required.length > 0)
      result.required = required;
    return result;
  }
  if (schema instanceof z.ZodOptional) {
    const inner = (_q = (_p = schema._zod) == null ? void 0 : _p.def) == null ? void 0 : _q.innerType;
    return inner ? zodToOpenAPI(inner) : {};
  }
  if (schema instanceof z.ZodDefault) {
    const inner = (_s = (_r = schema._zod) == null ? void 0 : _r.def) == null ? void 0 : _s.innerType;
    const result = inner ? zodToOpenAPI(inner) : {};
    const defaultVal = (_u = (_t = schema._zod) == null ? void 0 : _t.def) == null ? void 0 : _u.defaultValue;
    if (defaultVal !== void 0)
      result.default = defaultVal;
    return result;
  }
  if (schema instanceof z.ZodRecord) {
    return { type: "object" };
  }
  if (schema instanceof z.ZodUnknown) {
    return {};
  }
  return {};
}
const schemaMap = {
  CreateUser: createUserSchema,
  UpdateProfile: updateProfileSchema,
  CreateContent: createContentSchema,
  UpdateContent: updateContentSchema,
  CreateComment: createCommentSchema,
  CreateHub: createHubSchema,
  UpdateHub: updateHubSchema,
  CreatePost: createPostSchema,
  CreateReply: createReplySchema,
  CreateInvite: createInviteSchema,
  BanUser: banUserSchema,
  ChangeRole: changeRoleSchema,
  CreateProduct: createProductSchema,
  UpdateProduct: updateProductSchema,
  AddContentProduct: addContentProductSchema,
  CreateContest: createContestSchema,
  UpdateContest: updateContestSchema,
  JudgeEntry: judgeEntrySchema,
  ContestTransition: contestTransitionSchema,
  CreateVideo: createVideoSchema,
  CreateVideoCategory: createVideoCategorySchema,
  CreateLearningPath: createLearningPathSchema,
  UpdateLearningPath: updateLearningPathSchema,
  CreateModule: createModuleSchema,
  UpdateModule: updateModuleSchema,
  CreateLesson: createLessonSchema,
  UpdateLesson: updateLessonSchema,
  CreateConversation: createConversationSchema,
  SendMessage: sendMessageSchema,
  CreateDocsSite: createDocsSiteSchema,
  UpdateDocsSite: updateDocsSiteSchema,
  CreateDocsPage: createDocsPageSchema,
  UpdateDocsPage: updateDocsPageSchema,
  CreateDocsVersion: createDocsVersionSchema,
  CreateReport: createReportSchema,
  AdminSetting: adminSettingSchema,
  AdminUpdateRole: adminUpdateRoleSchema,
  AdminUpdateStatus: adminUpdateStatusSchema,
  ResolveReport: resolveReportSchema
};
const endpoints = {
  "/api/content": {
    get: { summary: "List content", tags: ["Content"], responses: { "200": { description: "Content list" } } },
    post: { summary: "Create content", tags: ["Content"], security: [{ bearerAuth: [] }], requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/CreateContent" } } } }, responses: { "201": { description: "Created content" } } }
  },
  "/api/content/{id}": {
    get: { summary: "Get content by ID", tags: ["Content"], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }], responses: { "200": { description: "Content detail" } } },
    put: { summary: "Update content", tags: ["Content"], security: [{ bearerAuth: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }], requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/UpdateContent" } } } }, responses: { "200": { description: "Updated content" } } },
    delete: { summary: "Delete content", tags: ["Content"], security: [{ bearerAuth: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }], responses: { "200": { description: "Deleted" } } }
  },
  "/api/content/{id}/publish": {
    post: { summary: "Publish content", tags: ["Content"], security: [{ bearerAuth: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }], responses: { "200": { description: "Published" } } }
  },
  "/api/content/{id}/report": {
    post: { summary: "Report content", tags: ["Content", "Social"], security: [{ bearerAuth: [] }], requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/CreateReport" } } } }, responses: { "200": { description: "Reported" } } }
  },
  "/api/content/{id}/products": {
    get: { summary: "List content products (BOM)", tags: ["Content", "Products"], responses: { "200": { description: "Product list" } } },
    post: { summary: "Add product to BOM", tags: ["Content", "Products"], security: [{ bearerAuth: [] }], requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/AddContentProduct" } } } }, responses: { "200": { description: "Added" } } }
  },
  "/api/hubs": {
    get: { summary: "List hubs", tags: ["Hubs"], responses: { "200": { description: "Hub list" } } },
    post: { summary: "Create hub", tags: ["Hubs"], security: [{ bearerAuth: [] }], requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/CreateHub" } } } }, responses: { "201": { description: "Created hub" } } }
  },
  "/api/hubs/{slug}": {
    get: { summary: "Get hub by slug", tags: ["Hubs"], parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Hub detail" } } },
    put: { summary: "Update hub", tags: ["Hubs"], security: [{ bearerAuth: [] }], requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/UpdateHub" } } } }, responses: { "200": { description: "Updated" } } }
  },
  "/api/hubs/{slug}/products": {
    get: { summary: "List hub products", tags: ["Hubs", "Products"], responses: { "200": { description: "Product list" } } },
    post: { summary: "Add product to hub", tags: ["Hubs", "Products"], security: [{ bearerAuth: [] }], requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/CreateProduct" } } } }, responses: { "201": { description: "Created product" } } }
  },
  "/api/products/{slug}": {
    get: { summary: "Get product by slug", tags: ["Products"], responses: { "200": { description: "Product detail" } } }
  },
  "/api/products/{id}": {
    put: { summary: "Update product", tags: ["Products"], security: [{ bearerAuth: [] }], requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/UpdateProduct" } } } }, responses: { "200": { description: "Updated" } } },
    delete: { summary: "Delete product", tags: ["Products"], security: [{ bearerAuth: [] }], responses: { "200": { description: "Deleted" } } }
  },
  "/api/contests": {
    get: { summary: "List contests", tags: ["Contests"], responses: { "200": { description: "Contest list" } } },
    post: { summary: "Create contest", tags: ["Contests"], security: [{ bearerAuth: [] }], requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/CreateContest" } } } }, responses: { "201": { description: "Created" } } }
  },
  "/api/learn": {
    get: { summary: "List learning paths", tags: ["Learning"], responses: { "200": { description: "Path list" } } },
    post: { summary: "Create learning path", tags: ["Learning"], security: [{ bearerAuth: [] }], requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/CreateLearningPath" } } } }, responses: { "201": { description: "Created" } } }
  },
  "/api/videos": {
    get: { summary: "List videos", tags: ["Videos"], responses: { "200": { description: "Video list" } } },
    post: { summary: "Create video", tags: ["Videos"], security: [{ bearerAuth: [] }], requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/CreateVideo" } } } }, responses: { "201": { description: "Created" } } }
  },
  "/api/videos/categories": {
    get: { summary: "List video categories", tags: ["Videos"], responses: { "200": { description: "Category list" } } },
    post: { summary: "Create video category (admin)", tags: ["Videos", "Admin"], security: [{ bearerAuth: [] }], requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/CreateVideoCategory" } } } }, responses: { "201": { description: "Created" } } }
  },
  "/api/videos/categories/{id}": {
    put: { summary: "Update video category (admin)", tags: ["Videos", "Admin"], security: [{ bearerAuth: [] }], responses: { "200": { description: "Updated" } } },
    delete: { summary: "Delete video category (admin)", tags: ["Videos", "Admin"], security: [{ bearerAuth: [] }], responses: { "200": { description: "Deleted" } } }
  },
  "/api/messages": {
    get: { summary: "List conversations", tags: ["Messaging"], security: [{ bearerAuth: [] }], responses: { "200": { description: "Conversation list" } } },
    post: { summary: "Create conversation", tags: ["Messaging"], security: [{ bearerAuth: [] }], requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/CreateConversation" } } } }, responses: { "201": { description: "Created" } } }
  },
  "/api/messages/{conversationId}": {
    get: { summary: "Get messages", tags: ["Messaging"], security: [{ bearerAuth: [] }], responses: { "200": { description: "Message list" } } },
    post: { summary: "Send message", tags: ["Messaging"], security: [{ bearerAuth: [] }], requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/SendMessage" } } } }, responses: { "200": { description: "Sent" } } }
  },
  "/api/messages/{conversationId}/stream": {
    get: { summary: "Real-time message stream (SSE)", tags: ["Messaging"], security: [{ bearerAuth: [] }], responses: { "200": { description: "SSE event stream" } } }
  },
  "/api/social/like": {
    get: { summary: "Check like status", tags: ["Social"], security: [{ bearerAuth: [] }], responses: { "200": { description: "Like status" } } },
    post: { summary: "Toggle like", tags: ["Social"], security: [{ bearerAuth: [] }], responses: { "200": { description: "Toggled" } } }
  },
  "/api/social/comments": {
    get: { summary: "List comments", tags: ["Social"], responses: { "200": { description: "Comment list" } } },
    post: { summary: "Create comment", tags: ["Social"], security: [{ bearerAuth: [] }], requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/CreateComment" } } } }, responses: { "201": { description: "Created" } } }
  },
  "/api/social/bookmark": {
    post: { summary: "Toggle bookmark", tags: ["Social"], security: [{ bearerAuth: [] }], responses: { "200": { description: "Toggled" } } }
  },
  "/api/social/bookmarks": {
    get: { summary: "List bookmarks", tags: ["Social"], security: [{ bearerAuth: [] }], responses: { "200": { description: "Bookmark list" } } }
  },
  "/api/users/{username}": {
    get: { summary: "Get user profile", tags: ["Users"], responses: { "200": { description: "User profile" } } }
  },
  "/api/users/{username}/follow": {
    post: { summary: "Follow user", tags: ["Users", "Social"], security: [{ bearerAuth: [] }], responses: { "200": { description: "Followed" } } },
    delete: { summary: "Unfollow user", tags: ["Users", "Social"], security: [{ bearerAuth: [] }], responses: { "200": { description: "Unfollowed" } } }
  },
  "/api/profile": {
    get: { summary: "Get own profile", tags: ["Profile"], security: [{ bearerAuth: [] }], responses: { "200": { description: "Profile" } } },
    put: { summary: "Update own profile", tags: ["Profile"], security: [{ bearerAuth: [] }], requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/UpdateProfile" } } } }, responses: { "200": { description: "Updated" } } }
  },
  "/api/files/upload": {
    post: { summary: "Upload file", tags: ["Files"], security: [{ bearerAuth: [] }], responses: { "200": { description: "Upload result" } } }
  },
  "/api/files/mine": {
    get: { summary: "List my files", tags: ["Files"], security: [{ bearerAuth: [] }], responses: { "200": { description: "File list" } } }
  },
  "/api/notifications/stream": {
    get: { summary: "Notification stream (SSE)", tags: ["Notifications"], security: [{ bearerAuth: [] }], responses: { "200": { description: "SSE stream" } } }
  },
  "/api/search": {
    get: { summary: "Global search", tags: ["Search"], parameters: [{ name: "q", in: "query", required: false, schema: { type: "string" } }, { name: "type", in: "query", required: false, schema: { type: "string" } }, { name: "limit", in: "query", required: false, schema: { type: "integer" } }, { name: "offset", in: "query", required: false, schema: { type: "integer" } }], responses: { "200": { description: "Search results" } } }
  },
  "/api/health": {
    get: { summary: "Health check", tags: ["System"], responses: { "200": { description: "OK" } } }
  },
  "/api/docs/{siteSlug}": {
    get: { summary: "Get docs site", tags: ["Docs"], responses: { "200": { description: "Docs site" } } },
    put: { summary: "Update docs site", tags: ["Docs"], security: [{ bearerAuth: [] }], requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/UpdateDocsSite" } } } }, responses: { "200": { description: "Updated" } } }
  },
  "/api/admin/users": {
    get: { summary: "List users (admin)", tags: ["Admin"], security: [{ bearerAuth: [] }], responses: { "200": { description: "User list" } } }
  },
  "/api/admin/stats": {
    get: { summary: "Instance stats (admin)", tags: ["Admin"], security: [{ bearerAuth: [] }], responses: { "200": { description: "Stats" } } }
  },
  "/api/admin/settings": {
    get: { summary: "Get settings (admin)", tags: ["Admin"], security: [{ bearerAuth: [] }], responses: { "200": { description: "Settings" } } },
    put: { summary: "Update settings (admin)", tags: ["Admin"], security: [{ bearerAuth: [] }], requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/AdminSetting" } } } }, responses: { "200": { description: "Updated" } } }
  }
};
function generateOpenAPISpec() {
  const schemas = {};
  for (const [name, zodSchema] of Object.entries(schemaMap)) {
    schemas[name] = zodToOpenAPI(zodSchema);
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "CommonPub API",
      description: "Open ActivityPub federation protocol for self-hosted maker communities.",
      version: "1.0.0",
      license: { name: "MIT", identifier: "MIT" }
    },
    servers: [
      { url: "http://localhost:3000", description: "Local development" }
    ],
    tags: [
      { name: "Content", description: "Content CRUD (projects, articles, blogs, explainers)" },
      { name: "Hubs", description: "Community, product, and company hubs" },
      { name: "Products", description: "Product catalog and BOM management" },
      { name: "Contests", description: "Contest management and judging" },
      { name: "Learning", description: "Learning paths, modules, and lessons" },
      { name: "Videos", description: "Video content and categories" },
      { name: "Messaging", description: "Direct messaging with real-time SSE" },
      { name: "Social", description: "Likes, comments, bookmarks, follows" },
      { name: "Users", description: "User profiles and discovery" },
      { name: "Profile", description: "Authenticated user profile management" },
      { name: "Files", description: "File upload and management" },
      { name: "Notifications", description: "Notification management and real-time stream" },
      { name: "Search", description: "Global search across content types" },
      { name: "Docs", description: "Documentation sites" },
      { name: "Admin", description: "Instance administration" },
      { name: "System", description: "Health checks and system info" }
    ],
    paths: endpoints,
    components: {
      schemas,
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "session",
          description: "Better Auth session cookie or bearer token"
        }
      }
    }
  };
}
if (typeof process !== "undefined" && ((_a$1 = process.argv[1]) == null ? void 0 : _a$1.endsWith("openapi.ts"))) {
  const spec = generateOpenAPISpec();
  console.log(JSON.stringify(spec, null, 2));
}

const schema = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  accounts: accounts,
  accountsRelations: accountsRelations,
  activities: activities,
  activityDirectionEnum: activityDirectionEnum,
  activityDirectionSchema: activityDirectionSchema,
  activityStatusEnum: activityStatusEnum,
  activityStatusSchema: activityStatusSchema,
  actorKeypairs: actorKeypairs,
  actorKeypairsRelations: actorKeypairsRelations,
  actorUriSchema: actorUriSchema,
  addContentProductSchema: addContentProductSchema,
  adminSettingSchema: adminSettingSchema,
  adminUpdateRoleSchema: adminUpdateRoleSchema,
  adminUpdateStatusSchema: adminUpdateStatusSchema,
  auditLogs: auditLogs,
  auditLogsRelations: auditLogsRelations,
  banUserSchema: banUserSchema,
  bioSchema: bioSchema,
  bookmarkTargetTypeEnum: bookmarkTargetTypeEnum,
  bookmarks: bookmarks,
  bookmarksRelations: bookmarksRelations,
  certificates: certificates,
  certificatesRelations: certificatesRelations,
  changeRoleSchema: changeRoleSchema,
  commentTargetTypeEnum: commentTargetTypeEnum,
  commentTargetTypeSchema: commentTargetTypeSchema,
  comments: comments,
  commentsRelations: commentsRelations,
  contentBuilds: contentBuilds,
  contentFiltersSchema: contentFiltersSchema,
  contentForks: contentForks,
  contentForksRelations: contentForksRelations,
  contentItems: contentItems,
  contentItemsRelations: contentItemsRelations,
  contentProducts: contentProducts,
  contentProductsRelations: contentProductsRelations,
  contentStatusEnum: contentStatusEnum,
  contentStatusSchema: contentStatusSchema,
  contentTags: contentTags,
  contentTagsRelations: contentTagsRelations,
  contentTypeEnum: contentTypeEnum,
  contentTypeSchema: contentTypeSchema,
  contentVersions: contentVersions,
  contentVersionsRelations: contentVersionsRelations,
  contentVisibilityEnum: contentVisibilityEnum,
  contestEntries: contestEntries,
  contestEntriesRelations: contestEntriesRelations,
  contestFiltersSchema: contestFiltersSchema,
  contestStatusEnum: contestStatusEnum,
  contestStatusSchema: contestStatusSchema,
  contestTransitionSchema: contestTransitionSchema,
  contests: contests,
  contestsRelations: contestsRelations,
  conversations: conversations,
  conversationsRelations: conversationsRelations,
  createActivitySchema: createActivitySchema,
  createCommentSchema: createCommentSchema,
  createContentSchema: createContentSchema,
  createContestSchema: createContestSchema,
  createConversationSchema: createConversationSchema,
  createDocsPageSchema: createDocsPageSchema,
  createDocsSiteSchema: createDocsSiteSchema,
  createDocsVersionSchema: createDocsVersionSchema,
  createFollowRelationshipSchema: createFollowRelationshipSchema,
  createHubSchema: createHubSchema,
  createInviteSchema: createInviteSchema,
  createLearningPathSchema: createLearningPathSchema,
  createLessonSchema: createLessonSchema,
  createModuleSchema: createModuleSchema,
  createPostSchema: createPostSchema,
  createProductSchema: createProductSchema,
  createRemoteActorSchema: createRemoteActorSchema,
  createReplySchema: createReplySchema,
  createReportSchema: createReportSchema,
  createUserSchema: createUserSchema,
  createVideoCategorySchema: createVideoCategorySchema,
  createVideoSchema: createVideoSchema,
  difficultyEnum: difficultyEnum,
  difficultySchema: difficultySchema,
  displayNameSchema: displayNameSchema,
  docsNav: docsNav,
  docsNavRelations: docsNavRelations,
  docsPages: docsPages,
  docsPagesRelations: docsPagesRelations,
  docsSites: docsSites,
  docsSitesRelations: docsSitesRelations,
  docsVersions: docsVersions,
  docsVersionsRelations: docsVersionsRelations,
  emailSchema: emailSchema,
  enrollments: enrollments,
  enrollmentsRelations: enrollmentsRelations,
  federatedAccounts: federatedAccounts,
  federatedAccountsRelations: federatedAccountsRelations,
  filePurposeEnum: filePurposeEnum,
  files: files,
  filesRelations: filesRelations,
  followRelationshipStatusEnum: followRelationshipStatusEnum,
  followRelationshipStatusSchema: followRelationshipStatusSchema,
  followRelationships: followRelationships,
  follows: follows,
  followsRelations: followsRelations,
  generateOpenAPISpec: generateOpenAPISpec,
  hubBans: hubBans,
  hubBansRelations: hubBansRelations,
  hubFiltersSchema: hubFiltersSchema,
  hubInvites: hubInvites,
  hubInvitesRelations: hubInvitesRelations,
  hubJoinPolicyEnum: hubJoinPolicyEnum,
  hubMemberStatusEnum: hubMemberStatusEnum,
  hubMembers: hubMembers,
  hubMembersRelations: hubMembersRelations,
  hubPostFiltersSchema: hubPostFiltersSchema,
  hubPostReplies: hubPostReplies,
  hubPostRepliesRelations: hubPostRepliesRelations,
  hubPosts: hubPosts,
  hubPostsRelations: hubPostsRelations,
  hubPrivacyEnum: hubPrivacyEnum,
  hubPrivacySchema: hubPrivacySchema,
  hubRoleEnum: hubRoleEnum,
  hubRoleSchema: hubRoleSchema,
  hubShares: hubShares,
  hubSharesRelations: hubSharesRelations,
  hubTypeEnum: hubTypeEnum,
  hubTypeSchema: hubTypeSchema,
  hubs: hubs,
  hubsRelations: hubsRelations,
  instanceSettings: instanceSettings,
  instanceSettingsRelations: instanceSettingsRelations,
  joinPolicySchema: joinPolicySchema,
  judgeEntrySchema: judgeEntrySchema,
  learningLessons: learningLessons,
  learningLessonsRelations: learningLessonsRelations,
  learningModules: learningModules,
  learningModulesRelations: learningModulesRelations,
  learningPathFiltersSchema: learningPathFiltersSchema,
  learningPaths: learningPaths,
  learningPathsRelations: learningPathsRelations,
  lessonProgress: lessonProgress,
  lessonProgressRelations: lessonProgressRelations,
  lessonTypeEnum: lessonTypeEnum,
  lessonTypeSchema: lessonTypeSchema,
  likeTargetTypeEnum: likeTargetTypeEnum,
  likeTargetTypeSchema: likeTargetTypeSchema,
  likes: likes,
  likesRelations: likesRelations,
  members: members,
  membersRelations: membersRelations,
  messages: messages,
  messagesRelations: messagesRelations,
  notificationTypeEnum: notificationTypeEnum,
  notifications: notifications,
  notificationsRelations: notificationsRelations,
  oauthClients: oauthClients,
  oauthCodes: oauthCodes,
  organizations: organizations,
  organizationsRelations: organizationsRelations,
  postTypeEnum: postTypeEnum,
  postTypeSchema: postTypeSchema,
  productCategoryEnum: productCategoryEnum,
  productCategorySchema: productCategorySchema,
  productStatusEnum: productStatusEnum,
  productStatusSchema: productStatusSchema,
  products: products,
  productsRelations: productsRelations,
  profileVisibilityEnum: profileVisibilityEnum,
  remoteActors: remoteActors,
  reportReasonEnum: reportReasonEnum,
  reportStatusEnum: reportStatusEnum,
  reportTargetTypeEnum: reportTargetTypeEnum,
  reports: reports,
  reportsRelations: reportsRelations,
  resolveReportSchema: resolveReportSchema,
  sendMessageSchema: sendMessageSchema,
  sessions: sessions,
  sessionsRelations: sessionsRelations,
  slugSchema: slugSchema,
  socialLinksSchema: socialLinksSchema,
  tagCategoryEnum: tagCategoryEnum,
  tags: tags,
  tagsRelations: tagsRelations,
  updateContentSchema: updateContentSchema,
  updateContestSchema: updateContestSchema,
  updateDocsPageSchema: updateDocsPageSchema,
  updateDocsSiteSchema: updateDocsSiteSchema,
  updateHubSchema: updateHubSchema,
  updateLearningPathSchema: updateLearningPathSchema,
  updateLessonSchema: updateLessonSchema,
  updateModuleSchema: updateModuleSchema,
  updateProductSchema: updateProductSchema,
  updateProfileSchema: updateProfileSchema,
  userRoleEnum: userRoleEnum,
  userStatusEnum: userStatusEnum,
  usernameSchema: usernameSchema,
  users: users,
  usersRelations: usersRelations,
  verifications: verifications,
  videoCategories: videoCategories,
  videoFiltersSchema: videoFiltersSchema,
  videoPlatformEnum: videoPlatformEnum,
  videoPlatformSchema: videoPlatformSchema,
  videos: videos,
  videosRelations: videosRelations
}, Symbol.toStringTag, { value: 'Module' }));

let db = null;
function useDB() {
  if (db) return db;
  const config = useRuntimeConfig();
  const databaseUrl = config.databaseUrl;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured. Set NUXT_DATABASE_URL environment variable.");
  }
  const pool = new pg.Pool({ connectionString: databaseUrl });
  db = drizzle(pool, { schema });
  return db;
}

function createAuth({ config, db, secret, baseURL, emailSender }) {
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
      enabled: config.auth.emailPassword,
      sendResetPassword: (emailSender == null ? void 0 : emailSender.sendResetPasswordEmail) ? async ({ user, url, token }) => {
        await emailSender.sendResetPasswordEmail(user.email, url, token);
      } : void 0
    },
    emailVerification: (emailSender == null ? void 0 : emailSender.sendVerificationEmail) ? {
      sendVerificationEmail: async ({ user, url, token }) => {
        await emailSender.sendVerificationEmail(user.email, url, token);
      },
      sendOnSignUp: true
    } : void 0,
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

function generateSlug(text) {
  return text.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100);
}
const ROLE_HIERARCHY = {
  owner: 4,
  admin: 3,
  moderator: 2,
  member: 1
};
const PERMISSION_MAP = {
  editHub: 3,
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

const USER_REF_SELECT = {
  id: users.id,
  username: users.username,
  displayName: users.displayName,
  avatarUrl: users.avatarUrl
};
const USER_REF_WITH_BIO_SELECT = {
  ...USER_REF_SELECT,
  bio: users.bio
};
const USER_REF_WITH_HEADLINE_SELECT = {
  ...USER_REF_SELECT,
  bio: users.bio,
  headline: users.headline
};
async function ensureUniqueSlugFor(db, table, slugCol, idCol, slug, fallbackPrefix, excludeId) {
  if (!slug)
    slug = `${fallbackPrefix}-${Date.now()}`;
  const conditions = [eq(slugCol, slug)];
  if (excludeId) {
    conditions.push(ne(idCol, excludeId));
  }
  const existing = await db.select({ id: idCol }).from(table).where(and(...conditions)).limit(1);
  if (existing.length === 0)
    return slug;
  return `${slug}-${Date.now()}`;
}
function normalizePagination(opts) {
  var _a, _b;
  return {
    limit: Math.min((_a = opts.limit) != null ? _a : 20, 100),
    offset: (_b = opts.offset) != null ? _b : 0
  };
}
async function countRows(db, table, where) {
  var _a, _b;
  const result = await db.select({ count: sql`count(*)::int` }).from(table).where(where);
  return (_b = (_a = result[0]) == null ? void 0 : _a.count) != null ? _b : 0;
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
        communities: config.features.hubs,
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

async function sanitizeBlockContent(content) {
  var _a;
  if (!Array.isArray(content))
    return content;
  const blocks = content;
  const hasHtml = blocks.some(([, data]) => typeof data.html === "string" && data.html);
  if (!hasHtml)
    return content;
  let sanitize;
  try {
    const mod = await import('isomorphic-dompurify');
    const DOMPurify = (_a = mod.default) != null ? _a : mod;
    sanitize = (html) => DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ["p", "br", "strong", "em", "b", "i", "u", "s", "code", "a", "ul", "ol", "li", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6", "pre", "span", "sub", "sup"],
      ALLOWED_ATTR: ["href", "target", "rel", "class"]
    });
  } catch (err) {
    console.error("[sanitize] DOMPurify unavailable, stripping HTML tags:", err instanceof Error ? err.message : err);
    return blocks.map(([type, data]) => {
      const cleaned = { ...data };
      if (typeof cleaned.html === "string" && cleaned.html) {
        cleaned.html = cleaned.html.replace(/<[^>]*>/g, "");
      }
      return [type, cleaned];
    });
  }
  return blocks.map(([type, data]) => {
    const sanitized = { ...data };
    if (typeof sanitized.html === "string" && sanitized.html) {
      sanitized.html = sanitize(sanitized.html);
    }
    return [type, sanitized];
  });
}
function mapToListItem(item, author) {
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
    buildCount: item.buildCount,
    publishedAt: item.publishedAt,
    createdAt: item.createdAt,
    author
  };
}
async function listContent(db, filters = {}) {
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
  if (filters.followedBy) {
    conditions.push(inArray(contentItems.authorId, db.select({ id: follows.followingId }).from(follows).where(eq(follows.followerId, filters.followedBy))));
  }
  if (filters.tag) {
    conditions.push(sql`${contentItems.id} IN (
        SELECT ${contentTags.contentId} FROM ${contentTags}
        INNER JOIN ${tags} ON ${tags.id} = ${contentTags.tagId}
        WHERE ${tags.slug} = ${filters.tag}
      )`);
  }
  const where = conditions.length > 0 ? and(...conditions) : void 0;
  const { limit, offset } = normalizePagination(filters);
  const [rows, total] = await Promise.all([
    db.select({
      content: contentItems,
      author: USER_REF_SELECT
    }).from(contentItems).innerJoin(users, eq(contentItems.authorId, users.id)).where(where).orderBy(...filters.sort === "popular" ? [desc(contentItems.viewCount)] : filters.sort === "featured" ? [desc(contentItems.isFeatured), desc(contentItems.createdAt)] : [desc(contentItems.publishedAt), desc(contentItems.createdAt)]).limit(limit).offset(offset),
    countRows(db, contentItems, where)
  ]);
  const items = rows.map((row) => mapToListItem(row.content, row.author));
  return { items, total };
}
async function getContentBySlug(db, slug, requesterId) {
  var _a, _b, _c, _d, _e, _f;
  const rows = await db.select({
    content: contentItems,
    author: USER_REF_WITH_HEADLINE_SELECT
  }).from(contentItems).innerJoin(users, eq(contentItems.authorId, users.id)).where(eq(contentItems.slug, slug)).limit(1);
  if (rows.length === 0)
    return null;
  const row = rows[0];
  const item = row.content;
  if (item.status !== "published" && item.authorId !== requesterId) {
    return null;
  }
  const [itemTags, followerCountResult, articleCountResult, totalViewsResult, relatedRows] = await Promise.all([
    db.select({ id: tags.id, name: tags.name, slug: tags.slug }).from(contentTags).innerJoin(tags, eq(contentTags.tagId, tags.id)).where(eq(contentTags.contentId, item.id)),
    db.select({ count: sql`count(*)::int` }).from(follows).where(eq(follows.followingId, row.author.id)),
    db.select({ count: sql`count(*)::int` }).from(contentItems).where(and(eq(contentItems.authorId, row.author.id), eq(contentItems.status, "published"))),
    db.select({ total: sql`coalesce(sum(${contentItems.viewCount}), 0)::int` }).from(contentItems).where(eq(contentItems.authorId, row.author.id)),
    db.select({
      id: contentItems.id,
      type: contentItems.type,
      slug: contentItems.slug,
      title: contentItems.title,
      viewCount: contentItems.viewCount,
      coverImageUrl: contentItems.coverImageUrl
    }).from(contentItems).where(and(eq(contentItems.type, item.type), eq(contentItems.status, "published"), sql`${contentItems.id} != ${item.id}`)).orderBy(desc(contentItems.publishedAt)).limit(3)
  ]);
  const enrichedAuthor = {
    ...row.author,
    followerCount: (_b = (_a = followerCountResult[0]) == null ? void 0 : _a.count) != null ? _b : 0,
    articleCount: (_d = (_c = articleCountResult[0]) == null ? void 0 : _c.count) != null ? _d : 0,
    totalViews: (_f = (_e = totalViewsResult[0]) == null ? void 0 : _e.total) != null ? _f : 0
  };
  return {
    ...mapToListItem(item, enrichedAuthor),
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
    tags: itemTags,
    author: enrichedAuthor,
    related: relatedRows
  };
}
async function createContent(db, authorId, input) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l;
  const slug = await ensureUniqueSlugFor(db, contentItems, contentItems.slug, contentItems.id, generateSlug(input.title), "untitled");
  const previewToken = crypto.randomUUID().replace(/-/g, "");
  const [item] = await db.insert(contentItems).values({
    authorId,
    type: input.type,
    title: input.title,
    slug,
    subtitle: (_a = input.subtitle) != null ? _a : null,
    description: (_b = input.description) != null ? _b : null,
    content: (_c = await sanitizeBlockContent(input.content)) != null ? _c : null,
    coverImageUrl: (_d = input.coverImageUrl) != null ? _d : null,
    category: (_e = input.category) != null ? _e : null,
    difficulty: (_f = input.difficulty) != null ? _f : null,
    buildTime: (_g = input.buildTime) != null ? _g : null,
    estimatedCost: (_h = input.estimatedCost) != null ? _h : null,
    visibility: (_i = input.visibility) != null ? _i : "public",
    seoDescription: (_j = input.seoDescription) != null ? _j : null,
    sections: (_k = input.sections) != null ? _k : null,
    status: "draft",
    previewToken
  }).returning();
  if ((_l = input.tags) == null ? void 0 : _l.length) {
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
      updates.slug = await ensureUniqueSlugFor(db, contentItems, contentItems.slug, contentItems.id, generateSlug(input.title), "untitled", contentId);
    }
  }
  if (input.subtitle !== void 0)
    updates.subtitle = input.subtitle;
  if (input.description !== void 0)
    updates.description = input.description;
  if (input.content !== void 0)
    updates.content = await sanitizeBlockContent(input.content);
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
  if (input.buildTime !== void 0)
    updates.buildTime = input.buildTime;
  if (input.estimatedCost !== void 0)
    updates.estimatedCost = input.estimatedCost;
  if (input.visibility !== void 0)
    updates.visibility = input.visibility;
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
  await createContentVersion(db, contentId, authorId);
  return updateContent(db, contentId, authorId, { status: "published" });
}
async function createContentVersion(db, contentId, userId) {
  var _a;
  const content = await db.select().from(contentItems).where(eq(contentItems.id, contentId)).limit(1);
  if (content.length === 0)
    throw new Error("Content not found");
  const item = content[0];
  const [lastVersion] = await db.select({ version: contentVersions.version }).from(contentVersions).where(eq(contentVersions.contentId, contentId)).orderBy(desc(contentVersions.version)).limit(1);
  const nextVersion = ((_a = lastVersion == null ? void 0 : lastVersion.version) != null ? _a : 0) + 1;
  const [row] = await db.insert(contentVersions).values({
    contentId,
    version: nextVersion,
    title: item.title,
    content: item.content,
    metadata: {
      subtitle: item.subtitle,
      description: item.description,
      category: item.category,
      difficulty: item.difficulty,
      buildTime: item.buildTime,
      estimatedCost: item.estimatedCost,
      coverImageUrl: item.coverImageUrl,
      parts: item.parts,
      sections: item.sections
    },
    createdById: userId
  }).returning({ id: contentVersions.id, version: contentVersions.version });
  return { id: row.id, version: row.version };
}
async function listContentVersions(db, contentId) {
  const rows = await db.select({
    version: contentVersions,
    user: {
      id: users.id,
      username: users.username,
      displayName: users.displayName
    }
  }).from(contentVersions).innerJoin(users, eq(contentVersions.createdById, users.id)).where(eq(contentVersions.contentId, contentId)).orderBy(desc(contentVersions.version));
  return rows.map((row) => ({
    id: row.version.id,
    version: row.version.version,
    title: row.version.title,
    createdAt: row.version.createdAt,
    createdBy: row.user
  }));
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
async function toggleBuildMark(db, contentId, userId) {
  return db.transaction(async (tx) => {
    var _a, _b;
    const existing = await tx.select().from(contentBuilds).where(and(eq(contentBuilds.contentId, contentId), eq(contentBuilds.userId, userId))).limit(1);
    if (existing.length > 0) {
      await tx.delete(contentBuilds).where(and(eq(contentBuilds.contentId, contentId), eq(contentBuilds.userId, userId)));
      const [updated2] = await tx.update(contentItems).set({ buildCount: sql`GREATEST(${contentItems.buildCount} - 1, 0)` }).where(eq(contentItems.id, contentId)).returning({ buildCount: contentItems.buildCount });
      return { marked: false, count: (_a = updated2 == null ? void 0 : updated2.buildCount) != null ? _a : 0 };
    }
    await tx.insert(contentBuilds).values({ contentId, userId });
    const [updated] = await tx.update(contentItems).set({ buildCount: sql`${contentItems.buildCount} + 1` }).where(eq(contentItems.id, contentId)).returning({ buildCount: contentItems.buildCount });
    return { marked: true, count: (_b = updated == null ? void 0 : updated.buildCount) != null ? _b : 0 };
  });
}
async function forkContent(db, sourceId, userId) {
  const source = await db.select().from(contentItems).where(eq(contentItems.id, sourceId)).limit(1);
  if (source.length === 0) {
    throw new Error("Source content not found");
  }
  const item = source[0];
  const slug = await ensureUniqueSlugFor(db, contentItems, contentItems.slug, contentItems.id, `${item.slug}-fork-${Date.now()}`, "fork");
  const previewToken = crypto.randomUUID().replace(/-/g, "");
  const [forked] = await db.insert(contentItems).values({
    authorId: userId,
    type: item.type,
    title: `${item.title} (Fork)`,
    slug,
    subtitle: item.subtitle,
    description: item.description,
    content: item.content,
    coverImageUrl: item.coverImageUrl,
    category: item.category,
    difficulty: item.difficulty,
    buildTime: item.buildTime,
    estimatedCost: item.estimatedCost,
    visibility: "public",
    seoDescription: item.seoDescription,
    sections: item.sections,
    parts: item.parts,
    status: "draft",
    previewToken
  }).returning();
  await db.insert(contentForks).values({
    sourceId,
    forkId: forked.id
  });
  await db.update(contentItems).set({ forkCount: sql`${contentItems.forkCount} + 1` }).where(eq(contentItems.id, sourceId));
  return await getContentBySlug(db, forked.slug, userId);
}
async function onContentPublished(db, contentId, config) {
  if (!config.features.federation)
    return;
  await federateContent(db, contentId, config.instance.domain).catch((err) => {
    console.error("[federation]", err);
  });
}

async function listHubs(db, filters = {}) {
  const conditions = [];
  if (filters.search) {
    conditions.push(ilike(hubs.name, `%${filters.search}%`));
  }
  if (filters.joinPolicy) {
    conditions.push(eq(hubs.joinPolicy, filters.joinPolicy));
  }
  const where = conditions.length > 0 ? and(...conditions) : void 0;
  const { limit, offset } = normalizePagination(filters);
  const [rows, total] = await Promise.all([
    db.select({
      hub: hubs,
      createdBy: USER_REF_SELECT
    }).from(hubs).innerJoin(users, eq(hubs.createdById, users.id)).where(where).orderBy(desc(hubs.createdAt)).limit(limit).offset(offset),
    countRows(db, hubs, where)
  ]);
  const items = rows.map((row) => ({
    id: row.hub.id,
    name: row.hub.name,
    slug: row.hub.slug,
    description: row.hub.description,
    hubType: row.hub.hubType,
    iconUrl: row.hub.iconUrl,
    bannerUrl: row.hub.bannerUrl,
    joinPolicy: row.hub.joinPolicy,
    isOfficial: row.hub.isOfficial,
    memberCount: row.hub.memberCount,
    postCount: row.hub.postCount,
    createdAt: row.hub.createdAt,
    createdBy: row.createdBy
  }));
  return { items, total };
}
async function getHubBySlug(db, slug, requesterId) {
  var _a, _b;
  const rows = await db.select({
    hub: hubs,
    createdBy: {
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl
    }
  }).from(hubs).innerJoin(users, eq(hubs.createdById, users.id)).where(eq(hubs.slug, slug)).limit(1);
  if (rows.length === 0)
    return null;
  const row = rows[0];
  let currentUserRole = null;
  let isBanned = false;
  if (requesterId) {
    const [memberRows, banResult] = await Promise.all([
      db.select({ role: hubMembers.role }).from(hubMembers).where(and(eq(hubMembers.hubId, row.hub.id), eq(hubMembers.userId, requesterId))).limit(1),
      checkBan(db, row.hub.id, requesterId)
    ]);
    currentUserRole = (_b = (_a = memberRows[0]) == null ? void 0 : _a.role) != null ? _b : null;
    isBanned = banResult !== null;
  }
  return {
    id: row.hub.id,
    name: row.hub.name,
    slug: row.hub.slug,
    description: row.hub.description,
    iconUrl: row.hub.iconUrl,
    bannerUrl: row.hub.bannerUrl,
    joinPolicy: row.hub.joinPolicy,
    isOfficial: row.hub.isOfficial,
    memberCount: row.hub.memberCount,
    postCount: row.hub.postCount,
    createdAt: row.hub.createdAt,
    createdBy: row.createdBy,
    rules: row.hub.rules,
    updatedAt: row.hub.updatedAt,
    currentUserRole,
    isBanned,
    hubType: row.hub.hubType,
    privacy: row.hub.privacy,
    website: row.hub.website,
    categories: row.hub.categories
  };
}
async function createHub(db, userId, input) {
  var _a, _b, _c;
  const slug = await ensureUniqueSlugFor(db, hubs, hubs.slug, hubs.id, generateSlug(input.name), "hub");
  const [inserted] = await db.insert(hubs).values({
    name: input.name,
    slug,
    description: (_a = input.description) != null ? _a : null,
    rules: (_b = input.rules) != null ? _b : null,
    joinPolicy: (_c = input.joinPolicy) != null ? _c : "open",
    createdById: userId,
    memberCount: 1
  }).returning();
  await db.insert(hubMembers).values({
    hubId: inserted.id,
    userId,
    role: "owner"
  });
  return await getHubBySlug(db, inserted.slug, userId);
}
async function updateHub(db, hubId, userId, input) {
  var _a;
  const member = await db.select({ role: hubMembers.role }).from(hubMembers).where(and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, userId))).limit(1);
  if (member.length === 0 || !hasPermission(member[0].role, "editHub")) {
    return null;
  }
  const updates = { updatedAt: /* @__PURE__ */ new Date() };
  if (input.name !== void 0) {
    updates.name = input.name;
    updates.slug = await ensureUniqueSlugFor(db, hubs, hubs.slug, hubs.id, generateSlug(input.name), "hub", hubId);
  }
  if (input.description !== void 0)
    updates.description = input.description;
  if (input.rules !== void 0)
    updates.rules = input.rules;
  if (input.joinPolicy !== void 0)
    updates.joinPolicy = input.joinPolicy;
  if (input.iconUrl !== void 0)
    updates.iconUrl = input.iconUrl;
  if (input.bannerUrl !== void 0)
    updates.bannerUrl = input.bannerUrl;
  await db.update(hubs).set(updates).where(eq(hubs.id, hubId));
  const slug = (_a = updates.slug) != null ? _a : void 0;
  if (slug) {
    return getHubBySlug(db, slug, userId);
  }
  const current = await db.select({ slug: hubs.slug }).from(hubs).where(eq(hubs.id, hubId)).limit(1);
  return getHubBySlug(db, current[0].slug, userId);
}
async function deleteHub(db, hubId, userId) {
  const member = await db.select({ role: hubMembers.role }).from(hubMembers).where(and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, userId))).limit(1);
  if (member.length === 0 || member[0].role !== "owner") {
    return false;
  }
  await db.delete(hubs).where(eq(hubs.id, hubId));
  return true;
}
async function joinHub(db, userId, hubId, inviteToken) {
  const ban = await checkBan(db, hubId, userId);
  if (ban) {
    return { joined: false, error: "You are banned from this hub" };
  }
  const hubRow = await db.select({ joinPolicy: hubs.joinPolicy }).from(hubs).where(eq(hubs.id, hubId)).limit(1);
  if (hubRow.length === 0) {
    return { joined: false, error: "Hub not found" };
  }
  const policy = hubRow[0].joinPolicy;
  if (policy !== "open") {
    if (!inviteToken) {
      return { joined: false, error: "Invite token required" };
    }
    const tokenResult = await validateAndUseInvite(db, inviteToken);
    if (!tokenResult.valid) {
      return { joined: false, error: "Invalid or expired invite token" };
    }
  }
  return db.transaction(async (tx) => {
    const inserted = await tx.insert(hubMembers).values({ hubId, userId, role: "member" }).onConflictDoNothing().returning();
    if (inserted.length === 0) {
      return { joined: true };
    }
    await tx.update(hubs).set({ memberCount: sql`${hubs.memberCount} + 1` }).where(eq(hubs.id, hubId));
    return { joined: true };
  });
}
async function leaveHub(db, userId, hubId) {
  const member = await db.select({ role: hubMembers.role }).from(hubMembers).where(and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, userId))).limit(1);
  if (member.length === 0) {
    return { left: false, error: "Not a member" };
  }
  if (member[0].role === "owner") {
    return { left: false, error: "Owner cannot leave the hub" };
  }
  await db.delete(hubMembers).where(and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, userId)));
  await db.update(hubs).set({ memberCount: sql`GREATEST(${hubs.memberCount} - 1, 0)` }).where(eq(hubs.id, hubId));
  return { left: true };
}
async function listMembers(db, hubId) {
  const rows = await db.select({
    member: hubMembers,
    user: USER_REF_SELECT
  }).from(hubMembers).innerJoin(users, eq(hubMembers.userId, users.id)).where(eq(hubMembers.hubId, hubId)).orderBy(desc(hubMembers.joinedAt));
  return rows.map((row) => ({
    hubId: row.member.hubId,
    userId: row.member.userId,
    role: row.member.role,
    joinedAt: row.member.joinedAt,
    user: row.user
  }));
}
async function changeRole(db, actorId, hubId, targetUserId, newRole) {
  const [actorMember, targetMember] = await Promise.all([
    db.select({ role: hubMembers.role }).from(hubMembers).where(and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, actorId))).limit(1),
    db.select({ role: hubMembers.role }).from(hubMembers).where(and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, targetUserId))).limit(1)
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
  await db.update(hubMembers).set({ role: newRole }).where(and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, targetUserId)));
  return { changed: true };
}
async function kickMember(db, actorId, hubId, targetUserId) {
  const [actorMember, targetMember] = await Promise.all([
    db.select({ role: hubMembers.role }).from(hubMembers).where(and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, actorId))).limit(1),
    db.select({ role: hubMembers.role }).from(hubMembers).where(and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, targetUserId))).limit(1)
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
  await db.delete(hubMembers).where(and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, targetUserId)));
  await db.update(hubs).set({ memberCount: sql`GREATEST(${hubs.memberCount} - 1, 0)` }).where(eq(hubs.id, hubId));
  return { kicked: true };
}
async function createPost(db, authorId, input) {
  const member = await db.select({ role: hubMembers.role }).from(hubMembers).where(and(eq(hubMembers.hubId, input.hubId), eq(hubMembers.userId, authorId))).limit(1);
  if (member.length === 0) {
    throw new Error("Must be a member to post");
  }
  return db.transaction(async (tx) => {
    var _a, _b;
    const [post] = await tx.insert(hubPosts).values({
      hubId: input.hubId,
      authorId,
      type: (_a = input.type) != null ? _a : "text",
      content: input.content
    }).returning();
    await tx.update(hubs).set({ postCount: sql`${hubs.postCount} + 1` }).where(eq(hubs.id, input.hubId));
    const author = await tx.select(USER_REF_SELECT).from(users).where(eq(users.id, authorId)).limit(1);
    return {
      id: post.id,
      hubId: post.hubId,
      type: post.type,
      content: post.content,
      isPinned: post.isPinned,
      isLocked: post.isLocked,
      likeCount: 0,
      replyCount: 0,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      author: (_b = author[0]) != null ? _b : { id: authorId, username: "unknown", displayName: null, avatarUrl: null }
    };
  });
}
async function listPosts(db, hubId, filters = {}) {
  const conditions = [eq(hubPosts.hubId, hubId)];
  if (filters.type) {
    conditions.push(eq(hubPosts.type, filters.type));
  }
  const where = and(...conditions);
  const { limit, offset } = normalizePagination(filters);
  const [rows, total] = await Promise.all([
    db.select({
      post: hubPosts,
      author: USER_REF_SELECT
    }).from(hubPosts).innerJoin(users, eq(hubPosts.authorId, users.id)).where(where).orderBy(desc(hubPosts.isPinned), desc(hubPosts.createdAt)).limit(limit).offset(offset),
    countRows(db, hubPosts, where)
  ]);
  const items = rows.map((row) => {
    const item = {
      id: row.post.id,
      hubId: row.post.hubId,
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
  return { items, total };
}
async function deletePost(db, postId, userId, hubId) {
  const post = await db.select({ authorId: hubPosts.authorId }).from(hubPosts).where(eq(hubPosts.id, postId)).limit(1);
  if (post.length === 0)
    return false;
  if (post[0].authorId !== userId) {
    const member = await db.select({ role: hubMembers.role }).from(hubMembers).where(and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, userId))).limit(1);
    if (member.length === 0 || !hasPermission(member[0].role, "deletePost")) {
      return false;
    }
  }
  await db.delete(hubPosts).where(eq(hubPosts.id, postId));
  await db.update(hubs).set({ postCount: sql`GREATEST(${hubs.postCount} - 1, 0)` }).where(eq(hubs.id, hubId));
  return true;
}
async function createReply(db, authorId, input) {
  var _a;
  const post = await db.select({ hubId: hubPosts.hubId, isLocked: hubPosts.isLocked }).from(hubPosts).where(eq(hubPosts.id, input.postId)).limit(1);
  if (post.length === 0)
    throw new Error("Post not found");
  if (post[0].isLocked)
    throw new Error("Post is locked");
  const member = await db.select({ role: hubMembers.role }).from(hubMembers).where(and(eq(hubMembers.hubId, post[0].hubId), eq(hubMembers.userId, authorId))).limit(1);
  if (member.length === 0)
    throw new Error("Must be a member to reply");
  const ban = await checkBan(db, post[0].hubId, authorId);
  if (ban)
    throw new Error("You are banned from this hub");
  const [reply] = await db.insert(hubPostReplies).values({
    postId: input.postId,
    authorId,
    content: input.content,
    parentId: (_a = input.parentId) != null ? _a : null
  }).returning();
  await db.update(hubPosts).set({ replyCount: sql`${hubPosts.replyCount} + 1` }).where(eq(hubPosts.id, input.postId));
  const author = await db.select(USER_REF_SELECT).from(users).where(eq(users.id, authorId)).limit(1);
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
    reply: hubPostReplies,
    author: {
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl
    }
  }).from(hubPostReplies).innerJoin(users, eq(hubPostReplies.authorId, users.id)).where(eq(hubPostReplies.postId, postId)).orderBy(desc(hubPostReplies.createdAt));
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
async function banUser(db, actorId, hubId, targetUserId, reason, expiresAt) {
  const [actorMember, targetMember] = await Promise.all([
    db.select({ role: hubMembers.role }).from(hubMembers).where(and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, actorId))).limit(1),
    db.select({ role: hubMembers.role }).from(hubMembers).where(and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, targetUserId))).limit(1)
  ]);
  if (actorMember.length === 0 || !hasPermission(actorMember[0].role, "banUser")) {
    return { banned: false, error: "Insufficient permissions" };
  }
  if (actorMember[0].role === "moderator" && !expiresAt) {
    return { banned: false, error: "Moderators can only issue temporary bans" };
  }
  if (targetMember.length > 0) {
    if (!canManageRole(actorMember[0].role, targetMember[0].role)) {
      return { banned: false, error: "Cannot ban a user with equal or higher role" };
    }
    await db.delete(hubMembers).where(and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, targetUserId)));
    await db.update(hubs).set({ memberCount: sql`GREATEST(${hubs.memberCount} - 1, 0)` }).where(eq(hubs.id, hubId));
  }
  await db.insert(hubBans).values({
    hubId,
    userId: targetUserId,
    bannedById: actorId,
    reason: reason != null ? reason : null,
    expiresAt: expiresAt != null ? expiresAt : null
  });
  return { banned: true };
}
async function unbanUser(db, actorId, hubId, targetUserId) {
  const actorMember = await db.select({ role: hubMembers.role }).from(hubMembers).where(and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, actorId))).limit(1);
  if (actorMember.length === 0 || !hasPermission(actorMember[0].role, "banUser")) {
    return { unbanned: false, error: "Insufficient permissions" };
  }
  await db.delete(hubBans).where(and(eq(hubBans.hubId, hubId), eq(hubBans.userId, targetUserId)));
  return { unbanned: true };
}
async function checkBan(db, hubId, userId) {
  const rows = await db.select({
    id: hubBans.id,
    reason: hubBans.reason,
    expiresAt: hubBans.expiresAt
  }).from(hubBans).where(and(eq(hubBans.hubId, hubId), eq(hubBans.userId, userId))).limit(1);
  if (rows.length === 0)
    return null;
  const ban = rows[0];
  if (ban.expiresAt && ban.expiresAt < /* @__PURE__ */ new Date()) {
    await db.delete(hubBans).where(eq(hubBans.id, ban.id));
    return null;
  }
  return ban;
}
async function listBans(db, hubId) {
  const rows = await db.select({
    ban: hubBans,
    user: USER_REF_SELECT
  }).from(hubBans).innerJoin(users, eq(hubBans.userId, users.id)).where(eq(hubBans.hubId, hubId)).orderBy(desc(hubBans.createdAt));
  const banIds = rows.map((r) => r.ban.bannedById);
  const uniqueBannerIds = [...new Set(banIds)];
  const banners = /* @__PURE__ */ new Map();
  if (uniqueBannerIds.length > 0) {
    const bannerRows = await db.select(USER_REF_SELECT).from(users).where(inArray(users.id, uniqueBannerIds));
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
async function createInvite(db, userId, hubId, maxUses, expiresAt) {
  const member = await db.select({ role: hubMembers.role }).from(hubMembers).where(and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, userId))).limit(1);
  if (member.length === 0 || !hasPermission(member[0].role, "manageMembers")) {
    return null;
  }
  const token = crypto.randomUUID().replace(/-/g, "");
  const [invite] = await db.insert(hubInvites).values({
    hubId,
    createdById: userId,
    token,
    maxUses: maxUses != null ? maxUses : null,
    expiresAt: expiresAt != null ? expiresAt : null
  }).returning();
  const author = await db.select(USER_REF_SELECT).from(users).where(eq(users.id, userId)).limit(1);
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
async function validateAndUseInvite(db, token) {
  const updated = await db.update(hubInvites).set({ useCount: sql`${hubInvites.useCount} + 1` }).where(and(eq(hubInvites.token, token), sql`(${hubInvites.expiresAt} IS NULL OR ${hubInvites.expiresAt} > NOW())`, sql`(${hubInvites.maxUses} IS NULL OR ${hubInvites.useCount} < ${hubInvites.maxUses})`)).returning({ hubId: hubInvites.hubId });
  if (updated.length === 0)
    return { valid: false };
  return { valid: true, hubId: updated[0].hubId };
}
async function listInvites(db, hubId) {
  const rows = await db.select({
    invite: hubInvites,
    createdBy: {
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl
    }
  }).from(hubInvites).innerJoin(users, eq(hubInvites.createdById, users.id)).where(eq(hubInvites.hubId, hubId)).orderBy(desc(hubInvites.createdAt));
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
async function shareContent(db, userId, hubId, contentId) {
  const member = await db.select({ role: hubMembers.role }).from(hubMembers).where(and(eq(hubMembers.hubId, hubId), eq(hubMembers.userId, userId))).limit(1);
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
  await db.insert(hubShares).values({
    hubId,
    contentId,
    sharedById: userId
  });
  return createPost(db, userId, {
    hubId,
    type: "share",
    content: sharePayload
  });
}

async function createProduct(db, userId, hubId, input) {
  var _a, _b, _c, _d, _e, _f, _g;
  const slug = await ensureUniqueSlugFor(db, products, products.slug, products.id, generateSlug(input.name), "product");
  const [product] = await db.insert(products).values({
    name: input.name,
    slug,
    description: (_a = input.description) != null ? _a : null,
    hubId,
    category: input.category,
    specs: (_b = input.specs) != null ? _b : null,
    imageUrl: (_c = input.imageUrl) != null ? _c : null,
    purchaseUrl: (_d = input.purchaseUrl) != null ? _d : null,
    datasheetUrl: (_e = input.datasheetUrl) != null ? _e : null,
    pricing: (_f = input.pricing) != null ? _f : null,
    status: (_g = input.status) != null ? _g : "active",
    createdById: userId
  }).returning();
  return await getProductBySlug(db, product.slug);
}
async function updateProduct(db, productId, userId, input) {
  const existing = await db.select({ id: products.id, createdById: products.createdById }).from(products).where(eq(products.id, productId)).limit(1);
  if (existing.length === 0)
    return null;
  if (existing[0].createdById !== userId)
    return null;
  const updates = { updatedAt: /* @__PURE__ */ new Date() };
  if (input.name !== void 0) {
    updates.name = input.name;
    updates.slug = await ensureUniqueSlugFor(db, products, products.slug, products.id, generateSlug(input.name), "product", productId);
  }
  if (input.description !== void 0)
    updates.description = input.description;
  if (input.category !== void 0)
    updates.category = input.category;
  if (input.specs !== void 0)
    updates.specs = input.specs;
  if (input.imageUrl !== void 0)
    updates.imageUrl = input.imageUrl;
  if (input.purchaseUrl !== void 0)
    updates.purchaseUrl = input.purchaseUrl;
  if (input.datasheetUrl !== void 0)
    updates.datasheetUrl = input.datasheetUrl;
  if (input.pricing !== void 0)
    updates.pricing = input.pricing;
  if (input.status !== void 0)
    updates.status = input.status;
  await db.update(products).set(updates).where(eq(products.id, productId));
  const updated = await db.select({ slug: products.slug }).from(products).where(eq(products.id, productId)).limit(1);
  return getProductBySlug(db, updated[0].slug);
}
async function deleteProduct(db, productId, userId) {
  const result = await db.delete(products).where(eq(products.id, productId)).returning({ id: products.id });
  return result.length > 0;
}
async function getProductBySlug(db, slug) {
  const rows = await db.select({
    product: products,
    createdBy: USER_REF_SELECT,
    hub: {
      id: hubs.id,
      name: hubs.name,
      slug: hubs.slug,
      hubType: hubs.hubType
    }
  }).from(products).innerJoin(users, eq(products.createdById, users.id)).innerJoin(hubs, eq(products.hubId, hubs.id)).where(eq(products.slug, slug)).limit(1);
  if (rows.length === 0)
    return null;
  const row = rows[0];
  return {
    id: row.product.id,
    name: row.product.name,
    slug: row.product.slug,
    description: row.product.description,
    category: row.product.category,
    imageUrl: row.product.imageUrl,
    purchaseUrl: row.product.purchaseUrl,
    datasheetUrl: row.product.datasheetUrl,
    specs: row.product.specs,
    alternatives: row.product.alternatives,
    pricing: row.product.pricing,
    status: row.product.status,
    hubId: row.product.hubId,
    createdAt: row.product.createdAt,
    updatedAt: row.product.updatedAt,
    createdBy: row.createdBy,
    hub: row.hub
  };
}
async function listHubProducts(db, hubId, filters = {}) {
  const conditions = [eq(products.hubId, hubId)];
  if (filters.search) {
    conditions.push(ilike(products.name, `%${filters.search}%`));
  }
  if (filters.category) {
    conditions.push(eq(products.category, filters.category));
  }
  if (filters.status) {
    conditions.push(eq(products.status, filters.status));
  }
  const where = and(...conditions);
  const { limit, offset } = normalizePagination(filters);
  const [rows, total] = await Promise.all([
    db.select().from(products).where(where).orderBy(desc(products.createdAt)).limit(limit).offset(offset),
    countRows(db, products, where)
  ]);
  const items = rows.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    category: p.category,
    imageUrl: p.imageUrl,
    purchaseUrl: p.purchaseUrl,
    status: p.status,
    hubId: p.hubId,
    createdAt: p.createdAt
  }));
  return { items, total };
}
async function searchProducts(db, filters = {}) {
  const conditions = [];
  if (filters.search) {
    conditions.push(ilike(products.name, `%${filters.search}%`));
  }
  if (filters.category) {
    conditions.push(eq(products.category, filters.category));
  }
  if (filters.status) {
    conditions.push(eq(products.status, filters.status));
  }
  if (filters.hubId) {
    conditions.push(eq(products.hubId, filters.hubId));
  }
  const where = conditions.length > 0 ? and(...conditions) : void 0;
  const { limit, offset } = normalizePagination(filters);
  const [rows, total] = await Promise.all([
    db.select().from(products).where(where).orderBy(desc(products.createdAt)).limit(limit).offset(offset),
    countRows(db, products, where)
  ]);
  const items = rows.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    category: p.category,
    imageUrl: p.imageUrl,
    purchaseUrl: p.purchaseUrl,
    status: p.status,
    hubId: p.hubId,
    createdAt: p.createdAt
  }));
  return { items, total };
}
async function addContentProduct(db, contentId, input) {
  var _a, _b, _c, _d, _e;
  const product = await db.select({ id: products.id, name: products.name, slug: products.slug, imageUrl: products.imageUrl }).from(products).where(eq(products.id, input.productId)).limit(1);
  if (product.length === 0)
    return null;
  const [row] = await db.insert(contentProducts).values({
    contentId,
    productId: input.productId,
    quantity: (_a = input.quantity) != null ? _a : 1,
    role: (_b = input.role) != null ? _b : null,
    notes: (_c = input.notes) != null ? _c : null,
    required: (_d = input.required) != null ? _d : true,
    sortOrder: (_e = input.sortOrder) != null ? _e : 0
  }).onConflictDoNothing().returning();
  if (!row)
    return null;
  return {
    id: row.id,
    productId: product[0].id,
    productName: product[0].name,
    productSlug: product[0].slug,
    productImageUrl: product[0].imageUrl,
    quantity: row.quantity,
    role: row.role,
    notes: row.notes,
    required: row.required,
    sortOrder: row.sortOrder
  };
}
async function removeContentProduct(db, contentId, productId) {
  const result = await db.delete(contentProducts).where(and(eq(contentProducts.contentId, contentId), eq(contentProducts.productId, productId))).returning({ id: contentProducts.id });
  return result.length > 0;
}
async function listContentProducts(db, contentId) {
  const rows = await db.select({
    cp: contentProducts,
    product: {
      id: products.id,
      name: products.name,
      slug: products.slug,
      imageUrl: products.imageUrl
    }
  }).from(contentProducts).innerJoin(products, eq(contentProducts.productId, products.id)).where(eq(contentProducts.contentId, contentId)).orderBy(contentProducts.sortOrder);
  return rows.map((row) => ({
    id: row.cp.id,
    productId: row.product.id,
    productName: row.product.name,
    productSlug: row.product.slug,
    productImageUrl: row.product.imageUrl,
    quantity: row.cp.quantity,
    role: row.cp.role,
    notes: row.cp.notes,
    required: row.cp.required,
    sortOrder: row.cp.sortOrder
  }));
}
async function syncContentProducts(db, contentId, items) {
  return db.transaction(async (tx) => {
    await tx.delete(contentProducts).where(eq(contentProducts.contentId, contentId));
    if (items.length === 0)
      return [];
    await tx.insert(contentProducts).values(items.map((item, index) => {
      var _a, _b, _c, _d;
      return {
        contentId,
        productId: item.productId,
        quantity: (_a = item.quantity) != null ? _a : 1,
        role: (_b = item.role) != null ? _b : null,
        notes: (_c = item.notes) != null ? _c : null,
        required: (_d = item.required) != null ? _d : true,
        sortOrder: index
      };
    }));
    const rows = await tx.select({
      cp: contentProducts,
      product: {
        id: products.id,
        name: products.name,
        slug: products.slug,
        imageUrl: products.imageUrl
      }
    }).from(contentProducts).innerJoin(products, eq(contentProducts.productId, products.id)).where(eq(contentProducts.contentId, contentId)).orderBy(contentProducts.sortOrder);
    return rows.map((row) => ({
      id: row.cp.id,
      productId: row.product.id,
      productName: row.product.name,
      productSlug: row.product.slug,
      productImageUrl: row.product.imageUrl,
      quantity: row.cp.quantity,
      role: row.cp.role,
      notes: row.cp.notes,
      required: row.cp.required,
      sortOrder: row.cp.sortOrder
    }));
  });
}
async function listProductContent(db, productId, opts = {}) {
  var _a, _b;
  const { limit, offset } = normalizePagination(opts);
  const where = and(eq(contentProducts.productId, productId), eq(contentItems.status, "published"));
  const [rows, countResult] = await Promise.all([
    db.select({
      content: {
        id: contentItems.id,
        title: contentItems.title,
        slug: contentItems.slug,
        type: contentItems.type,
        coverImageUrl: contentItems.coverImageUrl,
        publishedAt: contentItems.publishedAt
      },
      author: USER_REF_SELECT
    }).from(contentProducts).innerJoin(contentItems, eq(contentProducts.contentId, contentItems.id)).innerJoin(users, eq(contentItems.authorId, users.id)).where(where).orderBy(desc(contentItems.publishedAt)).limit(limit).offset(offset),
    db.select({ count: sql`count(*)::int` }).from(contentProducts).innerJoin(contentItems, eq(contentProducts.contentId, contentItems.id)).where(where)
  ]);
  return {
    items: rows.map((row) => ({
      ...row.content,
      author: row.author
    })),
    total: (_b = (_a = countResult[0]) == null ? void 0 : _a.count) != null ? _b : 0
  };
}
async function listHubGallery(db, hubId, opts = {}) {
  var _a, _b, _c, _d, _e, _f;
  const { limit, offset } = normalizePagination(opts);
  const hub = await db.select({ id: hubs.id, hubType: hubs.hubType }).from(hubs).where(eq(hubs.id, hubId)).limit(1);
  if (hub.length === 0)
    return { items: [], total: 0 };
  const hubType = hub[0].hubType;
  if (hubType === "product") {
    const productIds = await db.select({ id: products.id }).from(products).where(eq(products.hubId, hubId));
    if (productIds.length === 0)
      return { items: [], total: 0 };
    const pIds = productIds.map((p) => p.id);
    const where2 = and(inArray(contentProducts.productId, pIds), eq(contentItems.status, "published"));
    const [rows2, countResult2] = await Promise.all([
      db.selectDistinctOn([contentItems.id], {
        content: {
          id: contentItems.id,
          title: contentItems.title,
          slug: contentItems.slug,
          type: contentItems.type,
          coverImageUrl: contentItems.coverImageUrl,
          publishedAt: contentItems.publishedAt
        },
        author: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl
        }
      }).from(contentProducts).innerJoin(contentItems, eq(contentProducts.contentId, contentItems.id)).innerJoin(users, eq(contentItems.authorId, users.id)).where(where2).orderBy(contentItems.id, desc(contentItems.publishedAt)).limit(limit).offset(offset),
      db.select({ count: sql`count(DISTINCT ${contentItems.id})::int` }).from(contentProducts).innerJoin(contentItems, eq(contentProducts.contentId, contentItems.id)).where(where2)
    ]);
    return {
      items: rows2.map((row) => ({ ...row.content, author: row.author })),
      total: (_b = (_a = countResult2[0]) == null ? void 0 : _a.count) != null ? _b : 0
    };
  }
  if (hubType === "company") {
    const childHubIds = await db.select({ id: hubs.id }).from(hubs).where(eq(hubs.parentHubId, hubId));
    const allHubIds = [hubId, ...childHubIds.map((h) => h.id)];
    const productIds = await db.select({ id: products.id }).from(products).where(inArray(products.hubId, allHubIds));
    if (productIds.length === 0)
      return { items: [], total: 0 };
    const pIds = productIds.map((p) => p.id);
    const where2 = and(inArray(contentProducts.productId, pIds), eq(contentItems.status, "published"));
    const [rows2, countResult2] = await Promise.all([
      db.selectDistinctOn([contentItems.id], {
        content: {
          id: contentItems.id,
          title: contentItems.title,
          slug: contentItems.slug,
          type: contentItems.type,
          coverImageUrl: contentItems.coverImageUrl,
          publishedAt: contentItems.publishedAt
        },
        author: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl
        }
      }).from(contentProducts).innerJoin(contentItems, eq(contentProducts.contentId, contentItems.id)).innerJoin(users, eq(contentItems.authorId, users.id)).where(where2).orderBy(contentItems.id, desc(contentItems.publishedAt)).limit(limit).offset(offset),
      db.select({ count: sql`count(DISTINCT ${contentItems.id})::int` }).from(contentProducts).innerJoin(contentItems, eq(contentProducts.contentId, contentItems.id)).where(where2)
    ]);
    return {
      items: rows2.map((row) => ({ ...row.content, author: row.author })),
      total: (_d = (_c = countResult2[0]) == null ? void 0 : _c.count) != null ? _d : 0
    };
  }
  const { hubShares } = await Promise.resolve().then(function () { return schema; });
  const where = and(eq(hubShares.hubId, hubId), eq(contentItems.status, "published"));
  const [rows, countResult] = await Promise.all([
    db.select({
      content: {
        id: contentItems.id,
        title: contentItems.title,
        slug: contentItems.slug,
        type: contentItems.type,
        coverImageUrl: contentItems.coverImageUrl,
        publishedAt: contentItems.publishedAt
      },
      author: USER_REF_SELECT
    }).from(hubShares).innerJoin(contentItems, eq(hubShares.contentId, contentItems.id)).innerJoin(users, eq(contentItems.authorId, users.id)).where(where).orderBy(desc(hubShares.createdAt)).limit(limit).offset(offset),
    db.select({ count: sql`count(*)::int` }).from(hubShares).innerJoin(contentItems, eq(hubShares.contentId, contentItems.id)).where(where)
  ]);
  return {
    items: rows.map((row) => ({ ...row.content, author: row.author })),
    total: (_f = (_e = countResult[0]) == null ? void 0 : _e.count) != null ? _f : 0
  };
}

async function toggleLike(db, userId, targetType, targetId) {
  return db.transaction(async (tx) => {
    const existing = await tx.select({ id: likes.id }).from(likes).where(and(eq(likes.userId, userId), eq(likes.targetType, targetType), eq(likes.targetId, targetId))).limit(1);
    if (existing.length > 0) {
      await tx.delete(likes).where(eq(likes.id, existing[0].id));
      await updateLikeCount(tx, targetType, targetId, -1);
      return { liked: false };
    }
    await tx.insert(likes).values({ userId, targetType, targetId });
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
      await tx.update(hubPosts).set({
        likeCount: delta > 0 ? sql`${hubPosts.likeCount} + 1` : sql`GREATEST(${hubPosts.likeCount} - 1, 0)`
      }).where(eq(hubPosts.id, targetId));
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
    author: USER_REF_SELECT
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
    await db.update(hubPosts).set({ replyCount: sql`${hubPosts.replyCount} + 1` }).where(eq(hubPosts.id, input.targetId));
  } else {
    await db.update(contentItems).set({ commentCount: sql`${contentItems.commentCount} + 1` }).where(eq(contentItems.id, input.targetId));
  }
  const author = await db.select(USER_REF_SELECT).from(users).where(eq(users.id, authorId)).limit(1);
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
  var _a, _b;
  const existing = await db.select({ id: comments.id, targetId: comments.targetId, targetType: comments.targetType }).from(comments).where(and(eq(comments.id, commentId), eq(comments.authorId, authorId))).limit(1);
  if (existing.length === 0)
    return false;
  const childCount = await db.select({ count: sql`count(*)::int` }).from(comments).where(eq(comments.parentId, commentId));
  const totalDeleted = 1 + ((_b = (_a = childCount[0]) == null ? void 0 : _a.count) != null ? _b : 0);
  await db.delete(comments).where(eq(comments.parentId, commentId));
  await db.delete(comments).where(eq(comments.id, commentId));
  if (existing[0].targetType === "post") {
    await db.update(hubPosts).set({ replyCount: sql`GREATEST(${hubPosts.replyCount} - ${totalDeleted}, 0)` }).where(eq(hubPosts.id, existing[0].targetId));
  } else {
    await db.update(contentItems).set({ commentCount: sql`GREATEST(${contentItems.commentCount} - ${totalDeleted}, 0)` }).where(eq(contentItems.id, existing[0].targetId));
  }
  return true;
}
async function toggleBookmark(db, userId, targetType, targetId) {
  return db.transaction(async (tx) => {
    const existing = await tx.select({ id: bookmarks.id }).from(bookmarks).where(and(eq(bookmarks.userId, userId), eq(bookmarks.targetType, targetType), eq(bookmarks.targetId, targetId))).limit(1);
    if (existing.length > 0) {
      await tx.delete(bookmarks).where(eq(bookmarks.id, existing[0].id));
      return { bookmarked: false };
    }
    await tx.insert(bookmarks).values({ userId, targetType, targetId });
    return { bookmarked: true };
  });
}
async function listUserBookmarks(db, userId, opts = {}) {
  const { limit, offset } = normalizePagination(opts);
  const where = eq(bookmarks.userId, userId);
  const [rows, total] = await Promise.all([
    db.select({
      bookmark: bookmarks,
      content: {
        id: contentItems.id,
        title: contentItems.title,
        slug: contentItems.slug,
        type: contentItems.type,
        coverImageUrl: contentItems.coverImageUrl
      },
      author: {
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl
      }
    }).from(bookmarks).leftJoin(contentItems, eq(bookmarks.targetId, contentItems.id)).leftJoin(users, eq(contentItems.authorId, users.id)).where(where).orderBy(desc(bookmarks.createdAt)).limit(limit).offset(offset),
    countRows(db, bookmarks, where)
  ]);
  const items = rows.map((row) => {
    var _a, _b;
    return {
      id: row.bookmark.id,
      targetType: row.bookmark.targetType,
      targetId: row.bookmark.targetId,
      createdAt: row.bookmark.createdAt,
      content: ((_a = row.content) == null ? void 0 : _a.id) ? {
        id: row.content.id,
        title: row.content.title,
        slug: row.content.slug,
        type: row.content.type,
        coverImageUrl: row.content.coverImageUrl,
        author: (_b = row.author) != null ? _b : { id: "deleted", username: "deleted", displayName: "[Deleted User]", avatarUrl: null }
      } : null
    };
  });
  return { items, total };
}
async function followUser(db, followerId, followingId) {
  if (followerId === followingId)
    return { followed: false };
  const [result] = await db.insert(follows).values({ followerId, followingId }).onConflictDoNothing().returning();
  return { followed: !!result };
}
async function unfollowUser(db, followerId, followingId) {
  const result = await db.delete(follows).where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId))).returning({ id: follows.id });
  return { unfollowed: result.length > 0 };
}
async function isFollowing(db, followerId, followingId) {
  const rows = await db.select({ id: follows.id }).from(follows).where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId))).limit(1);
  return rows.length > 0;
}
async function listFollowers(db, userId, opts = {}) {
  const { limit, offset } = normalizePagination(opts);
  const where = eq(follows.followingId, userId);
  const [rows, total] = await Promise.all([
    db.select({
      user: USER_REF_WITH_BIO_SELECT,
      followedAt: follows.createdAt
    }).from(follows).innerJoin(users, eq(follows.followerId, users.id)).where(where).orderBy(desc(follows.createdAt)).limit(limit).offset(offset),
    countRows(db, follows, where)
  ]);
  return {
    items: rows.map((row) => {
      var _a;
      return {
        ...row.user,
        bio: (_a = row.user.bio) != null ? _a : null,
        followedAt: row.followedAt
      };
    }),
    total
  };
}
async function listFollowing(db, userId, opts = {}) {
  const { limit, offset } = normalizePagination(opts);
  const where = eq(follows.followerId, userId);
  const [rows, total] = await Promise.all([
    db.select({
      user: USER_REF_WITH_BIO_SELECT,
      followedAt: follows.createdAt
    }).from(follows).innerJoin(users, eq(follows.followingId, users.id)).where(where).orderBy(desc(follows.createdAt)).limit(limit).offset(offset),
    countRows(db, follows, where)
  ]);
  return {
    items: rows.map((row) => {
      var _a;
      return {
        ...row.user,
        bio: (_a = row.user.bio) != null ? _a : null,
        followedAt: row.followedAt
      };
    }),
    total
  };
}
async function createReport(db, reporterId, input) {
  var _a;
  const { reports } = await Promise.resolve().then(function () { return schema; });
  const [report] = await db.insert(reports).values({
    reporterId,
    targetType: input.targetType,
    targetId: input.targetId,
    reason: input.reason,
    description: (_a = input.description) != null ? _a : null
  }).returning({ id: reports.id });
  return { id: report.id };
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
  const { limit, offset } = normalizePagination(filters);
  const moduleCountSubquery = db.select({
    pathId: learningModules.pathId,
    moduleCount: sql`count(*)::int`.as("module_count")
  }).from(learningModules).groupBy(learningModules.pathId).as("mc");
  const [rows, total] = await Promise.all([
    db.select({
      path: learningPaths,
      author: {
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl
      },
      moduleCount: sql`coalesce(${moduleCountSubquery.moduleCount}, 0)`.mapWith(Number)
    }).from(learningPaths).innerJoin(users, eq(learningPaths.authorId, users.id)).leftJoin(moduleCountSubquery, eq(learningPaths.id, moduleCountSubquery.pathId)).where(where).orderBy(desc(learningPaths.createdAt)).limit(limit).offset(offset),
    countRows(db, learningPaths, where)
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
    moduleCount: row.moduleCount,
    status: row.path.status,
    createdAt: row.path.createdAt,
    author: row.author
  }));
  return { items, total };
}
async function getPathBySlug(db, slug, requesterId) {
  const rows = await db.select({
    path: learningPaths,
    author: USER_REF_SELECT
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
    lessons = await db.select().from(learningLessons).where(inArray(learningLessons.moduleId, moduleIds)).orderBy(asc(learningLessons.sortOrder));
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
    lessons: lessons.filter((l) => l.moduleId === mod.id).map((l) => {
      var _a;
      return {
        id: l.id,
        title: l.title,
        slug: l.slug,
        type: l.type,
        duration: l.duration,
        sortOrder: l.sortOrder,
        contentItemId: (_a = l.contentItemId) != null ? _a : null
      };
    })
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
    moduleCount: modulesWithLessons.length,
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
  const slug = await ensureUniqueSlugFor(db, learningPaths, learningPaths.slug, learningPaths.id, generateSlug(input.title), "untitled");
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
      updates.slug = await ensureUniqueSlugFor(db, learningPaths, learningPaths.slug, learningPaths.id, generateSlug(input.title), "untitled", pathId);
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
async function deleteModule(db, moduleId, authorId) {
  const mod = await db.select({ module: learningModules, path: learningPaths }).from(learningModules).innerJoin(learningPaths, eq(learningModules.pathId, learningPaths.id)).where(and(eq(learningModules.id, moduleId), eq(learningPaths.authorId, authorId))).limit(1);
  if (mod.length === 0)
    return false;
  await db.delete(learningModules).where(eq(learningModules.id, moduleId));
  return true;
}
async function createLesson(db, authorId, input) {
  var _a, _b, _c, _d, _e;
  const mod = await db.select({ module: learningModules, path: learningPaths }).from(learningModules).innerJoin(learningPaths, eq(learningModules.pathId, learningPaths.id)).where(and(eq(learningModules.id, input.moduleId), eq(learningPaths.authorId, authorId))).limit(1);
  if (mod.length === 0)
    throw new Error("Not authorized");
  let resolvedType = input.type;
  if (input.contentItemId) {
    const item = await db.select({ id: contentItems.id, type: contentItems.type, authorId: contentItems.authorId }).from(contentItems).where(eq(contentItems.id, input.contentItemId)).limit(1);
    if (item.length === 0)
      throw new Error("Content item not found");
    if (item[0].authorId !== authorId)
      throw new Error("You can only link your own content");
    resolvedType = item[0].type;
  }
  const slug = generateSlug(input.title) || `lesson-${Date.now()}`;
  const maxSort = await db.select({ max: sql`coalesce(max(${learningLessons.sortOrder}), -1)` }).from(learningLessons).where(eq(learningLessons.moduleId, input.moduleId));
  const [lesson] = await db.insert(learningLessons).values({
    moduleId: input.moduleId,
    title: input.title,
    slug,
    type: resolvedType,
    content: input.contentItemId ? null : (_a = input.content) != null ? _a : null,
    contentItemId: (_b = input.contentItemId) != null ? _b : null,
    duration: (_c = input.durationMinutes) != null ? _c : null,
    sortOrder: ((_e = (_d = maxSort[0]) == null ? void 0 : _d.max) != null ? _e : -1) + 1
  }).returning();
  return lesson;
}
async function updateLesson(db, lessonId, authorId, input) {
  const lesson = await db.select({ lesson: learningLessons, module: learningModules, path: learningPaths }).from(learningLessons).innerJoin(learningModules, eq(learningLessons.moduleId, learningModules.id)).innerJoin(learningPaths, eq(learningModules.pathId, learningPaths.id)).where(and(eq(learningLessons.id, lessonId), eq(learningPaths.authorId, authorId))).limit(1);
  if (lesson.length === 0)
    return null;
  const updates = { updatedAt: /* @__PURE__ */ new Date() };
  if (input.title !== void 0) {
    updates.title = input.title;
    updates.slug = generateSlug(input.title) || lesson[0].lesson.slug;
  }
  if (input.type !== void 0)
    updates.type = input.type;
  if (input.content !== void 0)
    updates.content = input.content;
  if (input.contentItemId !== void 0) {
    updates.contentItemId = input.contentItemId;
    if (input.contentItemId === null) ; else {
      const item = await db.select({ id: contentItems.id, type: contentItems.type, authorId: contentItems.authorId }).from(contentItems).where(eq(contentItems.id, input.contentItemId)).limit(1);
      if (item.length === 0)
        throw new Error("Content item not found");
      if (item[0].authorId !== authorId)
        throw new Error("You can only link your own content");
      updates.type = item[0].type;
      updates.content = null;
    }
  }
  if (input.durationMinutes !== void 0)
    updates.duration = input.durationMinutes;
  const [updated] = await db.update(learningLessons).set(updates).where(eq(learningLessons.id, lessonId)).returning();
  return updated;
}
async function deleteLesson(db, lessonId, authorId) {
  const lesson = await db.select({ lesson: learningLessons, module: learningModules, path: learningPaths }).from(learningLessons).innerJoin(learningModules, eq(learningLessons.moduleId, learningModules.id)).innerJoin(learningPaths, eq(learningModules.pathId, learningPaths.id)).where(and(eq(learningLessons.id, lessonId), eq(learningPaths.authorId, authorId))).limit(1);
  if (lesson.length === 0)
    return false;
  await db.delete(learningLessons).where(eq(learningLessons.id, lessonId));
  return true;
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
async function getCertificateByCode(db, code) {
  var _a;
  const rows = await db.select({
    certificate: certificates,
    path: {
      title: learningPaths.title,
      slug: learningPaths.slug
    },
    user: {
      displayName: users.displayName,
      username: users.username
    }
  }).from(certificates).innerJoin(learningPaths, eq(certificates.pathId, learningPaths.id)).innerJoin(users, eq(certificates.userId, users.id)).where(eq(certificates.verificationCode, code)).limit(1);
  return (_a = rows[0]) != null ? _a : null;
}
async function getLessonBySlug(db, pathSlug, lessonSlug) {
  const path = await db.select().from(learningPaths).where(eq(learningPaths.slug, pathSlug)).limit(1);
  if (path.length === 0)
    return null;
  const rows = await db.select({ lesson: learningLessons, module: learningModules }).from(learningLessons).innerJoin(learningModules, eq(learningLessons.moduleId, learningModules.id)).where(and(eq(learningLessons.slug, lessonSlug), eq(learningModules.pathId, path[0].id))).limit(1);
  if (rows.length === 0)
    return null;
  const result = {
    lesson: rows[0].lesson,
    module: rows[0].module,
    pathId: path[0].id
  };
  if (rows[0].lesson.contentItemId) {
    const items = await db.select({
      id: contentItems.id,
      title: contentItems.title,
      slug: contentItems.slug,
      type: contentItems.type,
      content: contentItems.content
    }).from(contentItems).where(eq(contentItems.id, rows[0].lesson.contentItemId)).limit(1);
    if (items.length > 0) {
      result.linkedContent = items[0];
    }
  }
  return result;
}

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)---\r?\n?/;
function parseFrontmatter(markdown) {
  const match = markdown.match(FRONTMATTER_REGEX);
  if (!match) {
    return { frontmatter: {}, content: markdown };
  }
  const yamlString = match[1];
  const content = markdown.slice(match[0].length).replace(/^\r?\n+/, "");
  let parsed;
  try {
    parsed = parse$1(yamlString);
  } catch {
    return { frontmatter: {}, content: markdown };
  }
  if (!parsed || typeof parsed !== "object") {
    return { frontmatter: {}, content };
  }
  const frontmatter = {};
  if (typeof parsed.title === "string") {
    frontmatter.title = parsed.title;
  }
  if (typeof parsed.description === "string") {
    frontmatter.description = parsed.description;
  }
  if (typeof parsed.sidebar_label === "string") {
    frontmatter.sidebarLabel = parsed.sidebar_label;
  }
  if (typeof parsed.sidebar_position === "number") {
    frontmatter.sidebarPosition = parsed.sidebar_position;
  }
  return { frontmatter, content };
}

const HEADING_REGEX = /^(#{2,6})\s+(.+)$/gm;
function generateHeadingId(text, existing = /* @__PURE__ */ new Set()) {
  const base = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(/-{2,}/g, "-");
  if (!base)
    return "heading";
  let id = base;
  let counter = 1;
  while (existing.has(id)) {
    id = `${base}-${counter}`;
    counter++;
  }
  return id;
}
function extractHeadings(markdown) {
  const entries = [];
  const usedIds = /* @__PURE__ */ new Set();
  let match;
  while ((match = HEADING_REGEX.exec(markdown)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();
    const id = generateHeadingId(text, usedIds);
    usedIds.add(id);
    entries.push({ id, text, level });
  }
  return entries;
}

var _a, _b, _c, _d, _e, _f, _g, _h;
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    // Allow id for heading anchors (rehype-slug)
    "*": [...(_b = (_a = defaultSchema.attributes) == null ? void 0 : _a["*"]) != null ? _b : [], "id", "className"],
    code: [...(_d = (_c = defaultSchema.attributes) == null ? void 0 : _c["code"]) != null ? _d : [], "className", "style"],
    span: [...(_f = (_e = defaultSchema.attributes) == null ? void 0 : _e["span"]) != null ? _f : [], "className", "style"],
    pre: [...(_h = (_g = defaultSchema.attributes) == null ? void 0 : _g["pre"]) != null ? _h : [], "className", "style"]
  }
};
async function renderMarkdown(markdown, options = {}) {
  var _a2;
  const { frontmatter, content } = parseFrontmatter(markdown);
  const toc = extractHeadings(content);
  const plugins = [
    remarkParse,
    remarkGfm,
    remarkFrontmatter,
    [remarkRehype, { allowDangerousHtml: false }],
    rehypeSlug
  ];
  try {
    const { default: rehypeShiki } = await import('@shikijs/rehype');
    plugins.push([rehypeShiki, { theme: (_a2 = options.highlightTheme) != null ? _a2 : "github-dark" }]);
  } catch {
  }
  plugins.push([rehypeSanitize, sanitizeSchema]);
  plugins.push([rehypeStringify, { allowDangerousHtml: false }]);
  let processor = unified();
  for (const plugin of plugins) {
    if (Array.isArray(plugin)) {
      processor = processor.use(plugin[0], ...plugin.slice(1));
    } else {
      processor = processor.use(plugin);
    }
  }
  const result = await processor.process(content);
  return {
    html: String(result),
    toc,
    frontmatter
  };
}

async function listDocsSites(db, filters = {}) {
  const conditions = [];
  if (filters.ownerId) {
    conditions.push(eq(docsSites.ownerId, filters.ownerId));
  }
  const where = conditions.length > 0 ? and(...conditions) : void 0;
  const { limit, offset } = normalizePagination(filters);
  const [rows, total] = await Promise.all([
    db.select({
      site: docsSites,
      owner: {
        id: users.id,
        username: users.username,
        displayName: users.displayName
      }
    }).from(docsSites).innerJoin(users, eq(docsSites.ownerId, users.id)).where(where).orderBy(desc(docsSites.createdAt)).limit(limit).offset(offset),
    countRows(db, docsSites, where)
  ]);
  const items = rows.map((row) => ({
    ...row.site,
    owner: row.owner
  }));
  return { items, total };
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
  const slug = await ensureUniqueSlugFor(db, docsSites, docsSites.slug, docsSites.id, input.slug || generateSlug(input.name), "docs");
  const [site] = await db.insert(docsSites).values({
    name: input.name,
    slug,
    description: (_a = input.description) != null ? _a : null,
    ownerId
  }).returning();
  await db.insert(docsVersions).values({
    siteId: site.id,
    version: "v1",
    isDefault: true
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
      updates.slug = await ensureUniqueSlugFor(db, docsSites, docsSites.slug, docsSites.id, generateSlug(input.name), "docs", siteId);
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
  var _a, _b;
  const site = await db.select().from(docsSites).where(and(eq(docsSites.id, siteId), eq(docsSites.ownerId, ownerId))).limit(1);
  if (site.length === 0)
    throw new Error("Not authorized");
  const [version] = await db.insert(docsVersions).values({
    siteId,
    version: input.version,
    isDefault: (_a = input.isDefault) != null ? _a : false
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
          pagesToInsert[i].parentId = (_b = oldToNew.get(oldParent)) != null ? _b : null;
        }
      }
      await db.insert(docsPages).values(pagesToInsert);
    }
  }
  if (input.isDefault) {
    await db.update(docsVersions).set({ isDefault: false }).where(and(eq(docsVersions.siteId, siteId), sql`${docsVersions.id} != ${version.id}`));
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
  if (input.parentId !== void 0 && input.parentId === pageId) {
    throw new Error("A page cannot be its own parent");
  }
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
async function deleteDocsPage(db, pageId, ownerId) {
  const page = await db.select({ page: docsPages, version: docsVersions, site: docsSites }).from(docsPages).innerJoin(docsVersions, eq(docsPages.versionId, docsVersions.id)).innerJoin(docsSites, eq(docsVersions.siteId, docsSites.id)).where(and(eq(docsPages.id, pageId), eq(docsSites.ownerId, ownerId))).limit(1);
  if (page.length === 0)
    return false;
  await db.delete(docsPages).where(eq(docsPages.id, pageId));
  return true;
}
async function reorderDocsPages(db, versionId, ownerId, pageIds) {
  const version = await db.select({ version: docsVersions, site: docsSites }).from(docsVersions).innerJoin(docsSites, eq(docsVersions.siteId, docsSites.id)).where(and(eq(docsVersions.id, versionId), eq(docsSites.ownerId, ownerId))).limit(1);
  if (version.length === 0)
    return false;
  await db.transaction(async (tx) => {
    for (let i = 0; i < pageIds.length; i++) {
      await tx.update(docsPages).set({ sortOrder: i }).where(and(eq(docsPages.id, pageIds[i]), eq(docsPages.versionId, versionId)));
    }
  });
  return true;
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
  var _a, _b;
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
  const [rows, total] = await Promise.all([
    db.select({
      log: auditLogs,
      user: {
        id: users.id,
        username: users.username,
        displayName: users.displayName
      }
    }).from(auditLogs).innerJoin(users, eq(auditLogs.userId, users.id)).where(where).orderBy(desc(auditLogs.createdAt)).limit(limit).offset(offset),
    countRows(db, auditLogs, where)
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
  return { items, total };
}
async function getPlatformStats(db) {
  var _a, _b, _c, _d, _e, _f;
  const [usersByRole, usersByStatus, contentByType, contentByStatus, hubCount, pendingReports, totalReports] = await Promise.all([
    db.select({ role: users.role, count: sql`count(*)::int` }).from(users).groupBy(users.role),
    db.select({ status: users.status, count: sql`count(*)::int` }).from(users).groupBy(users.status),
    db.select({ type: contentItems.type, count: sql`count(*)::int` }).from(contentItems).groupBy(contentItems.type),
    db.select({ status: contentItems.status, count: sql`count(*)::int` }).from(contentItems).groupBy(contentItems.status),
    db.select({ count: sql`count(*)::int` }).from(hubs),
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
    hubs: { total: (_b = (_a = hubCount[0]) == null ? void 0 : _a.count) != null ? _b : 0 },
    reports: {
      pending: (_d = (_c = pendingReports[0]) == null ? void 0 : _c.count) != null ? _d : 0,
      total: (_f = (_e = totalReports[0]) == null ? void 0 : _e.count) != null ? _f : 0
    }
  };
}
async function listUsers(db, filters = {}) {
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
  const { limit, offset } = normalizePagination(filters);
  const [rows, total] = await Promise.all([
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
    countRows(db, users, where)
  ]);
  return {
    items: rows,
    total
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
  const conditions = [];
  if (filters.status) {
    conditions.push(eq(reports.status, filters.status));
  }
  const where = conditions.length > 0 ? and(...conditions) : void 0;
  const { limit, offset } = normalizePagination(filters);
  const reviewerAlias = alias(users, "reviewer");
  const [rows, total] = await Promise.all([
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
    countRows(db, reports, where)
  ]);
  const items = rows.map((row) => {
    var _a;
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
      reviewer: ((_a = row.reviewer) == null ? void 0 : _a.id) ? { id: row.reviewer.id, username: row.reviewer.username } : null
    };
  });
  return { items, total };
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
          await tx.update(hubPosts).set({ likeCount: sql`GREATEST(${hubPosts.likeCount} - 1, 0)` }).where(eq(hubPosts.id, like.targetId));
          break;
        default:
          await tx.update(contentItems).set({ likeCount: sql`GREATEST(${contentItems.likeCount} - 1, 0)` }).where(eq(contentItems.id, like.targetId));
          break;
      }
    }
    const userComments = await tx.select({ targetType: comments.targetType, targetId: comments.targetId }).from(comments).where(eq(comments.authorId, userId));
    for (const comment of userComments) {
      if (comment.targetType === "post") {
        await tx.update(hubPosts).set({ replyCount: sql`GREATEST(${hubPosts.replyCount} - 1, 0)` }).where(eq(hubPosts.id, comment.targetId));
      } else {
        await tx.update(contentItems).set({ commentCount: sql`GREATEST(${contentItems.commentCount} - 1, 0)` }).where(eq(contentItems.id, comment.targetId));
      }
    }
    const memberships = await tx.select({ hubId: hubMembers.hubId }).from(hubMembers).where(eq(hubMembers.userId, userId));
    for (const m of memberships) {
      await tx.update(hubs).set({ memberCount: sql`GREATEST(${hubs.memberCount} - 1, 0)` }).where(eq(hubs.id, m.hubId));
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
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s;
  const rows = await db.select().from(users).where(eq(users.username, username)).limit(1);
  if (rows.length === 0)
    return null;
  const user = rows[0];
  const [contentCounts, viewLikeResult, followerResult, followingResult] = await Promise.all([
    db.select({
      type: contentItems.type,
      count: sql`count(*)::int`
    }).from(contentItems).where(and(eq(contentItems.authorId, user.id), eq(contentItems.status, "published"))).groupBy(contentItems.type),
    db.select({
      totalViews: sql`coalesce(sum(${contentItems.viewCount}), 0)::int`,
      totalLikes: sql`coalesce(sum(${contentItems.likeCount}), 0)::int`
    }).from(contentItems).where(and(eq(contentItems.authorId, user.id), eq(contentItems.status, "published"))),
    db.select({ count: sql`count(*)::int` }).from(follows).where(eq(follows.followingId, user.id)),
    db.select({ count: sql`count(*)::int` }).from(follows).where(eq(follows.followerId, user.id))
  ]);
  const countMap = {};
  for (const row of contentCounts) {
    countMap[row.type] = row.count;
  }
  const followerCount = (_b = (_a = followerResult[0]) == null ? void 0 : _a.count) != null ? _b : 0;
  const followingCount = (_d = (_c = followingResult[0]) == null ? void 0 : _c.count) != null ? _d : 0;
  const socialLinks = (_e = user.socialLinks) != null ? _e : null;
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    bio: (_f = user.bio) != null ? _f : null,
    headline: (_g = user.headline) != null ? _g : null,
    location: (_h = user.location) != null ? _h : null,
    website: (_i = user.website) != null ? _i : null,
    bannerUrl: (_j = user.bannerUrl) != null ? _j : null,
    socialLinks,
    skills: (_k = user.skills) != null ? _k : null,
    pronouns: (_l = user.pronouns) != null ? _l : null,
    createdAt: user.createdAt,
    followerCount,
    followingCount,
    viewCount: (_n = (_m = viewLikeResult[0]) == null ? void 0 : _m.totalViews) != null ? _n : 0,
    likeCount: (_p = (_o = viewLikeResult[0]) == null ? void 0 : _o.totalLikes) != null ? _p : 0,
    stats: {
      projects: (_q = countMap["project"]) != null ? _q : 0,
      explainers: (_r = countMap["explainer"]) != null ? _r : 0,
      articles: (_s = countMap["article"]) != null ? _s : 0,
      followers: followerCount,
      following: followingCount
    }
  };
}
async function updateUserProfile(db, userId, input) {
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
  if (existing.length === 0)
    return null;
  const updates = { updatedAt: /* @__PURE__ */ new Date() };
  if (input.displayName !== void 0)
    updates.displayName = input.displayName;
  if (input.bio !== void 0)
    updates.bio = input.bio;
  if (input.headline !== void 0)
    updates.headline = input.headline;
  if (input.location !== void 0)
    updates.location = input.location;
  if (input.website !== void 0)
    updates.website = input.website;
  if (input.avatarUrl !== void 0)
    updates.avatarUrl = input.avatarUrl;
  if (input.bannerUrl !== void 0)
    updates.bannerUrl = input.bannerUrl;
  if (input.socialLinks !== void 0)
    updates.socialLinks = input.socialLinks;
  if (input.skills !== void 0)
    updates.skills = input.skills;
  if (input.pronouns !== void 0)
    updates.pronouns = input.pronouns;
  if (input.timezone !== void 0)
    updates.timezone = input.timezone;
  if (input.emailNotifications !== void 0)
    updates.emailNotifications = input.emailNotifications;
  await db.update(users).set(updates).where(eq(users.id, userId));
  const user = await db.select({ username: users.username }).from(users).where(eq(users.id, userId)).limit(1);
  return getUserByUsername(db, user[0].username);
}
async function getUserContent(db, userId, type) {
  return listContent(db, {
    authorId: userId,
    status: "published",
    type,
    limit: 20
  });
}

var __defProp$1 = Object.defineProperty;
var __defNormalProp$1 = (obj, key, value) => key in obj ? __defProp$1(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$1 = (obj, key, value) => __defNormalProp$1(obj, typeof key !== "symbol" ? key + "" : key, value);
function buildCspDirectives(nonce) {
  const scriptSrc = "'self'";
  const styleSrc = "'self' 'unsafe-inline'";
  return {
    "default-src": "'self'",
    "script-src": scriptSrc,
    "style-src": styleSrc,
    "img-src": "'self' data: https:",
    "font-src": "'self'",
    "connect-src": "'self'",
    "frame-ancestors": "'none'",
    "base-uri": "'self'",
    "form-action": "'self'"
  };
}
function buildCspHeader(directives) {
  const dirs = directives != null ? directives : buildCspDirectives();
  return Object.entries(dirs).map(([key, value]) => `${key} ${value}`).join("; ");
}
function getSecurityHeaders(isDev) {
  const headers = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
  };
  {
    headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
  }
  return headers;
}
class RateLimitStore {
  constructor() {
    __publicField$1(this, "windows", /* @__PURE__ */ new Map());
    __publicField$1(this, "cleanupInterval", null);
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
  const conditions = [];
  if (filters.status) {
    conditions.push(eq(contests.status, filters.status));
  }
  const where = conditions.length > 0 ? and(...conditions) : void 0;
  const { limit, offset } = normalizePagination(filters);
  const [rows, total] = await Promise.all([
    db.select().from(contests).where(where).orderBy(desc(contests.startDate)).limit(limit).offset(offset),
    countRows(db, contests, where)
  ]);
  const items = rows.map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    bannerUrl: row.bannerUrl,
    status: row.status,
    startDate: row.startDate,
    endDate: row.endDate,
    entryCount: row.entryCount,
    createdAt: row.createdAt
  }));
  return { items, total };
}
async function getContestBySlug(db, slug) {
  var _a, _b;
  const rows = await db.select().from(contests).where(eq(contests.slug, slug)).limit(1);
  if (rows.length === 0)
    return null;
  const row = rows[0];
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    bannerUrl: row.bannerUrl,
    status: row.status,
    startDate: row.startDate,
    endDate: row.endDate,
    entryCount: row.entryCount,
    createdAt: row.createdAt,
    rules: row.rules,
    prizes: (_a = row.prizes) != null ? _a : null,
    judgingCriteria: null,
    judgingEndDate: row.judgingEndDate,
    judges: (_b = row.judges) != null ? _b : null,
    createdById: row.createdById
  };
}
async function createContest(db, input) {
  var _a, _b, _c, _d, _e, _f, _g;
  const [row] = await db.insert(contests).values({
    title: input.title,
    slug: input.slug,
    description: (_a = input.description) != null ? _a : null,
    rules: (_b = input.rules) != null ? _b : null,
    bannerUrl: (_c = input.bannerUrl) != null ? _c : null,
    prizes: (_d = input.prizes) != null ? _d : null,
    judges: (_e = input.judges) != null ? _e : null,
    startDate: new Date(input.startDate),
    endDate: new Date(input.endDate),
    judgingEndDate: input.judgingEndDate ? new Date(input.judgingEndDate) : null,
    createdById: input.createdBy
  }).returning();
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    bannerUrl: row.bannerUrl,
    status: row.status,
    startDate: row.startDate,
    endDate: row.endDate,
    entryCount: row.entryCount,
    createdAt: row.createdAt,
    rules: row.rules,
    prizes: (_f = row.prizes) != null ? _f : null,
    judgingCriteria: null,
    judgingEndDate: row.judgingEndDate,
    judges: (_g = row.judges) != null ? _g : null,
    createdById: row.createdById
  };
}
async function updateContest(db, slug, userId, data) {
  var _a;
  const existing = await db.select().from(contests).where(eq(contests.slug, slug)).limit(1);
  if (existing.length === 0)
    return null;
  if (existing[0].createdById !== userId)
    return null;
  const updates = { updatedAt: /* @__PURE__ */ new Date() };
  if (data.title !== void 0)
    updates.title = data.title;
  if (data.description !== void 0)
    updates.description = data.description;
  if (data.rules !== void 0)
    updates.rules = data.rules;
  if (data.bannerUrl !== void 0)
    updates.bannerUrl = data.bannerUrl;
  if (data.prizes !== void 0)
    updates.prizes = data.prizes;
  if (data.judges !== void 0)
    updates.judges = data.judges;
  if (data.startDate !== void 0)
    updates.startDate = new Date(data.startDate);
  if (data.endDate !== void 0)
    updates.endDate = new Date(data.endDate);
  await db.update(contests).set(updates).where(eq(contests.slug, slug));
  return getContestBySlug(db, (_a = data.slug) != null ? _a : slug);
}
async function listContestEntries(db, contestId) {
  const rows = await db.select({
    entry: contestEntries,
    content: {
      title: contentItems.title,
      slug: contentItems.slug,
      type: contentItems.type,
      coverImageUrl: contentItems.coverImageUrl
    },
    author: {
      displayName: users.displayName,
      username: users.username,
      avatarUrl: users.avatarUrl
    }
  }).from(contestEntries).innerJoin(contentItems, eq(contestEntries.contentId, contentItems.id)).innerJoin(users, eq(contestEntries.userId, users.id)).where(eq(contestEntries.contestId, contestId)).orderBy(desc(contestEntries.submittedAt));
  return rows.map((row) => {
    var _a;
    return {
      id: row.entry.id,
      contestId: row.entry.contestId,
      contentId: row.entry.contentId,
      userId: row.entry.userId,
      score: row.entry.score,
      rank: row.entry.rank,
      submittedAt: row.entry.submittedAt,
      contentTitle: row.content.title,
      contentSlug: row.content.slug,
      contentType: row.content.type,
      contentCoverImageUrl: row.content.coverImageUrl,
      authorName: (_a = row.author.displayName) != null ? _a : row.author.username,
      authorUsername: row.author.username,
      authorAvatarUrl: row.author.avatarUrl
    };
  });
}
async function submitContestEntry(db, contestId, contentId, userId) {
  var _a, _b, _c, _d, _e, _f, _g, _h;
  const contest = await db.select({ id: contests.id, status: contests.status }).from(contests).where(eq(contests.id, contestId)).limit(1);
  if (contest.length === 0)
    return null;
  if (contest[0].status !== "active")
    return null;
  const content = await db.select({ id: contentItems.id, authorId: contentItems.authorId, status: contentItems.status }).from(contentItems).where(eq(contentItems.id, contentId)).limit(1);
  if (content.length === 0)
    return null;
  if (content[0].status !== "published")
    return null;
  if (content[0].authorId !== userId)
    return null;
  const [row] = await db.insert(contestEntries).values({ contestId, contentId, userId }).onConflictDoNothing().returning();
  if (!row)
    return null;
  await db.update(contests).set({ entryCount: sql`${contests.entryCount} + 1` }).where(eq(contests.id, contestId));
  const enriched = await db.select({
    content: {
      title: contentItems.title,
      slug: contentItems.slug,
      type: contentItems.type,
      coverImageUrl: contentItems.coverImageUrl
    },
    author: {
      displayName: users.displayName,
      username: users.username,
      avatarUrl: users.avatarUrl
    }
  }).from(contentItems).innerJoin(users, eq(contentItems.authorId, users.id)).where(eq(contentItems.id, contentId)).limit(1);
  const info = enriched[0];
  return {
    id: row.id,
    contestId: row.contestId,
    contentId: row.contentId,
    userId: row.userId,
    score: row.score,
    rank: row.rank,
    submittedAt: row.submittedAt,
    contentTitle: (_a = info == null ? void 0 : info.content.title) != null ? _a : "Untitled",
    contentSlug: (_b = info == null ? void 0 : info.content.slug) != null ? _b : "",
    contentType: (_c = info == null ? void 0 : info.content.type) != null ? _c : "project",
    contentCoverImageUrl: (_d = info == null ? void 0 : info.content.coverImageUrl) != null ? _d : null,
    authorName: (_f = (_e = info == null ? void 0 : info.author.displayName) != null ? _e : info == null ? void 0 : info.author.username) != null ? _f : "Unknown",
    authorUsername: (_g = info == null ? void 0 : info.author.username) != null ? _g : "",
    authorAvatarUrl: (_h = info == null ? void 0 : info.author.avatarUrl) != null ? _h : null
  };
}
async function judgeContestEntry(db, entryId, score, judgeId, feedback) {
  var _a, _b;
  const existing = await db.select({
    entry: contestEntries,
    contestJudges: contests.judges,
    contestStatus: contests.status
  }).from(contestEntries).innerJoin(contests, eq(contestEntries.contestId, contests.id)).where(eq(contestEntries.id, entryId)).limit(1);
  if (existing.length === 0)
    return { judged: false, error: "Entry not found" };
  const row = existing[0];
  if (row.contestStatus !== "judging") {
    return { judged: false, error: "Contest is not in judging phase" };
  }
  const judges = (_a = row.contestJudges) != null ? _a : [];
  if (!judges.includes(judgeId)) {
    return { judged: false, error: "Not authorized to judge this contest" };
  }
  const entry = row.entry;
  const scores = (_b = entry.judgeScores) != null ? _b : [];
  const existingIdx = scores.findIndex((s) => s.judgeId === judgeId);
  if (existingIdx >= 0) {
    scores[existingIdx] = { judgeId, score, feedback };
  } else {
    scores.push({ judgeId, score, feedback });
  }
  const avgScore = Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length);
  await db.update(contestEntries).set({ judgeScores: scores, score: avgScore }).where(eq(contestEntries.id, entryId));
  return { judged: true };
}
async function deleteContest(db, contestId, userId) {
  const contest = await db.select({ createdById: contests.createdById }).from(contests).where(eq(contests.id, contestId)).limit(1);
  if (contest.length === 0)
    return false;
  if (contest[0].createdById !== userId)
    return false;
  await db.delete(contests).where(eq(contests.id, contestId));
  return true;
}
const VALID_TRANSITIONS = {
  upcoming: ["active"],
  active: ["judging"],
  judging: ["completed"],
  completed: []
};
async function transitionContestStatus(db, contestId, userId, newStatus) {
  var _a;
  const contest = await db.select({ createdById: contests.createdById, status: contests.status }).from(contests).where(eq(contests.id, contestId)).limit(1);
  if (contest.length === 0)
    return { transitioned: false, error: "Contest not found" };
  if (contest[0].createdById !== userId)
    return { transitioned: false, error: "Not the contest owner" };
  const currentStatus = contest[0].status;
  const allowed = (_a = VALID_TRANSITIONS[currentStatus]) != null ? _a : [];
  if (!allowed.includes(newStatus)) {
    return { transitioned: false, error: `Cannot transition from ${currentStatus} to ${newStatus}` };
  }
  await db.update(contests).set({
    status: newStatus,
    updatedAt: /* @__PURE__ */ new Date()
  }).where(eq(contests.id, contestId));
  return { transitioned: true };
}

async function listNotifications(db, filters) {
  const conditions = [eq(notifications.userId, filters.userId)];
  if (filters.type) {
    conditions.push(eq(notifications.type, filters.type));
  }
  if (filters.read !== void 0) {
    conditions.push(eq(notifications.read, filters.read));
  }
  const where = and(...conditions);
  const { limit, offset } = normalizePagination(filters);
  const [rows, total] = await Promise.all([
    db.select({
      notification: notifications,
      actorDisplayName: users.displayName,
      actorUsername: users.username
    }).from(notifications).leftJoin(users, eq(notifications.actorId, users.id)).where(where).orderBy(desc(notifications.createdAt)).limit(limit).offset(offset),
    countRows(db, notifications, where)
  ]);
  const items = rows.map((row) => {
    var _a, _b;
    return {
      id: row.notification.id,
      userId: row.notification.userId,
      type: row.notification.type,
      title: row.notification.title,
      message: row.notification.message,
      link: row.notification.link,
      actorId: row.notification.actorId,
      actorName: (_b = (_a = row.actorDisplayName) != null ? _a : row.actorUsername) != null ? _b : "Someone",
      read: row.notification.read,
      createdAt: row.notification.createdAt
    };
  });
  return { items, total };
}
async function getUnreadCount(db, userId) {
  var _a, _b;
  const result = await db.select({ count: sql`count(*)::int` }).from(notifications).where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
  return (_b = (_a = result[0]) == null ? void 0 : _a.count) != null ? _b : 0;
}
async function markNotificationRead(db, notificationId, userId) {
  await db.update(notifications).set({ read: true }).where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
}
async function markAllNotificationsRead(db, userId) {
  await db.update(notifications).set({ read: true }).where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
}
async function deleteNotification(db, notificationId, userId) {
  await db.delete(notifications).where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
}

async function listConversations(db, userId) {
  const rows = await db.select().from(conversations).where(sql`${conversations.participants} @> ${JSON.stringify([userId])}::jsonb`).orderBy(desc(conversations.lastMessageAt));
  return rows.map((row) => ({
    id: row.id,
    participants: row.participants,
    lastMessageAt: row.lastMessageAt,
    lastMessage: row.lastMessage,
    createdAt: row.createdAt
  }));
}
async function getConversationMessages(db, conversationId, userId) {
  const conv = await db.select().from(conversations).where(and(eq(conversations.id, conversationId), sql`${conversations.participants} @> ${JSON.stringify([userId])}::jsonb`)).limit(1);
  if (conv.length === 0)
    return [];
  const rows = await db.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(messages.createdAt);
  return rows.map((row) => ({
    id: row.id,
    conversationId: row.conversationId,
    senderId: row.senderId,
    body: row.body,
    createdAt: row.createdAt,
    readAt: row.readAt
  }));
}
async function createConversation(db, participants) {
  const [row] = await db.insert(conversations).values({
    participants
  }).returning();
  return {
    id: row.id,
    participants: row.participants,
    lastMessageAt: row.lastMessageAt,
    lastMessage: row.lastMessage,
    createdAt: row.createdAt
  };
}
async function sendMessage(db, conversationId, senderId, body) {
  const [row] = await db.insert(messages).values({
    conversationId,
    senderId,
    body
  }).returning();
  await db.update(conversations).set({
    lastMessageAt: /* @__PURE__ */ new Date(),
    lastMessage: body.length > 200 ? body.slice(0, 200) + "..." : body
  }).where(eq(conversations.id, conversationId));
  return {
    id: row.id,
    conversationId: row.conversationId,
    senderId: row.senderId,
    body: row.body,
    createdAt: row.createdAt,
    readAt: row.readAt
  };
}
async function markMessagesRead(db, conversationId, userId) {
  await db.update(messages).set({ readAt: /* @__PURE__ */ new Date() }).where(and(eq(messages.conversationId, conversationId), sql`${messages.senderId} != ${userId}`, isNull(messages.readAt)));
}

async function listVideos(db, filters = {}) {
  const conditions = [];
  if (filters.authorId) {
    conditions.push(eq(videos.authorId, filters.authorId));
  }
  const where = conditions.length > 0 ? and(...conditions) : void 0;
  const { limit, offset } = normalizePagination(filters);
  const [rows, total] = await Promise.all([
    db.select({
      video: videos,
      authorName: users.displayName,
      authorUsername: users.username
    }).from(videos).innerJoin(users, eq(videos.authorId, users.id)).where(where).orderBy(desc(videos.createdAt)).limit(limit).offset(offset),
    countRows(db, videos, where)
  ]);
  const items = rows.map((row) => ({
    id: row.video.id,
    title: row.video.title,
    url: row.video.url,
    embedUrl: row.video.embedUrl,
    platform: row.video.platform,
    thumbnailUrl: row.video.thumbnailUrl,
    duration: row.video.duration,
    viewCount: row.video.viewCount,
    likeCount: row.video.likeCount,
    commentCount: row.video.commentCount,
    authorId: row.video.authorId,
    authorName: row.authorName,
    authorUsername: row.authorUsername,
    createdAt: row.video.createdAt
  }));
  return { items, total };
}
async function getVideoById(db, id) {
  const rows = await db.select({
    video: videos,
    authorName: users.displayName,
    authorUsername: users.username
  }).from(videos).innerJoin(users, eq(videos.authorId, users.id)).where(eq(videos.id, id)).limit(1);
  if (rows.length === 0)
    return null;
  const row = rows[0];
  return {
    id: row.video.id,
    title: row.video.title,
    url: row.video.url,
    embedUrl: row.video.embedUrl,
    platform: row.video.platform,
    thumbnailUrl: row.video.thumbnailUrl,
    duration: row.video.duration,
    viewCount: row.video.viewCount,
    likeCount: row.video.likeCount,
    commentCount: row.video.commentCount,
    authorId: row.video.authorId,
    authorName: row.authorName,
    authorUsername: row.authorUsername,
    createdAt: row.video.createdAt,
    description: row.video.description
  };
}
async function createVideo(db, input) {
  var _a, _b, _c, _d, _e;
  const [row] = await db.insert(videos).values({
    title: input.title,
    url: input.url,
    description: (_a = input.description) != null ? _a : null,
    embedUrl: (_b = input.embedUrl) != null ? _b : null,
    platform: (_c = input.platform) != null ? _c : "youtube",
    thumbnailUrl: (_d = input.thumbnailUrl) != null ? _d : null,
    duration: (_e = input.duration) != null ? _e : null,
    authorId: input.authorId
  }).returning();
  return await getVideoById(db, row.id);
}
async function listVideoCategories(db) {
  const rows = await db.select({
    id: videoCategories.id,
    name: videoCategories.name,
    slug: videoCategories.slug
  }).from(videoCategories).orderBy(videoCategories.sortOrder);
  return rows;
}
async function createVideoCategory(db, input) {
  var _a, _b;
  const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const [row] = await db.insert(videoCategories).values({
    name: input.name,
    slug,
    description: (_a = input.description) != null ? _a : null,
    sortOrder: (_b = input.sortOrder) != null ? _b : 0
  }).returning();
  return { id: row.id, name: row.name, slug: row.slug };
}
async function updateVideoCategory(db, id, input) {
  const updates = {};
  if (input.name !== void 0) {
    updates.name = input.name;
    updates.slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }
  if (input.description !== void 0)
    updates.description = input.description;
  if (input.sortOrder !== void 0)
    updates.sortOrder = input.sortOrder;
  if (Object.keys(updates).length === 0)
    return null;
  const [row] = await db.update(videoCategories).set(updates).where(eq(videoCategories.id, id)).returning();
  if (!row)
    return null;
  return { id: row.id, name: row.name, slug: row.slug };
}
async function deleteVideoCategory(db, id) {
  const result = await db.delete(videoCategories).where(eq(videoCategories.id, id)).returning({ id: videoCategories.id });
  return result.length > 0;
}
async function incrementVideoViewCount(db, id) {
  await db.update(videos).set({ viewCount: sql`${videos.viewCount} + 1` }).where(eq(videos.id, id));
}

var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
function generateStorageKey(originalName, purpose) {
  const ext = originalName.includes(".") ? originalName.split(".").pop() : "";
  const id = randomUUID();
  return `${purpose}/${id}${ext ? `.${ext}` : ""}`;
}
class LocalStorageAdapter {
  constructor(basePath, baseUrl) {
    __publicField(this, "basePath");
    __publicField(this, "baseUrl");
    this.basePath = basePath;
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }
  async upload(key, data, _mimeType) {
    const filePath = join(this.basePath, key);
    await mkdir(dirname$1(filePath), { recursive: true });
    if (Buffer.isBuffer(data)) {
      const writeStream = createWriteStream(filePath);
      await new Promise((resolve, reject) => {
        writeStream.write(data, (err) => {
          if (err)
            reject(err);
          else {
            writeStream.end();
            resolve();
          }
        });
      });
    } else {
      const writeStream = createWriteStream(filePath);
      await pipeline(data, writeStream);
    }
    return this.getUrl(key);
  }
  async delete(key) {
    const filePath = join(this.basePath, key);
    try {
      await unlink$1(filePath);
    } catch (err) {
      if (err.code !== "ENOENT")
        throw err;
    }
  }
  getUrl(key) {
    return `${this.baseUrl}/uploads/${key}`;
  }
}
class S3StorageAdapter {
  constructor(config) {
    __publicField(this, "bucket");
    __publicField(this, "publicUrl");
    __publicField(this, "client", null);
    __publicField(this, "config");
    var _a;
    this.bucket = config.bucket;
    this.config = config;
    this.publicUrl = (_a = config.publicUrl) != null ? _a : config.endpoint ? `${config.endpoint}/${config.bucket}` : `https://${config.bucket}.s3.${config.region}.amazonaws.com`;
  }
  async getClient() {
    var _a;
    if (this.client)
      return this.client;
    const { S3Client } = await import('@aws-sdk/client-s3');
    this.client = new S3Client({
      region: this.config.region,
      endpoint: this.config.endpoint,
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey
      },
      forcePathStyle: (_a = this.config.forcePathStyle) != null ? _a : !!this.config.endpoint
    });
    return this.client;
  }
  async upload(key, data, mimeType) {
    let body;
    if (Buffer.isBuffer(data)) {
      body = data;
    } else {
      const chunks = [];
      for await (const chunk of data) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      body = Buffer.concat(chunks);
    }
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    const client = await this.getClient();
    await client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: mimeType,
      ACL: "public-read"
    }));
    return this.getUrl(key);
  }
  async delete(key) {
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    const client = await this.getClient();
    await client.send(new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key
    }));
  }
  getUrl(key) {
    return `${this.publicUrl}/${key}`;
  }
}
function createStorageFromEnv() {
  var _a, _b, _c, _d, _e, _f;
  const bucket = process.env.S3_BUCKET;
  if (bucket) {
    return new S3StorageAdapter({
      bucket,
      region: (_a = process.env.S3_REGION) != null ? _a : "us-east-1",
      endpoint: process.env.S3_ENDPOINT || void 0,
      accessKeyId: (_b = process.env.S3_ACCESS_KEY) != null ? _b : "",
      secretAccessKey: (_c = process.env.S3_SECRET_KEY) != null ? _c : "",
      publicUrl: process.env.S3_PUBLIC_URL || void 0,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true"
    });
  }
  const uploadDir = (_d = process.env.UPLOAD_DIR) != null ? _d : "./uploads";
  const siteUrl = (_f = (_e = process.env.SITE_URL) != null ? _e : process.env.NUXT_PUBLIC_SITE_URL) != null ? _f : "http://localhost:3000";
  return new LocalStorageAdapter(uploadDir, siteUrl);
}
const ALLOWED_IMAGE_TYPES = /* @__PURE__ */ new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp"
]);
const ALLOWED_MIME_TYPES = /* @__PURE__ */ new Set([
  ...ALLOWED_IMAGE_TYPES,
  "image/svg+xml",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/zip",
  "application/gzip"
]);
const MAX_UPLOAD_SIZES = {
  avatar: 2 * 1024 * 1024,
  // 2MB
  banner: 5 * 1024 * 1024,
  // 5MB
  cover: 10 * 1024 * 1024,
  // 10MB
  content: 10 * 1024 * 1024,
  // 10MB
  attachment: 100 * 1024 * 1024
  // 100MB
};
function validateUpload(mimeType, sizeBytes, purpose) {
  var _a, _b;
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return { valid: false, error: `File type ${mimeType} is not allowed` };
  }
  const maxSize = (_b = (_a = MAX_UPLOAD_SIZES[purpose]) != null ? _a : MAX_UPLOAD_SIZES["attachment"]) != null ? _b : 100 * 1024 * 1024;
  if (sizeBytes > maxSize) {
    return { valid: false, error: `File size exceeds maximum of ${Math.round(maxSize / 1024 / 1024)}MB` };
  }
  return { valid: true };
}
function isProcessableImage(mimeType) {
  return ALLOWED_IMAGE_TYPES.has(mimeType);
}

const IMAGE_VARIANTS = {
  thumb: 150,
  small: 300,
  medium: 600,
  large: 1200
};
async function processImage(data, originalName, purpose, storage) {
  var _a, _b, _c;
  const sharp = (await import('sharp')).default;
  const metadata = await sharp(data).metadata();
  const originalWidth = (_a = metadata.width) != null ? _a : 0;
  const originalHeight = (_b = metadata.height) != null ? _b : 0;
  const originalKey = generateStorageKey(originalName, purpose);
  const originalUrl = await storage.upload(originalKey, data, `image/${(_c = metadata.format) != null ? _c : "jpeg"}`);
  const variants = [];
  const variantEntries = Object.entries(IMAGE_VARIANTS);
  for (const [name, maxWidth] of variantEntries) {
    if (originalWidth > 0 && maxWidth >= originalWidth)
      continue;
    const resized = await sharp(data).resize(maxWidth, void 0, {
      fit: "inside",
      withoutEnlargement: true
    }).webp({ quality: 80 }).toBuffer();
    const variantKey = generateStorageKey(`${name}.webp`, `${purpose}/variants`);
    const url = await storage.upload(variantKey, resized, "image/webp");
    variants.push({ name, width: maxWidth, key: variantKey, url });
  }
  return {
    originalKey,
    originalUrl,
    width: originalWidth,
    height: originalHeight,
    variants
  };
}

class ConsoleEmailAdapter {
  async send(message) {
    var _a;
    console.log(`[EMAIL] To: ${message.to}`);
    console.log(`[EMAIL] Subject: ${message.subject}`);
    console.log(`[EMAIL] Body: ${(_a = message.text) != null ? _a : message.html.slice(0, 200)}`);
  }
}
function wrapTemplate(siteName, body) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 24px;">
    <div style="border-bottom:2px solid #5b9cf6;padding-bottom:16px;margin-bottom:24px;">
      <span style="font-family:'JetBrains Mono',monospace;font-size:14px;text-transform:uppercase;letter-spacing:2px;color:#5b9cf6;">${siteName}</span>
    </div>
    <div style="color:#e0e0e0;font-size:16px;line-height:1.7;">
      ${body}
    </div>
    <div style="border-top:1px solid #2a2a2a;margin-top:32px;padding-top:16px;color:#666;font-size:12px;">
      Sent by ${siteName}. You can manage your notification preferences in your settings.
    </div>
  </div>
</body>
</html>`;
}
const emailTemplates = {
  verification(siteName, verifyUrl) {
    return {
      to: "",
      subject: `Verify your email \u2014 ${siteName}`,
      html: wrapTemplate(siteName, `
        <h2 style="color:#fff;margin:0 0 16px;">Verify your email</h2>
        <p>Click the button below to verify your email address and activate your account.</p>
        <a href="${verifyUrl}" style="display:inline-block;background:#5b9cf6;color:#000;padding:12px 24px;text-decoration:none;font-weight:600;margin:16px 0;border:2px solid #5b9cf6;">Verify Email</a>
        <p style="color:#888;font-size:14px;">If you didn't create an account, you can safely ignore this email.</p>
      `),
      text: `Verify your email: ${verifyUrl}`
    };
  },
  passwordReset(siteName, resetUrl) {
    return {
      to: "",
      subject: `Reset your password \u2014 ${siteName}`,
      html: wrapTemplate(siteName, `
        <h2 style="color:#fff;margin:0 0 16px;">Reset your password</h2>
        <p>Click the button below to reset your password. This link expires in 1 hour.</p>
        <a href="${resetUrl}" style="display:inline-block;background:#5b9cf6;color:#000;padding:12px 24px;text-decoration:none;font-weight:600;margin:16px 0;border:2px solid #5b9cf6;">Reset Password</a>
        <p style="color:#888;font-size:14px;">If you didn't request this, you can safely ignore this email.</p>
      `),
      text: `Reset your password: ${resetUrl}`
    };
  },
  notificationDigest(siteName, username, notifications) {
    const items = notifications.map((n) => `<li style="margin-bottom:8px;"><a href="${n.url}" style="color:#5b9cf6;text-decoration:none;">${n.text}</a></li>`).join("");
    return {
      to: "",
      subject: `${notifications.length} new notification${notifications.length === 1 ? "" : "s"} \u2014 ${siteName}`,
      html: wrapTemplate(siteName, `
        <h2 style="color:#fff;margin:0 0 16px;">Hi ${username},</h2>
        <p>Here's what you missed:</p>
        <ul style="padding-left:20px;">${items}</ul>
      `),
      text: notifications.map((n) => `- ${n.text}: ${n.url}`).join("\n")
    };
  },
  contestAnnouncement(siteName, contestTitle, contestUrl, message) {
    return {
      to: "",
      subject: `${contestTitle} \u2014 ${siteName}`,
      html: wrapTemplate(siteName, `
        <h2 style="color:#fff;margin:0 0 16px;">${contestTitle}</h2>
        <p>${message}</p>
        <a href="${contestUrl}" style="display:inline-block;background:#5b9cf6;color:#000;padding:12px 24px;text-decoration:none;font-weight:600;margin:16px 0;border:2px solid #5b9cf6;">View Contest</a>
      `),
      text: `${contestTitle}: ${message}
${contestUrl}`
    };
  },
  certificateIssued(siteName, pathTitle, verificationCode, certificateUrl) {
    return {
      to: "",
      subject: `Certificate earned: ${pathTitle} \u2014 ${siteName}`,
      html: wrapTemplate(siteName, `
        <h2 style="color:#fff;margin:0 0 16px;">Congratulations!</h2>
        <p>You've earned a certificate for completing <strong>${pathTitle}</strong>.</p>
        <p>Verification code: <code style="background:#1a1a1a;padding:4px 8px;border:1px solid #333;color:#5b9cf6;">${verificationCode}</code></p>
        <a href="${certificateUrl}" style="display:inline-block;background:#5b9cf6;color:#000;padding:12px 24px;text-decoration:none;font-weight:600;margin:16px 0;border:2px solid #5b9cf6;">View Certificate</a>
      `),
      text: `Certificate earned for ${pathTitle}. Code: ${verificationCode}
${certificateUrl}`
    };
  }
};

let authMiddleware = null;
function getAuthMiddleware() {
  var _a;
  if (authMiddleware) return authMiddleware;
  const config = useConfig();
  const db = useDB();
  const runtimeConfig = useRuntimeConfig();
  const siteUrl = ((_a = runtimeConfig.public) == null ? void 0 : _a.siteUrl) || `https://${config.instance.domain}`;
  const siteName = config.instance.name || "CommonPub";
  const emailAdapter = new ConsoleEmailAdapter();
  const auth = createAuth({
    config,
    db,
    secret: (() => {
      const s = runtimeConfig.authSecret;
      if (!s && true) {
        throw new Error("AUTH_SECRET must be set in production");
      }
      return s || "dev-secret-change-me";
    })(),
    baseURL: siteUrl,
    emailSender: {
      async sendResetPasswordEmail(email, url, _token) {
        const template = emailTemplates.passwordReset(siteName, url);
        await emailAdapter.send({ ...template, to: email });
      },
      async sendVerificationEmail(email, url, _token) {
        const template = emailTemplates.verification(siteName, url);
        await emailAdapter.send({ ...template, to: email });
      }
    }
  });
  authMiddleware = createAuthMiddleware({ auth });
  return authMiddleware;
}
const _KEWnTz = defineEventHandler(async (event) => {
  const pathname = getRequestURL(event).pathname;
  if (!pathname.startsWith("/api") && !pathname.startsWith("/_nuxt")) {
    try {
      const middleware2 = getAuthMiddleware();
      const headers = getRequestHeaders(event);
      const webHeaders = new Headers(headers);
      event.context.auth = await middleware2.resolveSession(webHeaders);
    } catch {
      event.context.auth = { user: null, session: null };
    }
    return;
  }
  let middleware;
  try {
    middleware = getAuthMiddleware();
  } catch (err) {
    if (pathname.startsWith("/api/auth") || pathname.startsWith("/api/")) {
      throw createError$1({
        statusCode: 503,
        statusMessage: "Database unavailable. Check that PostgreSQL is running."
      });
    }
    event.context.auth = { user: null, session: null };
    return;
  }
  if (pathname.startsWith("/api/auth")) {
    try {
      const response = await middleware.handleAuthRoute(
        toWebRequest(event),
        pathname
      );
      if (response) {
        return sendWebResponse(event, response);
      }
    } catch (err) {
      throw createError$1({
        statusCode: 500,
        statusMessage: `Auth error: ${err instanceof Error ? err.message : "Unknown error"}`
      });
    }
  }
  try {
    const headers = getRequestHeaders(event);
    const webHeaders = new Headers(headers);
    event.context.auth = await middleware.resolveSession(webHeaders);
  } catch (err) {
    if (pathname.startsWith("/api/")) {
      console.error("[auth] Session resolution failed:", err instanceof Error ? err.message : err);
    }
    event.context.auth = { user: null, session: null };
  }
});

const store = new RateLimitStore();
const _8L1GON = defineEventHandler((event) => {
  var _a, _b;
  const url = getRequestURL(event);
  const pathname = url.pathname;
  if (shouldSkipRateLimit(pathname)) return;
  {
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
  }
  const headers = getSecurityHeaders();
  for (const [key, value] of Object.entries(headers)) {
    setResponseHeader(event, key, value);
  }
  if (!pathname.startsWith("/api/")) {
    const cspDirectives = buildCspDirectives();
    setResponseHeader(event, "Content-Security-Policy", buildCspHeader(cspDirectives));
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
const _lazy__LLe3t = () => import('../routes/api/cert/_code_.get.mjs');
const _lazy_TKf7yE = () => import('../routes/api/content/_id/build.post.mjs');
const _lazy_IMfpVg = () => import('../routes/api/content/_id/fork.post.mjs');
const _lazy_INWkw9 = () => import('../routes/api/content/index.delete.mjs');
const _lazy_IwW464 = () => import('../routes/api/content/index.get.mjs');
const _lazy_JVK3iP = () => import('../routes/api/content/index.put.mjs');
const _lazy_QDBZ5L = () => import('../routes/api/content/_id/products-sync.post.mjs');
const _lazy_COvTvp = () => import('../routes/api/content/_id/products.get.mjs');
const _lazy_DP4Ay7 = () => import('../routes/api/content/_id/products.post.mjs');
const _lazy_Cs2g1s = () => import('../routes/api/content/_id/products/_productId_.delete.mjs');
const _lazy_nvGW0A = () => import('../routes/api/content/_id/publish.post.mjs');
const _lazy_znufi_ = () => import('../routes/api/content/_id/report.post.mjs');
const _lazy_T1Or0I = () => import('../routes/api/content/_id/versions.get.mjs');
const _lazy_5xwqzL = () => import('../routes/api/content/_id/view.post.mjs');
const _lazy_x5oiU1 = () => import('../routes/api/index.get.mjs');
const _lazy_d1wpDk = () => import('../routes/api/index.post.mjs');
const _lazy_aWSNzD = () => import('../routes/api/contests/_slug/entries.get.mjs');
const _lazy_2Vbyzt = () => import('../routes/api/contests/_slug/entries.post.mjs');
const _lazy_1xBq08 = () => import('../routes/api/contests/index.delete.mjs');
const _lazy_b6CdKN = () => import('../routes/api/contests/index.get.mjs');
const _lazy_kZqaoT = () => import('../routes/api/contests/index.put.mjs');
const _lazy_KvT54o = () => import('../routes/api/contests/_slug/judge.post.mjs');
const _lazy_Vtturf = () => import('../routes/api/contests/_slug/transition.post.mjs');
const _lazy_DECgZ5 = () => import('../routes/api/index.get2.mjs');
const _lazy_XOr96X = () => import('../routes/api/index.post2.mjs');
const _lazy_P7zJOr = () => import('../routes/api/docs/index.delete.mjs');
const _lazy_ckimER = () => import('../routes/api/docs/index.get.mjs');
const _lazy_N18wUp = () => import('../routes/api/docs/index.put.mjs');
const _lazy_Lm1t5u = () => import('../routes/api/docs/_siteSlug/nav.get.mjs');
const _lazy_yebZZY = () => import('../routes/api/docs/_siteSlug/pages/_pageId_.delete.mjs');
const _lazy_smEu3A = () => import('../routes/api/docs/_siteSlug/pages/_pageId_.get.mjs');
const _lazy_uvwSIz = () => import('../routes/api/docs/_siteSlug/pages/_pageId_.put.mjs');
const _lazy_qY0m62 = () => import('../routes/api/docs/_siteSlug/index.get.mjs');
const _lazy_aAg05p = () => import('../routes/api/docs/_siteSlug/index.post.mjs');
const _lazy_onRcNH = () => import('../routes/api/docs/_siteSlug/pages/reorder.post.mjs');
const _lazy_kwKJ8K = () => import('../routes/api/docs/_siteSlug/search.get.mjs');
const _lazy_9ZpYPh = () => import('../routes/api/docs/_siteSlug/versions.post.mjs');
const _lazy_qgBaDe = () => import('../routes/api/index.get3.mjs');
const _lazy_d2gy1E = () => import('../routes/api/index.post3.mjs');
const _lazy_Tn0njh = () => import('../routes/api/files/_id_.delete.mjs');
const _lazy_TvYAs4 = () => import('../routes/api/files/mine.get.mjs');
const _lazy_inDOPa = () => import('../routes/api/files/upload.post.mjs');
const _lazy_Z1yxwm = () => import('../routes/api/health.get.mjs');
const _lazy_94SzjH = () => import('../routes/api/hubs/_slug/bans.get.mjs');
const _lazy_akeW7s = () => import('../routes/api/hubs/_slug/bans.post.mjs');
const _lazy_rpBiY6 = () => import('../routes/api/hubs/_slug/bans/_userId_.delete.mjs');
const _lazy_rJWQ_1 = () => import('../routes/api/hubs/_slug/feed.xml.get.mjs');
const _lazy_dnkjHg = () => import('../routes/api/hubs/_slug/gallery.get.mjs');
const _lazy_Cl0fdz = () => import('../routes/api/hubs/index.delete.mjs');
const _lazy_K0TlR8 = () => import('../routes/api/hubs/index.get.mjs');
const _lazy_9SfoLn = () => import('../routes/api/hubs/index.put.mjs');
const _lazy_PBg7X_ = () => import('../routes/api/hubs/_slug/invites.get.mjs');
const _lazy_gFIK_y = () => import('../routes/api/hubs/_slug/invites.post.mjs');
const _lazy_UuI17m = () => import('../routes/api/hubs/_slug/join.post.mjs');
const _lazy_qT8pYp = () => import('../routes/api/hubs/_slug/leave.post.mjs');
const _lazy_seQlVL = () => import('../routes/api/hubs/_slug/members.get.mjs');
const _lazy_P6keue = () => import('../routes/api/hubs/_slug/members/_userId_.delete.mjs');
const _lazy_vs5UWR = () => import('../routes/api/hubs/_slug/members/_userId_.put.mjs');
const _lazy_rmgBTp = () => import('../routes/api/hubs/_slug/posts/_postId_.delete.mjs');
const _lazy_Uwo27T = () => import('../routes/api/hubs/_slug/posts/_postId/replies.get.mjs');
const _lazy_9JGU7y = () => import('../routes/api/hubs/_slug/posts/_postId/replies.post.mjs');
const _lazy_HAAigD = () => import('../routes/api/hubs/_slug/index.get.mjs');
const _lazy_N4SgUN = () => import('../routes/api/hubs/_slug/index.post.mjs');
const _lazy_gBbnz3 = () => import('../routes/api/hubs/_slug/products.get.mjs');
const _lazy_RWRJ2C = () => import('../routes/api/hubs/_slug/products.post.mjs');
const _lazy_7kuZa4 = () => import('../routes/api/hubs/_slug/share.post.mjs');
const _lazy_CTfFMz = () => import('../routes/api/index.get4.mjs');
const _lazy_ScB6nf = () => import('../routes/api/index.post4.mjs');
const _lazy_OyZPOn = () => import('../routes/api/learn/_slug/_lessonSlug/complete.post.mjs');
const _lazy_IgP9s8 = () => import('../routes/api/learn/_slug/index.get.mjs');
const _lazy_DQT6YB = () => import('../routes/api/learn/_slug/enroll.post.mjs');
const _lazy_fMDPwz = () => import('../routes/api/learn/index.delete.mjs');
const _lazy_1vnyR0 = () => import('../routes/api/learn/index.get.mjs');
const _lazy_TrJryK = () => import('../routes/api/learn/index.put.mjs');
const _lazy_Rwf2_Q = () => import('../routes/api/learn/_slug/lessons.post.mjs');
const _lazy_X3v9gU = () => import('../routes/api/learn/_slug/lessons/_lessonId_.delete.mjs');
const _lazy_HcbV0j = () => import('../routes/api/learn/_slug/lessons/_lessonId_.put.mjs');
const _lazy_JWIgCr = () => import('../routes/api/learn/_slug/modules.post.mjs');
const _lazy_iZMtYH = () => import('../routes/api/learn/_slug/modules/_moduleId_.delete.mjs');
const _lazy_Lmvao6 = () => import('../routes/api/learn/_slug/modules/_moduleId_.put.mjs');
const _lazy_d1qV60 = () => import('../routes/api/learn/_slug/publish.post.mjs');
const _lazy_QicDxD = () => import('../routes/api/learn/_slug/unenroll.post.mjs');
const _lazy_R_OGzY = () => import('../routes/api/learn/certificates.get.mjs');
const _lazy_KegwTJ = () => import('../routes/api/learn/enrollments.get.mjs');
const _lazy_y83Zc3 = () => import('../routes/api/index.get5.mjs');
const _lazy_QJK2we = () => import('../routes/api/index.post5.mjs');
const _lazy_MJWCL7 = () => import('../routes/api/messages/_conversationId_.get.mjs');
const _lazy_bdtAxU = () => import('../routes/api/messages/_conversationId_.post.mjs');
const _lazy_j747yK = () => import('../routes/api/messages/_conversationId/info.get.mjs');
const _lazy_VTyKDL = () => import('../routes/api/messages/_conversationId/stream.get.mjs');
const _lazy_hB4OMw = () => import('../routes/api/index.get6.mjs');
const _lazy_FyqIjH = () => import('../routes/api/index.post6.mjs');
const _lazy_vP0SVO = () => import('../routes/api/notifications/_id_.delete.mjs');
const _lazy_25WxSl = () => import('../routes/api/notifications/count.get.mjs');
const _lazy_jIohCW = () => import('../routes/api/index.get7.mjs');
const _lazy_RPIH2G = () => import('../routes/api/notifications/read.post.mjs');
const _lazy_P11qqE = () => import('../routes/api/notifications/stream.get.mjs');
const _lazy_0RdBdA = () => import('../routes/api/openapi.get.mjs');
const _lazy_wrgU9F = () => import('../routes/api/products/_id_.delete.mjs');
const _lazy_w5HYlr = () => import('../routes/api/products/_id_.put.mjs');
const _lazy_HGXzkB = () => import('../routes/api/products/_slug_.get.mjs');
const _lazy_17IMid = () => import('../routes/api/products/_slug/content.get.mjs');
const _lazy_p6cYPD = () => import('../routes/api/index.get8.mjs');
const _lazy_hKnS3T = () => import('../routes/api/profile.get.mjs');
const _lazy_MjHZeY = () => import('../routes/api/profile.put.mjs');
const _lazy_0ZVjVg = () => import('../routes/api/index.get9.mjs');
const _lazy_GPSZVC = () => import('../routes/api/search/trending.get.mjs');
const _lazy_RZKWJe = () => import('../routes/api/social/bookmark.post.mjs');
const _lazy_NrrwiT = () => import('../routes/api/social/bookmarks.get.mjs');
const _lazy_zTkwK8 = () => import('../routes/api/social/comments.get.mjs');
const _lazy_j5WvfR = () => import('../routes/api/social/comments.post.mjs');
const _lazy_BFGQGB = () => import('../routes/api/social/comments/_id_.delete.mjs');
const _lazy_H_NnLL = () => import('../routes/api/social/like.get.mjs');
const _lazy__1MI6F = () => import('../routes/api/social/like.post.mjs');
const _lazy_9ZZaRw = () => import('../routes/api/stats.get.mjs');
const _lazy_H03rTy = () => import('../routes/api/users/_username_.get.mjs');
const _lazy_04EajR = () => import('../routes/api/users/_username/content.get.mjs');
const _lazy_cfktEX = () => import('../routes/api/users/_username/feed.xml.get.mjs');
const _lazy_0U6x7e = () => import('../routes/api/users/_username/follow.delete.mjs');
const _lazy_a9Dse6 = () => import('../routes/api/users/_username/follow.post.mjs');
const _lazy_v_BuVH = () => import('../routes/api/users/_username/followers.get.mjs');
const _lazy_E79g5r = () => import('../routes/api/users/_username/following.get.mjs');
const _lazy_f6FdTq = () => import('../routes/api/users/_username/learning.get.mjs');
const _lazy_nKJeMq = () => import('../routes/api/index.get10.mjs');
const _lazy_41m87_ = () => import('../routes/api/videos/_id_.get.mjs');
const _lazy_TNPVVm = () => import('../routes/api/videos/categories.get.mjs');
const _lazy_s07_Sv = () => import('../routes/api/videos/categories.post.mjs');
const _lazy_74X2_5 = () => import('../routes/api/videos/categories/_id_.delete.mjs');
const _lazy_a5Ikuo = () => import('../routes/api/videos/categories/_id_.put.mjs');
const _lazy_SM0QnG = () => import('../routes/api/index.get11.mjs');
const _lazy_V2m1Rm = () => import('../routes/api/index.post7.mjs');
const _lazy_UfE1f_ = () => import('../routes/.well-known/nodeinfo.mjs');
const _lazy_SYVK3d = () => import('../routes/.well-known/webfinger.mjs');
const _lazy_WOZO80 = () => import('../routes/feed.xml.mjs');
const _lazy_JOhz5F = () => import('../routes/inbox.mjs');
const _lazy_5I7kwM = () => import('../routes/nodeinfo/2.1.mjs');
const _lazy_DIF4QD = () => import('../routes/robots.txt.mjs');
const _lazy_nTomkI = () => import('../routes/sitemap.xml.mjs');
const _lazy_8dZriH = () => import('../routes/users/_username_.mjs');
const _lazy_iUTKuI = () => import('../routes/users/_username/followers.mjs');
const _lazy_8IfJxf = () => import('../routes/users/_username/following.mjs');
const _lazy_joGsUR = () => import('../routes/users/_username/inbox.mjs');
const _lazy_pgkIhY = () => import('../routes/users/_username/outbox.mjs');
const _lazy_oHgnvy = () => import('../routes/renderer.mjs').then(function (n) { return n.r; });

const handlers = [
  { route: '', handler: _1oFHXm, lazy: false, middleware: true, method: undefined },
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
  { route: '/api/cert/:code', handler: _lazy__LLe3t, lazy: true, middleware: false, method: "get" },
  { route: '/api/content/:id/build', handler: _lazy_TKf7yE, lazy: true, middleware: false, method: "post" },
  { route: '/api/content/:id/fork', handler: _lazy_IMfpVg, lazy: true, middleware: false, method: "post" },
  { route: '/api/content/:id', handler: _lazy_INWkw9, lazy: true, middleware: false, method: "delete" },
  { route: '/api/content/:id', handler: _lazy_IwW464, lazy: true, middleware: false, method: "get" },
  { route: '/api/content/:id', handler: _lazy_JVK3iP, lazy: true, middleware: false, method: "put" },
  { route: '/api/content/:id/products-sync', handler: _lazy_QDBZ5L, lazy: true, middleware: false, method: "post" },
  { route: '/api/content/:id/products', handler: _lazy_COvTvp, lazy: true, middleware: false, method: "get" },
  { route: '/api/content/:id/products', handler: _lazy_DP4Ay7, lazy: true, middleware: false, method: "post" },
  { route: '/api/content/:id/products/:productId', handler: _lazy_Cs2g1s, lazy: true, middleware: false, method: "delete" },
  { route: '/api/content/:id/publish', handler: _lazy_nvGW0A, lazy: true, middleware: false, method: "post" },
  { route: '/api/content/:id/report', handler: _lazy_znufi_, lazy: true, middleware: false, method: "post" },
  { route: '/api/content/:id/versions', handler: _lazy_T1Or0I, lazy: true, middleware: false, method: "get" },
  { route: '/api/content/:id/view', handler: _lazy_5xwqzL, lazy: true, middleware: false, method: "post" },
  { route: '/api/content', handler: _lazy_x5oiU1, lazy: true, middleware: false, method: "get" },
  { route: '/api/content', handler: _lazy_d1wpDk, lazy: true, middleware: false, method: "post" },
  { route: '/api/contests/:slug/entries', handler: _lazy_aWSNzD, lazy: true, middleware: false, method: "get" },
  { route: '/api/contests/:slug/entries', handler: _lazy_2Vbyzt, lazy: true, middleware: false, method: "post" },
  { route: '/api/contests/:slug', handler: _lazy_1xBq08, lazy: true, middleware: false, method: "delete" },
  { route: '/api/contests/:slug', handler: _lazy_b6CdKN, lazy: true, middleware: false, method: "get" },
  { route: '/api/contests/:slug', handler: _lazy_kZqaoT, lazy: true, middleware: false, method: "put" },
  { route: '/api/contests/:slug/judge', handler: _lazy_KvT54o, lazy: true, middleware: false, method: "post" },
  { route: '/api/contests/:slug/transition', handler: _lazy_Vtturf, lazy: true, middleware: false, method: "post" },
  { route: '/api/contests', handler: _lazy_DECgZ5, lazy: true, middleware: false, method: "get" },
  { route: '/api/contests', handler: _lazy_XOr96X, lazy: true, middleware: false, method: "post" },
  { route: '/api/docs/:siteSlug', handler: _lazy_P7zJOr, lazy: true, middleware: false, method: "delete" },
  { route: '/api/docs/:siteSlug', handler: _lazy_ckimER, lazy: true, middleware: false, method: "get" },
  { route: '/api/docs/:siteSlug', handler: _lazy_N18wUp, lazy: true, middleware: false, method: "put" },
  { route: '/api/docs/:siteSlug/nav', handler: _lazy_Lm1t5u, lazy: true, middleware: false, method: "get" },
  { route: '/api/docs/:siteSlug/pages/:pageId', handler: _lazy_yebZZY, lazy: true, middleware: false, method: "delete" },
  { route: '/api/docs/:siteSlug/pages/:pageId', handler: _lazy_smEu3A, lazy: true, middleware: false, method: "get" },
  { route: '/api/docs/:siteSlug/pages/:pageId', handler: _lazy_uvwSIz, lazy: true, middleware: false, method: "put" },
  { route: '/api/docs/:siteSlug/pages', handler: _lazy_qY0m62, lazy: true, middleware: false, method: "get" },
  { route: '/api/docs/:siteSlug/pages', handler: _lazy_aAg05p, lazy: true, middleware: false, method: "post" },
  { route: '/api/docs/:siteSlug/pages/reorder', handler: _lazy_onRcNH, lazy: true, middleware: false, method: "post" },
  { route: '/api/docs/:siteSlug/search', handler: _lazy_kwKJ8K, lazy: true, middleware: false, method: "get" },
  { route: '/api/docs/:siteSlug/versions', handler: _lazy_9ZpYPh, lazy: true, middleware: false, method: "post" },
  { route: '/api/docs', handler: _lazy_qgBaDe, lazy: true, middleware: false, method: "get" },
  { route: '/api/docs', handler: _lazy_d2gy1E, lazy: true, middleware: false, method: "post" },
  { route: '/api/files/:id', handler: _lazy_Tn0njh, lazy: true, middleware: false, method: "delete" },
  { route: '/api/files/mine', handler: _lazy_TvYAs4, lazy: true, middleware: false, method: "get" },
  { route: '/api/files/upload', handler: _lazy_inDOPa, lazy: true, middleware: false, method: "post" },
  { route: '/api/health', handler: _lazy_Z1yxwm, lazy: true, middleware: false, method: "get" },
  { route: '/api/hubs/:slug/bans', handler: _lazy_94SzjH, lazy: true, middleware: false, method: "get" },
  { route: '/api/hubs/:slug/bans', handler: _lazy_akeW7s, lazy: true, middleware: false, method: "post" },
  { route: '/api/hubs/:slug/bans/:userId', handler: _lazy_rpBiY6, lazy: true, middleware: false, method: "delete" },
  { route: '/api/hubs/:slug/feed.xml', handler: _lazy_rJWQ_1, lazy: true, middleware: false, method: "get" },
  { route: '/api/hubs/:slug/gallery', handler: _lazy_dnkjHg, lazy: true, middleware: false, method: "get" },
  { route: '/api/hubs/:slug', handler: _lazy_Cl0fdz, lazy: true, middleware: false, method: "delete" },
  { route: '/api/hubs/:slug', handler: _lazy_K0TlR8, lazy: true, middleware: false, method: "get" },
  { route: '/api/hubs/:slug', handler: _lazy_9SfoLn, lazy: true, middleware: false, method: "put" },
  { route: '/api/hubs/:slug/invites', handler: _lazy_PBg7X_, lazy: true, middleware: false, method: "get" },
  { route: '/api/hubs/:slug/invites', handler: _lazy_gFIK_y, lazy: true, middleware: false, method: "post" },
  { route: '/api/hubs/:slug/join', handler: _lazy_UuI17m, lazy: true, middleware: false, method: "post" },
  { route: '/api/hubs/:slug/leave', handler: _lazy_qT8pYp, lazy: true, middleware: false, method: "post" },
  { route: '/api/hubs/:slug/members', handler: _lazy_seQlVL, lazy: true, middleware: false, method: "get" },
  { route: '/api/hubs/:slug/members/:userId', handler: _lazy_P6keue, lazy: true, middleware: false, method: "delete" },
  { route: '/api/hubs/:slug/members/:userId', handler: _lazy_vs5UWR, lazy: true, middleware: false, method: "put" },
  { route: '/api/hubs/:slug/posts/:postId', handler: _lazy_rmgBTp, lazy: true, middleware: false, method: "delete" },
  { route: '/api/hubs/:slug/posts/:postId/replies', handler: _lazy_Uwo27T, lazy: true, middleware: false, method: "get" },
  { route: '/api/hubs/:slug/posts/:postId/replies', handler: _lazy_9JGU7y, lazy: true, middleware: false, method: "post" },
  { route: '/api/hubs/:slug/posts', handler: _lazy_HAAigD, lazy: true, middleware: false, method: "get" },
  { route: '/api/hubs/:slug/posts', handler: _lazy_N4SgUN, lazy: true, middleware: false, method: "post" },
  { route: '/api/hubs/:slug/products', handler: _lazy_gBbnz3, lazy: true, middleware: false, method: "get" },
  { route: '/api/hubs/:slug/products', handler: _lazy_RWRJ2C, lazy: true, middleware: false, method: "post" },
  { route: '/api/hubs/:slug/share', handler: _lazy_7kuZa4, lazy: true, middleware: false, method: "post" },
  { route: '/api/hubs', handler: _lazy_CTfFMz, lazy: true, middleware: false, method: "get" },
  { route: '/api/hubs', handler: _lazy_ScB6nf, lazy: true, middleware: false, method: "post" },
  { route: '/api/learn/:slug/:lessonSlug/complete', handler: _lazy_OyZPOn, lazy: true, middleware: false, method: "post" },
  { route: '/api/learn/:slug/:lessonSlug', handler: _lazy_IgP9s8, lazy: true, middleware: false, method: "get" },
  { route: '/api/learn/:slug/enroll', handler: _lazy_DQT6YB, lazy: true, middleware: false, method: "post" },
  { route: '/api/learn/:slug', handler: _lazy_fMDPwz, lazy: true, middleware: false, method: "delete" },
  { route: '/api/learn/:slug', handler: _lazy_1vnyR0, lazy: true, middleware: false, method: "get" },
  { route: '/api/learn/:slug', handler: _lazy_TrJryK, lazy: true, middleware: false, method: "put" },
  { route: '/api/learn/:slug/lessons', handler: _lazy_Rwf2_Q, lazy: true, middleware: false, method: "post" },
  { route: '/api/learn/:slug/lessons/:lessonId', handler: _lazy_X3v9gU, lazy: true, middleware: false, method: "delete" },
  { route: '/api/learn/:slug/lessons/:lessonId', handler: _lazy_HcbV0j, lazy: true, middleware: false, method: "put" },
  { route: '/api/learn/:slug/modules', handler: _lazy_JWIgCr, lazy: true, middleware: false, method: "post" },
  { route: '/api/learn/:slug/modules/:moduleId', handler: _lazy_iZMtYH, lazy: true, middleware: false, method: "delete" },
  { route: '/api/learn/:slug/modules/:moduleId', handler: _lazy_Lmvao6, lazy: true, middleware: false, method: "put" },
  { route: '/api/learn/:slug/publish', handler: _lazy_d1qV60, lazy: true, middleware: false, method: "post" },
  { route: '/api/learn/:slug/unenroll', handler: _lazy_QicDxD, lazy: true, middleware: false, method: "post" },
  { route: '/api/learn/certificates', handler: _lazy_R_OGzY, lazy: true, middleware: false, method: "get" },
  { route: '/api/learn/enrollments', handler: _lazy_KegwTJ, lazy: true, middleware: false, method: "get" },
  { route: '/api/learn', handler: _lazy_y83Zc3, lazy: true, middleware: false, method: "get" },
  { route: '/api/learn', handler: _lazy_QJK2we, lazy: true, middleware: false, method: "post" },
  { route: '/api/messages/:conversationId', handler: _lazy_MJWCL7, lazy: true, middleware: false, method: "get" },
  { route: '/api/messages/:conversationId', handler: _lazy_bdtAxU, lazy: true, middleware: false, method: "post" },
  { route: '/api/messages/:conversationId/info', handler: _lazy_j747yK, lazy: true, middleware: false, method: "get" },
  { route: '/api/messages/:conversationId/stream', handler: _lazy_VTyKDL, lazy: true, middleware: false, method: "get" },
  { route: '/api/messages', handler: _lazy_hB4OMw, lazy: true, middleware: false, method: "get" },
  { route: '/api/messages', handler: _lazy_FyqIjH, lazy: true, middleware: false, method: "post" },
  { route: '/api/notifications/:id', handler: _lazy_vP0SVO, lazy: true, middleware: false, method: "delete" },
  { route: '/api/notifications/count', handler: _lazy_25WxSl, lazy: true, middleware: false, method: "get" },
  { route: '/api/notifications', handler: _lazy_jIohCW, lazy: true, middleware: false, method: "get" },
  { route: '/api/notifications/read', handler: _lazy_RPIH2G, lazy: true, middleware: false, method: "post" },
  { route: '/api/notifications/stream', handler: _lazy_P11qqE, lazy: true, middleware: false, method: "get" },
  { route: '/api/openapi', handler: _lazy_0RdBdA, lazy: true, middleware: false, method: "get" },
  { route: '/api/products/:id', handler: _lazy_wrgU9F, lazy: true, middleware: false, method: "delete" },
  { route: '/api/products/:id', handler: _lazy_w5HYlr, lazy: true, middleware: false, method: "put" },
  { route: '/api/products/:slug', handler: _lazy_HGXzkB, lazy: true, middleware: false, method: "get" },
  { route: '/api/products/:slug/content', handler: _lazy_17IMid, lazy: true, middleware: false, method: "get" },
  { route: '/api/products', handler: _lazy_p6cYPD, lazy: true, middleware: false, method: "get" },
  { route: '/api/profile', handler: _lazy_hKnS3T, lazy: true, middleware: false, method: "get" },
  { route: '/api/profile', handler: _lazy_MjHZeY, lazy: true, middleware: false, method: "put" },
  { route: '/api/search', handler: _lazy_0ZVjVg, lazy: true, middleware: false, method: "get" },
  { route: '/api/search/trending', handler: _lazy_GPSZVC, lazy: true, middleware: false, method: "get" },
  { route: '/api/social/bookmark', handler: _lazy_RZKWJe, lazy: true, middleware: false, method: "post" },
  { route: '/api/social/bookmarks', handler: _lazy_NrrwiT, lazy: true, middleware: false, method: "get" },
  { route: '/api/social/comments', handler: _lazy_zTkwK8, lazy: true, middleware: false, method: "get" },
  { route: '/api/social/comments', handler: _lazy_j5WvfR, lazy: true, middleware: false, method: "post" },
  { route: '/api/social/comments/:id', handler: _lazy_BFGQGB, lazy: true, middleware: false, method: "delete" },
  { route: '/api/social/like', handler: _lazy_H_NnLL, lazy: true, middleware: false, method: "get" },
  { route: '/api/social/like', handler: _lazy__1MI6F, lazy: true, middleware: false, method: "post" },
  { route: '/api/stats', handler: _lazy_9ZZaRw, lazy: true, middleware: false, method: "get" },
  { route: '/api/users/:username', handler: _lazy_H03rTy, lazy: true, middleware: false, method: "get" },
  { route: '/api/users/:username/content', handler: _lazy_04EajR, lazy: true, middleware: false, method: "get" },
  { route: '/api/users/:username/feed.xml', handler: _lazy_cfktEX, lazy: true, middleware: false, method: "get" },
  { route: '/api/users/:username/follow', handler: _lazy_0U6x7e, lazy: true, middleware: false, method: "delete" },
  { route: '/api/users/:username/follow', handler: _lazy_a9Dse6, lazy: true, middleware: false, method: "post" },
  { route: '/api/users/:username/followers', handler: _lazy_v_BuVH, lazy: true, middleware: false, method: "get" },
  { route: '/api/users/:username/following', handler: _lazy_E79g5r, lazy: true, middleware: false, method: "get" },
  { route: '/api/users/:username/learning', handler: _lazy_f6FdTq, lazy: true, middleware: false, method: "get" },
  { route: '/api/users', handler: _lazy_nKJeMq, lazy: true, middleware: false, method: "get" },
  { route: '/api/videos/:id', handler: _lazy_41m87_, lazy: true, middleware: false, method: "get" },
  { route: '/api/videos/categories', handler: _lazy_TNPVVm, lazy: true, middleware: false, method: "get" },
  { route: '/api/videos/categories', handler: _lazy_s07_Sv, lazy: true, middleware: false, method: "post" },
  { route: '/api/videos/categories/:id', handler: _lazy_74X2_5, lazy: true, middleware: false, method: "delete" },
  { route: '/api/videos/categories/:id', handler: _lazy_a5Ikuo, lazy: true, middleware: false, method: "put" },
  { route: '/api/videos', handler: _lazy_SM0QnG, lazy: true, middleware: false, method: "get" },
  { route: '/api/videos', handler: _lazy_V2m1Rm, lazy: true, middleware: false, method: "post" },
  { route: '/.well-known/nodeinfo', handler: _lazy_UfE1f_, lazy: true, middleware: false, method: undefined },
  { route: '/.well-known/webfinger', handler: _lazy_SYVK3d, lazy: true, middleware: false, method: undefined },
  { route: '/feed.xml', handler: _lazy_WOZO80, lazy: true, middleware: false, method: undefined },
  { route: '/inbox', handler: _lazy_JOhz5F, lazy: true, middleware: false, method: undefined },
  { route: '/nodeinfo/2.1', handler: _lazy_5I7kwM, lazy: true, middleware: false, method: undefined },
  { route: '/robots.txt', handler: _lazy_DIF4QD, lazy: true, middleware: false, method: undefined },
  { route: '/sitemap.xml', handler: _lazy_nTomkI, lazy: true, middleware: false, method: undefined },
  { route: '/users/:username', handler: _lazy_8dZriH, lazy: true, middleware: false, method: undefined },
  { route: '/users/:username/followers', handler: _lazy_iUTKuI, lazy: true, middleware: false, method: undefined },
  { route: '/users/:username/following', handler: _lazy_8IfJxf, lazy: true, middleware: false, method: undefined },
  { route: '/users/:username/inbox', handler: _lazy_joGsUR, lazy: true, middleware: false, method: undefined },
  { route: '/users/:username/outbox', handler: _lazy_pgkIhY, lazy: true, middleware: false, method: undefined },
  { route: '/__nuxt_error', handler: _lazy_oHgnvy, lazy: true, middleware: false, method: undefined },
  { route: '/__nuxt_island/**', handler: _SxA8c9, lazy: false, middleware: false, method: undefined },
  { route: '/**', handler: _lazy_oHgnvy, lazy: true, middleware: false, method: undefined }
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

export { judgeEntrySchema as $, readBody as A, syncContentProducts as B, listContentProducts as C, addContentProduct as D, addContentProductSchema as E, removeContentProduct as F, useConfig as G, publishContent as H, onContentPublished as I, createReportSchema as J, createReport as K, listContentVersions as L, incrementViewCount as M, listContent as N, contentFiltersSchema as O, createContent as P, createContentSchema as Q, getContestBySlug as R, listContestEntries as S, submitContestEntry as T, deleteContest as U, getRequestHeader as V, getQuery as W, getRouterParam as X, updateContest as Y, updateContestSchema as Z, judgeContestEntry as _, listReports as a, createProductSchema as a$, transitionContestStatus as a0, contestTransitionSchema as a1, listContests as a2, contestFiltersSchema as a3, createContest as a4, createContestSchema as a5, getDocsSiteBySlug as a6, deleteDocsSite as a7, updateDocsSite as a8, updateDocsSiteSchema as a9, listHubGallery as aA, setResponseHeader as aB, useRuntimeConfig as aC, deleteHub as aD, updateHub as aE, updateHubSchema as aF, listInvites as aG, createInvite as aH, createInviteSchema as aI, joinHub as aJ, leaveHub as aK, listMembers as aL, kickMember as aM, changeRole as aN, changeRoleSchema as aO, deletePost as aP, listReplies as aQ, createReplySchema as aR, createReply as aS, listPosts as aT, hubPostFiltersSchema as aU, createPost as aV, createPostSchema as aW, listHubProducts as aX, productStatusSchema as aY, productCategorySchema as aZ, createProduct as a_, listDocsPages as aa, deleteDocsPage as ab, renderMarkdown as ac, updateDocsPage as ad, updateDocsPageSchema as ae, createDocsPage as af, createDocsPageSchema as ag, reorderDocsPages as ah, searchDocsPages as ai, createDocsVersion as aj, createDocsVersionSchema as ak, listDocsSites as al, createDocsSite as am, createDocsSiteSchema as an, files as ao, createStorageFromEnv as ap, readMultipartFormData as aq, validateUpload as ar, isProcessableImage as as, processImage as at, generateStorageKey as au, getHubBySlug as av, listBans as aw, banUser as ax, banUserSchema as ay, unbanUser as az, resolveReport as b, getUserContent as b$, shareContent as b0, listHubs as b1, hubFiltersSchema as b2, createHub as b3, createHubSchema as b4, getLessonBySlug as b5, markLessonComplete as b6, getPathBySlug as b7, enroll as b8, deletePath as b9, createConversationSchema as bA, deleteNotification as bB, getUnreadCount as bC, listNotifications as bD, markNotificationRead as bE, markAllNotificationsRead as bF, generateOpenAPISpec as bG, deleteProduct as bH, updateProduct as bI, updateProductSchema as bJ, getProductBySlug as bK, listProductContent as bL, searchProducts as bM, getUserByUsername as bN, updateUserProfile as bO, updateProfileSchema as bP, toggleBookmark as bQ, listUserBookmarks as bR, listComments as bS, commentTargetTypeSchema as bT, createComment as bU, createCommentSchema as bV, deleteComment as bW, isLiked as bX, likeTargetTypeSchema as bY, toggleLike as bZ, isFollowing as b_, updatePath as ba, updateLearningPathSchema as bb, createLesson as bc, createLessonSchema as bd, deleteLesson as be, updateLesson as bf, createModule as bg, createModuleSchema as bh, deleteModule as bi, updateModule as bj, updateModuleSchema as bk, publishPath as bl, unenroll as bm, getUserCertificates as bn, getUserEnrollments as bo, listPaths as bp, learningPathFiltersSchema as bq, createPath as br, createLearningPathSchema as bs, getConversationMessages as bt, markMessagesRead as bu, sendMessage as bv, sendMessageSchema as bw, conversations as bx, listConversations as by, createConversation as bz, resolveReportSchema as c, contentTypeSchema as c0, unfollowUser as c1, followUser as c2, listFollowers as c3, listFollowing as c4, users as c5, follows as c6, getVideoById as c7, incrementVideoViewCount as c8, listVideoCategories as c9, getRequestHeaders as cA, hasProtocol as cB, isScriptProtocol as cC, parseQuery as cD, withQuery as cE, sanitizeStatusCode as cF, parseURL as cG, encodePath as cH, decodePath as cI, getContext as cJ, withTrailingSlash as cK, withoutTrailingSlash as cL, $fetch as cM, createHooks as cN, defu as cO, executeAsync as cP, hash$1 as cQ, nodeServer as cR, createVideoCategory as ca, createVideoCategorySchema as cb, deleteVideoCategory as cc, updateVideoCategory as cd, listVideos as ce, videoFiltersSchema as cf, createVideo as cg, createVideoSchema as ch, getRequestURL as ci, parseWebFingerResource as cj, buildWebFingerResponse as ck, getMethod as cl, processInboxActivity as cm, buildNodeInfoResponse as cn, sendRedirect as co, getOrCreateActorKeypair as cp, getFollowers as cq, getFollowing as cr, generateOutboxCollection as cs, joinRelativeURL as ct, getResponseStatusText as cu, getResponseStatus as cv, defineRenderHandler as cw, getRouteRules as cx, joinURL as cy, useNitroApp as cz, defineEventHandler as d, adminSettingSchema as e, getPlatformStats as f, getInstanceSettings as g, listUsers as h, deleteUser as i, updateUserRole as j, adminUpdateRoleSchema as k, listAuditLogs as l, updateUserStatus as m, adminUpdateStatusSchema as n, getCertificateByCode as o, createError$1 as p, forkContent as q, removeContent as r, setInstanceSetting as s, toggleBuildMark as t, useDB as u, deleteContent as v, getContentBySlug as w, updateContent as x, updateContentSchema as y, contentItems as z };
//# sourceMappingURL=nitro.mjs.map
