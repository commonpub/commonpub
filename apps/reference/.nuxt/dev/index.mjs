import process from 'node:process';globalThis._importMeta_={url:import.meta.url,env:process.env};import { tmpdir } from 'node:os';
import { defineEventHandler, handleCacheHeaders, splitCookiesString, createEvent, fetchWithEvent, isEvent, eventHandler, setHeaders, sendRedirect, proxyRequest, getRequestHeader, setResponseHeaders, setResponseStatus, send, getRequestHeaders, setResponseHeader, appendResponseHeader, getRequestURL, getResponseHeader, removeResponseHeader, createError, toWebRequest, sendWebResponse, getQuery as getQuery$1, readBody, createApp, createRouter as createRouter$1, toNodeListener, lazyEventHandler, getResponseStatus, getRouterParam, readMultipartFormData, getMethod, getResponseStatusText } from 'file:///Users/obsidian/Projects/ossuary-projects/snaplify/node_modules/.pnpm/h3@1.15.6/node_modules/h3/dist/index.mjs';
import { Server } from 'node:http';
import { resolve, dirname, join } from 'node:path';
import nodeCrypto from 'node:crypto';
import { parentPort, threadId } from 'node:worker_threads';
import { escapeHtml } from 'file:///Users/obsidian/Projects/ossuary-projects/snaplify/node_modules/.pnpm/@vue+shared@3.5.30/node_modules/@vue/shared/dist/shared.cjs.js';
import { ConsoleEmailAdapter, emailTemplates, shouldSkipRateLimit, checkRateLimit, RateLimitStore, generateNonce, getSecurityHeaders, listAuditLogs, removeContent, listReports, resolveReport, getInstanceSettings, setInstanceSetting, getPlatformStats, listUsers, deleteUser, updateUserRole, updateUserStatus, toggleBuildMark, forkContent, deleteContent, getContentBySlug, updateContent, syncContentProducts, listContentProducts, addContentProduct, removeContentProduct, publishContent, onContentPublished, createReport, listContentVersions, incrementViewCount, listContent, createContent, getContestBySlug, listContestEntries, submitContestEntry, deleteContest, updateContest, judgeContestEntry, transitionContestStatus, listContests, createContest, getDocsSiteBySlug, deleteDocsSite, updateDocsSite, getDocsNav, listDocsPages, createDocsPage, updateDocsPage, searchDocsPages, createDocsVersion, listDocsSites, createDocsSite, createStorageFromEnv, validateUpload, isProcessableImage, processImage, generateStorageKey, getHubBySlug, listBans, banUser, unbanUser, listHubGallery, deleteHub, updateHub, listInvites, createInvite, joinHub, leaveHub, listMembers, kickMember, changeRole, deletePost, listReplies, createReply, listPosts, createPost, listHubProducts, createProduct, shareContent, listHubs, createHub, getLessonBySlug, markLessonComplete, getPathBySlug, enroll, deletePath, updatePath, createLesson, deleteLesson, createModule, deleteModule, updateModule, publishPath, unenroll, getUserCertificates, getUserEnrollments, listPaths, createPath, getConversationMessages, markMessagesRead, sendMessage, listConversations, createConversation, deleteNotification, getUnreadCount, listNotifications, markNotificationRead, markAllNotificationsRead, deleteProduct, updateProduct, getProductBySlug, listProductContent, searchProducts, getUserByUsername, updateUserProfile, toggleBookmark, listUserBookmarks, listComments, createComment, deleteComment, isLiked, toggleLike, getUserContent, unfollowUser, followUser, listFollowers, listFollowing, getVideoById, incrementVideoViewCount, listVideoCategories, createVideoCategory, deleteVideoCategory, updateVideoCategory, listVideos, createVideo, getOrCreateActorKeypair, getFollowers, getFollowing } from 'file:///Users/obsidian/Projects/ossuary-projects/snaplify/packages/server/dist/index.js';
import { z } from 'file:///Users/obsidian/Projects/ossuary-projects/snaplify/node_modules/.pnpm/zod@4.3.6/node_modules/zod/index.js';
import * as schema from 'file:///Users/obsidian/Projects/ossuary-projects/snaplify/packages/schema/dist/index.js';
import { resolveReportSchema, adminSettingSchema, adminUpdateRoleSchema, adminUpdateStatusSchema, updateContentSchema, addContentProductSchema, createReportSchema, contentFiltersSchema, createContentSchema, updateContestSchema, judgeEntrySchema, contestTransitionSchema, contestFiltersSchema, createContestSchema, updateDocsSiteSchema, createDocsPageSchema, updateDocsPageSchema, createDocsVersionSchema, createDocsSiteSchema, files, banUserSchema, updateHubSchema, createInviteSchema, changeRoleSchema, createReplySchema, hubPostFiltersSchema, createPostSchema, productStatusSchema, productCategorySchema, createProductSchema, hubFiltersSchema, createHubSchema, updateLearningPathSchema, createLessonSchema, createModuleSchema, updateModuleSchema, learningPathFiltersSchema, createLearningPathSchema, sendMessageSchema, createConversationSchema, generateOpenAPISpec, updateProductSchema, updateProfileSchema, contentItems, commentTargetTypeSchema, createCommentSchema, likeTargetTypeSchema, contentTypeSchema, users, follows, createVideoCategorySchema, videoFiltersSchema, createVideoSchema } from 'file:///Users/obsidian/Projects/ossuary-projects/snaplify/packages/schema/dist/index.js';
import { and, eq, desc, sql, or, ilike } from 'file:///Users/obsidian/Projects/ossuary-projects/snaplify/node_modules/.pnpm/drizzle-orm@0.45.1_@electric-sql+pglite@0.3.16_gel@2.2.0_kysely@0.28.11_pg@8.20.0/node_modules/drizzle-orm/index.js';
import { parseWebFingerResource, buildWebFingerResponse, processInboxActivity, buildNodeInfoResponse, generateOutboxCollection } from 'file:///Users/obsidian/Projects/ossuary-projects/snaplify/packages/protocol/dist/index.js';
import { createRenderer, getRequestDependencies, getPreloadLinks, getPrefetchLinks } from 'file:///Users/obsidian/Projects/ossuary-projects/snaplify/node_modules/.pnpm/vue-bundle-renderer@2.2.0/node_modules/vue-bundle-renderer/dist/runtime.mjs';
import { parseURL, withoutBase, joinURL, getQuery, withQuery, withTrailingSlash, decodePath, withLeadingSlash, withoutTrailingSlash, joinRelativeURL } from 'file:///Users/obsidian/Projects/ossuary-projects/snaplify/node_modules/.pnpm/ufo@1.6.3/node_modules/ufo/dist/index.mjs';
import { renderToString } from 'file:///Users/obsidian/Projects/ossuary-projects/snaplify/node_modules/.pnpm/vue@3.5.30_typescript@5.9.3/node_modules/vue/server-renderer/index.mjs';
import destr, { destr as destr$1 } from 'file:///Users/obsidian/Projects/ossuary-projects/snaplify/node_modules/.pnpm/destr@2.0.5/node_modules/destr/dist/index.mjs';
import { createHooks } from 'file:///Users/obsidian/Projects/ossuary-projects/snaplify/node_modules/.pnpm/hookable@5.5.3/node_modules/hookable/dist/index.mjs';
import { createFetch, Headers as Headers$1 } from 'file:///Users/obsidian/Projects/ossuary-projects/snaplify/node_modules/.pnpm/ofetch@1.5.1/node_modules/ofetch/dist/node.mjs';
import { fetchNodeRequestHandler, callNodeRequestHandler } from 'file:///Users/obsidian/Projects/ossuary-projects/snaplify/node_modules/.pnpm/node-mock-http@1.0.4/node_modules/node-mock-http/dist/index.mjs';
import { createStorage, prefixStorage } from 'file:///Users/obsidian/Projects/ossuary-projects/snaplify/node_modules/.pnpm/unstorage@1.17.4_db0@0.3.4_@electric-sql+pglite@0.3.16_drizzle-orm@0.45.1_@electric-sql_6cb075aec0620e2b524a33784b1bab62/node_modules/unstorage/dist/index.mjs';
import unstorage_47drivers_47fs from 'file:///Users/obsidian/Projects/ossuary-projects/snaplify/node_modules/.pnpm/unstorage@1.17.4_db0@0.3.4_@electric-sql+pglite@0.3.16_drizzle-orm@0.45.1_@electric-sql_6cb075aec0620e2b524a33784b1bab62/node_modules/unstorage/drivers/fs.mjs';
import { digest } from 'file:///Users/obsidian/Projects/ossuary-projects/snaplify/node_modules/.pnpm/ohash@2.0.11/node_modules/ohash/dist/index.mjs';
import { klona } from 'file:///Users/obsidian/Projects/ossuary-projects/snaplify/node_modules/.pnpm/klona@2.0.6/node_modules/klona/dist/index.mjs';
import defu, { defuFn } from 'file:///Users/obsidian/Projects/ossuary-projects/snaplify/node_modules/.pnpm/defu@6.1.4/node_modules/defu/dist/defu.mjs';
import { snakeCase } from 'file:///Users/obsidian/Projects/ossuary-projects/snaplify/node_modules/.pnpm/scule@1.3.0/node_modules/scule/dist/index.mjs';
import { getContext } from 'file:///Users/obsidian/Projects/ossuary-projects/snaplify/node_modules/.pnpm/unctx@2.5.0/node_modules/unctx/dist/index.mjs';
import { toRouteMatcher, createRouter } from 'file:///Users/obsidian/Projects/ossuary-projects/snaplify/node_modules/.pnpm/radix3@1.1.2/node_modules/radix3/dist/index.mjs';
import { readFile } from 'node:fs/promises';
import consola, { consola as consola$1 } from 'file:///Users/obsidian/Projects/ossuary-projects/snaplify/node_modules/.pnpm/consola@3.4.2/node_modules/consola/dist/index.mjs';
import { ErrorParser } from 'file:///Users/obsidian/Projects/ossuary-projects/snaplify/node_modules/.pnpm/youch-core@0.3.3/node_modules/youch-core/build/index.js';
import { Youch } from 'file:///Users/obsidian/Projects/ossuary-projects/snaplify/node_modules/.pnpm/youch@4.1.0/node_modules/youch/build/index.js';
import { SourceMapConsumer } from 'file:///Users/obsidian/Projects/ossuary-projects/snaplify/node_modules/.pnpm/source-map@0.7.6/node_modules/source-map/source-map.js';
import { AsyncLocalStorage } from 'node:async_hooks';
import { stringify, uneval } from 'file:///Users/obsidian/Projects/ossuary-projects/snaplify/node_modules/.pnpm/devalue@5.6.4/node_modules/devalue/index.js';
import { captureRawStackTrace, parseRawStackTrace } from 'file:///Users/obsidian/Projects/ossuary-projects/snaplify/node_modules/.pnpm/errx@0.1.0/node_modules/errx/dist/index.js';
import { isVNode, isRef, toValue } from 'file:///Users/obsidian/Projects/ossuary-projects/snaplify/node_modules/.pnpm/vue@3.5.30_typescript@5.9.3/node_modules/vue/index.mjs';
import { promises } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname as dirname$1, resolve as resolve$1 } from 'file:///Users/obsidian/Projects/ossuary-projects/snaplify/node_modules/.pnpm/pathe@2.0.3/node_modules/pathe/dist/index.mjs';
import { defineCommonPubConfig } from 'file:///Users/obsidian/Projects/ossuary-projects/snaplify/packages/config/dist/index.js';
import { drizzle } from 'file:///Users/obsidian/Projects/ossuary-projects/snaplify/node_modules/.pnpm/drizzle-orm@0.45.1_@electric-sql+pglite@0.3.16_gel@2.2.0_kysely@0.28.11_pg@8.20.0/node_modules/drizzle-orm/node-postgres/index.js';
import pg from 'file:///Users/obsidian/Projects/ossuary-projects/snaplify/node_modules/.pnpm/pg@8.20.0/node_modules/pg/esm/index.mjs';
import { createAuth, createAuthMiddleware } from 'file:///Users/obsidian/Projects/ossuary-projects/snaplify/packages/auth/dist/index.js';
import { createHead as createHead$1, propsToString, renderSSRHead } from 'file:///Users/obsidian/Projects/ossuary-projects/snaplify/node_modules/.pnpm/unhead@2.1.12/node_modules/unhead/dist/server.mjs';
import { DeprecationsPlugin, PromisesPlugin, TemplateParamsPlugin, AliasSortingPlugin } from 'file:///Users/obsidian/Projects/ossuary-projects/snaplify/node_modules/.pnpm/unhead@2.1.12/node_modules/unhead/dist/plugins.mjs';
import { walkResolver } from 'file:///Users/obsidian/Projects/ossuary-projects/snaplify/node_modules/.pnpm/unhead@2.1.12/node_modules/unhead/dist/utils.mjs';

const serverAssets = [{"baseName":"server","dir":"/Users/obsidian/Projects/ossuary-projects/snaplify/apps/reference/server/assets"}];

const assets$1 = createStorage();

for (const asset of serverAssets) {
  assets$1.mount(asset.baseName, unstorage_47drivers_47fs({ base: asset.dir, ignore: (asset?.ignore || []) }));
}

const storage$2 = createStorage({});

storage$2.mount('/assets', assets$1);

storage$2.mount('root', unstorage_47drivers_47fs({"driver":"fs","readOnly":true,"base":"/Users/obsidian/Projects/ossuary-projects/snaplify/apps/reference","watchOptions":{"ignored":[null]}}));
storage$2.mount('src', unstorage_47drivers_47fs({"driver":"fs","readOnly":true,"base":"/Users/obsidian/Projects/ossuary-projects/snaplify/apps/reference/server","watchOptions":{"ignored":[null]}}));
storage$2.mount('build', unstorage_47drivers_47fs({"driver":"fs","readOnly":false,"base":"/Users/obsidian/Projects/ossuary-projects/snaplify/apps/reference/.nuxt"}));
storage$2.mount('cache', unstorage_47drivers_47fs({"driver":"fs","readOnly":false,"base":"/Users/obsidian/Projects/ossuary-projects/snaplify/apps/reference/.nuxt/cache"}));
storage$2.mount('data', unstorage_47drivers_47fs({"driver":"fs","base":"/Users/obsidian/Projects/ossuary-projects/snaplify/apps/reference/.data/kv"}));

function useStorage(base = "") {
  return base ? prefixStorage(storage$2, base) : storage$2;
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

const inlineAppConfig = {
  "nuxt": {}
};



const appConfig = defuFn(inlineAppConfig);

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
    "buildId": "dev",
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

getContext("nitro-app", {
  asyncContext: false,
  AsyncLocalStorage: void 0
});

const config = useRuntimeConfig();
const _routeRulesMatcher = toRouteMatcher(
  createRouter({ routes: config.nitro.routeRules })
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
        const query = getQuery(event.path);
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
        const query = getQuery(event.path);
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

const iframeStorageBridge = (nonce) => `
(function () {
  const NONCE = ${JSON.stringify(nonce)};
  const memoryStore = Object.create(null);

  const post = (type, payload) => {
    window.parent.postMessage({ type, nonce: NONCE, ...payload }, '*');
  };

  const isValid = (data) => data && data.nonce === NONCE;

  const mockStorage = {
    getItem(key) {
      return Object.hasOwn(memoryStore, key)
        ? memoryStore[key]
        : null;
    },
    setItem(key, value) {
      const v = String(value);
      memoryStore[key] = v;
      post('storage-set', { key, value: v });
    },
    removeItem(key) {
      delete memoryStore[key];
      post('storage-remove', { key });
    },
    clear() {
      for (const key of Object.keys(memoryStore))
        delete memoryStore[key];
      post('storage-clear', {});
    },
    key(index) {
      const keys = Object.keys(memoryStore);
      return keys[index] ?? null;
    },
    get length() {
      return Object.keys(memoryStore).length;
    }
  };

  const defineLocalStorage = () => {
    try {
      Object.defineProperty(window, 'localStorage', {
        value: mockStorage,
        writable: false,
        configurable: true
      });
    } catch {
      window.localStorage = mockStorage;
    }
  };

  defineLocalStorage();

  window.addEventListener('message', (event) => {
    const data = event.data;
    if (!isValid(data) || data.type !== 'storage-sync-data') return;

    const incoming = data.data || {};
    for (const key of Object.keys(incoming))
      memoryStore[key] = incoming[key];

    if (typeof window.initTheme === 'function')
      window.initTheme();
    window.dispatchEvent(new Event('storage-ready'));
  });

  // Clipboard API is unavailable in data: URL iframe, so we use postMessage
  document.addEventListener('DOMContentLoaded', function() {
    window.copyErrorMessage = function(button) {
      post('clipboard-copy', { text: button.dataset.errorText });
      button.classList.add('copied');
      setTimeout(function() { button.classList.remove('copied'); }, 2000);
    };
  });

  post('storage-sync-request', {});
})();
`;
const parentStorageBridge = (nonce) => `
(function () {
  const host = document.querySelector('nuxt-error-overlay');
  if (!host) return;

  const NONCE = ${JSON.stringify(nonce)};
  const isValid = (data) => data && data.nonce === NONCE;

  // Handle clipboard copy from iframe
  window.addEventListener('message', function(e) {
    if (isValid(e) && e.data.type === 'clipboard-copy') {
      navigator.clipboard.writeText(e.data.text).catch(function() {});
    }
  });

  const collectLocalStorage = () => {
    const all = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k != null) all[k] = localStorage.getItem(k);
    }
    return all;
  };

  const attachWhenReady = () => {
    const root = host.shadowRoot;
    if (!root)
      return false;
    const iframe = root.getElementById('frame');
    if (!iframe || !iframe.contentWindow)
      return false;

    const handlers = {
      'storage-set': (d) => localStorage.setItem(d.key, d.value),
      'storage-remove': (d) => localStorage.removeItem(d.key),
      'storage-clear': () => localStorage.clear(),
      'storage-sync-request': () => {
        iframe.contentWindow.postMessage({
          type: 'storage-sync-data',
          data: collectLocalStorage(),
          nonce: NONCE
        }, '*');
      }
    };

    window.addEventListener('message', (event) => {
      const data = event.data;
      if (!isValid(data)) return;
      const fn = handlers[data.type];
      if (fn) fn(data);
    });

    return true;
  };

  if (attachWhenReady())
    return;

  const obs = new MutationObserver(() => {
    if (attachWhenReady())
      obs.disconnect();
  });

  obs.observe(host, { childList: true, subtree: true });
})();
`;
const errorCSS = `
:host {
  --preview-width: 240px;
  --preview-height: 180px;
  --base-width: 1200px;
  --base-height: 900px;
  --z-base: 999999998;
  --error-pip-left: auto;
  --error-pip-top: auto;
  --error-pip-right: 5px;
  --error-pip-bottom: 5px;
  --error-pip-origin: bottom right;
  --app-preview-left: auto;
  --app-preview-top: auto;
  --app-preview-right: 5px;
  --app-preview-bottom: 5px;
  all: initial;
  display: contents;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
#frame {
  position: fixed;
  left: 0;
  top: 0;
  width: 100vw;
  height: 100vh;
  border: none;
  z-index: var(--z-base);
}
#frame[inert] {
  left: var(--error-pip-left);
  top: var(--error-pip-top);
  right: var(--error-pip-right);
  bottom: var(--error-pip-bottom);
  width: var(--base-width);
  height: var(--base-height);
  transform: scale(calc(240 / 1200));
  transform-origin: var(--error-pip-origin);
  overflow: hidden;
  border-radius: calc(1200 * 8px / 240);
}
#preview {
  position: fixed;
  left: var(--app-preview-left);
  top: var(--app-preview-top);
  right: var(--app-preview-right);
  bottom: var(--app-preview-bottom);
  width: var(--preview-width);
  height: var(--preview-height);
  overflow: hidden;
  border-radius: 6px;
  pointer-events: none;
  z-index: var(--z-base);
  background: white;
  display: none;
}
#preview iframe {
  transform-origin: var(--error-pip-origin);
}
#frame:not([inert]) + #preview {
  display: block;
}
#toggle {
  position: fixed;
  left: var(--app-preview-left);
  top: var(--app-preview-top);
  right: calc(var(--app-preview-right) - 3px);
  bottom: calc(var(--app-preview-bottom) - 3px);
  width: var(--preview-width);
  height: var(--preview-height);
  background: none;
  border: 3px solid #00DC82;
  border-radius: 8px;
  cursor: pointer;
  opacity: 0.8;
  transition: opacity 0.2s, box-shadow 0.2s;
  z-index: calc(var(--z-base) + 1);
  display: flex;
  align-items: center;
  justify-content: center;
}
#toggle:hover,
#toggle:focus {
  opacity: 1;
  box-shadow: 0 0 20px rgba(0, 220, 130, 0.6);
}
#toggle:focus-visible {
  outline: 3px solid #00DC82;
  outline-offset: 0;
  box-shadow: 0 0 24px rgba(0, 220, 130, 0.8);
}
#frame[inert] ~ #toggle {
  left: var(--error-pip-left);
  top: var(--error-pip-top);
  right: calc(var(--error-pip-right) - 3px);
  bottom: calc(var(--error-pip-bottom) - 3px);
  cursor: grab;
}
:host(.dragging) #frame[inert] ~ #toggle {
  cursor: grabbing;
}
#frame:not([inert]) ~ #toggle,
#frame:not([inert]) + #preview {
  cursor: grab;
}
:host(.dragging-preview) #frame:not([inert]) ~ #toggle,
:host(.dragging-preview) #frame:not([inert]) + #preview {
  cursor: grabbing;
}

#pip-close {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.75);
  color: #fff;
  font-size: 16px;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  pointer-events: auto;
}
#pip-close:focus-visible {
  outline: 2px solid #00DC82;
  outline-offset: 2px;
}

#pip-restore {
  position: fixed;
  right: 16px;
  bottom: 16px;
  padding: 8px 14px;
  border-radius: 999px;
  border: 2px solid #00DC82;
  background: #111;
  color: #fff;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
  font-size: 14px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  z-index: calc(var(--z-base) + 2);
  cursor: grab;
}
#pip-restore:focus-visible {
  outline: 2px solid #00DC82;
  outline-offset: 2px;
}
:host(.dragging-restore) #pip-restore {
  cursor: grabbing;
}

#frame[hidden],
#toggle[hidden],
#preview[hidden],
#pip-restore[hidden],
#pip-close[hidden] {
  display: none !important;
}

@media (prefers-reduced-motion: reduce) {
  #toggle {
    transition: none;
  }
}
`;
function webComponentScript(base64HTML, startMinimized) {
	return `
(function () {
  try {
    // =========================
    // Host + Shadow
    // =========================
    const host = document.querySelector('nuxt-error-overlay');
    if (!host)
      return;
    const shadow = host.attachShadow({ mode: 'open' });

    // =========================
    // DOM helpers
    // =========================
    const el = (tag) => document.createElement(tag);
    const on = (node, type, fn, opts) => node.addEventListener(type, fn, opts);
    const hide = (node, v) => node.toggleAttribute('hidden', !!v);
    const setVar = (name, value) => host.style.setProperty(name, value);
    const unsetVar = (name) => host.style.removeProperty(name);

    // =========================
    // Create DOM
    // =========================
    const style = el('style');
    style.textContent = ${JSON.stringify(errorCSS)};

    const iframe = el('iframe');
    iframe.id = 'frame';
    iframe.src = 'data:text/html;base64,${base64HTML}';
    iframe.title = 'Detailed error stack trace';
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');

    const preview = el('div');
    preview.id = 'preview';

    const toggle = el('div');
    toggle.id = 'toggle';
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('role', 'button');
    toggle.setAttribute('tabindex', '0');
    toggle.innerHTML = '<span class="sr-only">Toggle detailed error view</span>';

    const liveRegion = el('div');
    liveRegion.setAttribute('role', 'status');
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.className = 'sr-only';

    const pipCloseButton = el('button');
    pipCloseButton.id = 'pip-close';
    pipCloseButton.setAttribute('type', 'button');
    pipCloseButton.setAttribute('aria-label', 'Hide error preview overlay');
    pipCloseButton.innerHTML = '&times;';
    pipCloseButton.hidden = true;
    toggle.appendChild(pipCloseButton);

    const pipRestoreButton = el('button');
    pipRestoreButton.id = 'pip-restore';
    pipRestoreButton.setAttribute('type', 'button');
    pipRestoreButton.setAttribute('aria-label', 'Show error overlay');
    pipRestoreButton.innerHTML = '<span aria-hidden="true">⟲</span><span>Show error overlay</span>';
    pipRestoreButton.hidden = true;

    // Order matters: #frame + #preview adjacency
    shadow.appendChild(style);
    shadow.appendChild(liveRegion);
    shadow.appendChild(iframe);
    shadow.appendChild(preview);
    shadow.appendChild(toggle);
    shadow.appendChild(pipRestoreButton);

    // =========================
    // Constants / keys
    // =========================
    const POS_KEYS = {
      position: 'nuxt-error-overlay:position',
      hiddenPretty: 'nuxt-error-overlay:error-pip:hidden',
      hiddenPreview: 'nuxt-error-overlay:app-preview:hidden'
    };

    const CSS_VARS = {
      pip: {
        left: '--error-pip-left',
        top: '--error-pip-top',
        right: '--error-pip-right',
        bottom: '--error-pip-bottom'
      },
      preview: {
        left: '--app-preview-left',
        top: '--app-preview-top',
        right: '--app-preview-right',
        bottom: '--app-preview-bottom'
      }
    };

    const MIN_GAP = 5;
    const DRAG_THRESHOLD = 2;

    // =========================
    // Local storage safe access + state
    // =========================
    let storageReady = true;
    let isPrettyHidden = false;
    let isPreviewHidden = false;

    const safeGet = (k) => {
      try {
        return localStorage.getItem(k);
      } catch {
        return null;
      }
    };

    const safeSet = (k, v) => {
      if (!storageReady) 
        return;
      try {
        localStorage.setItem(k, v);
      } catch {}
    };

    // =========================
    // Sizing helpers
    // =========================
    const vvSize = () => {
      const v = window.visualViewport;
      return v ? { w: v.width, h: v.height } : { w: window.innerWidth, h: window.innerHeight };
    };

    const previewSize = () => {
      const styles = getComputedStyle(host);
      const w = parseFloat(styles.getPropertyValue('--preview-width')) || 240;
      const h = parseFloat(styles.getPropertyValue('--preview-height')) || 180;
      return { w, h };
    };

    const sizeForTarget = (target) => {
      if (!target)
        return previewSize();
      const rect = target.getBoundingClientRect();
      if (rect.width && rect.height)
        return { w: rect.width, h: rect.height };
      return previewSize();
    };

    // =========================
    // Dock model + offset/alignment calculations
    // =========================
    const dock = { edge: null, offset: null, align: null, gap: null };

    const maxOffsetFor = (edge, size) => {
      const vv = vvSize();
      if (edge === 'left' || edge === 'right')
        return Math.max(MIN_GAP, vv.h - size.h - MIN_GAP);
      return Math.max(MIN_GAP, vv.w - size.w - MIN_GAP);
    };

    const clampOffset = (edge, value, size) => {
      const max = maxOffsetFor(edge, size);
      return Math.min(Math.max(value, MIN_GAP), max);
    };

    const updateDockAlignment = (size) => {
      if (!dock.edge || dock.offset == null)
        return;
      const max = maxOffsetFor(dock.edge, size);
      if (dock.offset <= max / 2) {
        dock.align = 'start';
        dock.gap = dock.offset;
      } else {
        dock.align = 'end';
        dock.gap = Math.max(0, max - dock.offset);
      }
    };

    const appliedOffsetFor = (size) => {
      if (!dock.edge || dock.offset == null)
        return null;
      const max = maxOffsetFor(dock.edge, size);

      if (dock.align === 'end' && typeof dock.gap === 'number') {
        return clampOffset(dock.edge, max - dock.gap, size);
      }
      if (dock.align === 'start' && typeof dock.gap === 'number') {
        return clampOffset(dock.edge, dock.gap, size);
      }
      return clampOffset(dock.edge, dock.offset, size);
    };

    const nearestEdgeAt = (x, y) => {
      const { w, h } = vvSize();
      const d = { left: x, right: w - x, top: y, bottom: h - y };
      return Object.keys(d).reduce((a, b) => (d[a] < d[b] ? a : b));
    };

    const cornerDefaultDock = () => {
      const vv = vvSize();
      const size = previewSize();
      const offset = Math.max(MIN_GAP, vv.w - size.w - MIN_GAP);
      return { edge: 'bottom', offset };
    };

    const currentTransformOrigin = () => {
      if (!dock.edge) return null;
      if (dock.edge === 'left' || dock.edge === 'top')
        return 'top left';
      if (dock.edge === 'right')
        return 'top right';
      return 'bottom left';
    };

    // =========================
    // Persist / load dock
    // =========================
    const loadDock = () => {
      const raw = safeGet(POS_KEYS.position);
      if (!raw)
        return;
      try {
        const parsed = JSON.parse(raw);
        const { edge, offset, align, gap } = parsed || {};
        if (!['left', 'right', 'top', 'bottom'].includes(edge))
          return;
        if (typeof offset !== 'number')
          return;

        dock.edge = edge;
        dock.offset = clampOffset(edge, offset, previewSize());
        dock.align = align === 'start' || align === 'end' ? align : null;
        dock.gap = typeof gap === 'number' ? gap : null;

        if (!dock.align || dock.gap == null)
          updateDockAlignment(previewSize());
      } catch {}
    };

    const persistDock = () => {
      if (!dock.edge || dock.offset == null)
        return; 
      safeSet(POS_KEYS.position, JSON.stringify({
        edge: dock.edge,
        offset: dock.offset,
        align: dock.align,
        gap: dock.gap
      }));
    };

    // =========================
    // Apply dock
    // =========================
    const dockToVars = (vars) => ({
      set: (side, v) => host.style.setProperty(vars[side], v),
      clear: (side) => host.style.removeProperty(vars[side])
    });

    const dockToEl = (node) => ({
      set: (side, v) => { node.style[side] = v; },
      clear: (side) => { node.style[side] = ''; }
    });

    const applyDock = (target, size, opts) => {
      if (!dock.edge || dock.offset == null) {
        target.clear('left');
        target.clear('top');
        target.clear('right');
        target.clear('bottom');
        return;
      }

      target.set('left', 'auto');
      target.set('top', 'auto');
      target.set('right', 'auto');
      target.set('bottom', 'auto');

      const applied = appliedOffsetFor(size);

      if (dock.edge === 'left') {
        target.set('left', MIN_GAP + 'px');
        target.set('top', applied + 'px');
      } else if (dock.edge === 'right') {
        target.set('right', MIN_GAP + 'px');
        target.set('top', applied + 'px');
      } else if (dock.edge === 'top') {
        target.set('top', MIN_GAP + 'px');
        target.set('left', applied + 'px');
      } else {
        target.set('bottom', MIN_GAP + 'px');
        target.set('left', applied + 'px');
      }

      if (!opts || opts.persist !== false)
        persistDock();
    };

    const applyDockAll = (opts) => {
      applyDock(dockToVars(CSS_VARS.pip), previewSize(), opts);
      applyDock(dockToVars(CSS_VARS.preview), previewSize(), opts);
      applyDock(dockToEl(pipRestoreButton), sizeForTarget(pipRestoreButton), opts);
    };

    const repaintToDock = () => {
      if (!dock.edge || dock.offset == null)
        return;
      const origin = currentTransformOrigin();
      if (origin)
        setVar('--error-pip-origin', origin);
      else 
        unsetVar('--error-pip-origin');
      applyDockAll({ persist: false });
    };

    // =========================
    // Hidden state + UI
    // =========================
    const loadHidden = () => {
      const rawPretty = safeGet(POS_KEYS.hiddenPretty);
      if (rawPretty != null)
        isPrettyHidden = rawPretty === '1' || rawPretty === 'true';
      const rawPreview = safeGet(POS_KEYS.hiddenPreview);
      if (rawPreview != null)
        isPreviewHidden = rawPreview === '1' || rawPreview === 'true';
    };

    const setPrettyHidden = (v) => {
      isPrettyHidden = !!v;
      safeSet(POS_KEYS.hiddenPretty, isPrettyHidden ? '1' : '0');
      updateUI();
    };

    const setPreviewHidden = (v) => {
      isPreviewHidden = !!v;
      safeSet(POS_KEYS.hiddenPreview, isPreviewHidden ? '1' : '0');
      updateUI();
    };

    const isMinimized = () => iframe.hasAttribute('inert');

    const setMinimized = (v) => {
      if (v) {
        iframe.setAttribute('inert', '');
        toggle.setAttribute('aria-expanded', 'false');
      } else {
        iframe.removeAttribute('inert');
        toggle.setAttribute('aria-expanded', 'true');
      }
    };

    const setRestoreLabel = (kind) => {
      if (kind === 'pretty') {
        pipRestoreButton.innerHTML = '<span aria-hidden="true">⟲</span><span>Show error overlay</span>';
        pipRestoreButton.setAttribute('aria-label', 'Show error overlay');
      } else {
        pipRestoreButton.innerHTML = '<span aria-hidden="true">⟲</span><span>Show error page</span>';
        pipRestoreButton.setAttribute('aria-label', 'Show error page');
      }
    };

    const updateUI = () => {
      const minimized = isMinimized();
      const showPiP = minimized && !isPrettyHidden;
      const showPreview = !minimized && !isPreviewHidden;
      const pipHiddenByUser = minimized && isPrettyHidden;
      const previewHiddenByUser = !minimized && isPreviewHidden;
      const showToggle = minimized ? showPiP : showPreview;
      const showRestore = pipHiddenByUser || previewHiddenByUser;

      hide(iframe, pipHiddenByUser);
      hide(preview, !showPreview);
      hide(toggle, !showToggle);
      hide(pipCloseButton, !showToggle);
      hide(pipRestoreButton, !showRestore);

      pipCloseButton.setAttribute('aria-label', minimized ? 'Hide error overlay' : 'Hide error page preview');

      if (pipHiddenByUser)
        setRestoreLabel('pretty');
      else if (previewHiddenByUser)
        setRestoreLabel('preview');

      host.classList.toggle('pip-hidden', isPrettyHidden);
      host.classList.toggle('preview-hidden', isPreviewHidden);
    };

    // =========================
    // Preview snapshot
    // =========================
    const updatePreview = () => {
      try {
        let previewIframe = preview.querySelector('iframe');
        if (!previewIframe) {
          previewIframe = el('iframe');
          previewIframe.style.cssText = 'width: 1200px; height: 900px; transform: scale(0.2); transform-origin: top left; border: none;';
          previewIframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
          preview.appendChild(previewIframe);
        }

        const doctype = document.doctype ? '<!DOCTYPE ' + document.doctype.name + '>' : '';
        const cleanedHTML = document.documentElement.outerHTML
          .replace(/<nuxt-error-overlay[^>]*>.*?<\\/nuxt-error-overlay>/gs, '')
          .replace(/<script[^>]*>.*?<\\/script>/gs, '');

        const iframeDoc = previewIframe.contentDocument || previewIframe.contentWindow.document;
        iframeDoc.open();
        iframeDoc.write(doctype + cleanedHTML);
        iframeDoc.close();
      } catch (err) {
        console.error('Failed to update preview:', err);
      }
    };

    // =========================
    // View toggling
    // =========================
    const toggleView = () => {
      if (isMinimized()) {
        updatePreview();
        setMinimized(false);
        liveRegion.textContent = 'Showing detailed error view';
        setTimeout(() => { 
          try { 
            iframe.contentWindow.focus();
          } catch {}
        }, 100);
      } else {
        setMinimized(true);
        liveRegion.textContent = 'Showing error page';
        repaintToDock();
        void iframe.offsetWidth;
      }
      updateUI();
    };

    // =========================
    // Dragging (unified, rAF throttled)
    // =========================
    let drag = null;
    let rafId = null;
    let suppressToggleClick = false;
    let suppressRestoreClick = false;

    const beginDrag = (e) => {
      if (drag) 
        return;

      if (!dock.edge || dock.offset == null) {
        const def = cornerDefaultDock();
        dock.edge = def.edge;
        dock.offset = def.offset;
        updateDockAlignment(previewSize());
      }

      const isRestoreTarget = e.currentTarget === pipRestoreButton;

      drag = {
        kind: isRestoreTarget ? 'restore' : (isMinimized() ? 'pip' : 'preview'),
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
        moved: false,
        target: e.currentTarget
      };

      drag.target.setPointerCapture(e.pointerId);

      if (drag.kind === 'restore')
        host.classList.add('dragging-restore');
      else 
        host.classList.add(drag.kind === 'pip' ? 'dragging' : 'dragging-preview');

      e.preventDefault();
    };

    const moveDrag = (e) => {
      if (!drag || drag.pointerId !== e.pointerId)
        return;

      drag.lastX = e.clientX;
      drag.lastY = e.clientY;
      
      const dx = drag.lastX - drag.startX;
      const dy = drag.lastY - drag.startY;

      if (!drag.moved && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
        drag.moved = true;
      }

      if (!drag.moved)
        return;
      if (rafId)
        return;

      rafId = requestAnimationFrame(() => {
        rafId = null;

        const edge = nearestEdgeAt(drag.lastX, drag.lastY);
        const size = sizeForTarget(drag.target);

        let offset;
        if (edge === 'left' || edge === 'right') {
          const top = drag.lastY - (size.h / 2);
          offset = clampOffset(edge, Math.round(top), size);
        } else {
          const left = drag.lastX - (size.w / 2);
          offset = clampOffset(edge, Math.round(left), size);
        }

        dock.edge = edge;
        dock.offset = offset;
        updateDockAlignment(size);

        const origin = currentTransformOrigin();
        setVar('--error-pip-origin', origin || 'bottom right');

        applyDockAll({ persist: false });
      });
    };

    const endDrag = (e) => {
      if (!drag || drag.pointerId !== e.pointerId)
        return;

      const endedKind = drag.kind;
      drag.target.releasePointerCapture(e.pointerId);

      if (endedKind === 'restore')
        host.classList.remove('dragging-restore');
      else 
        host.classList.remove(endedKind === 'pip' ? 'dragging' : 'dragging-preview');

      const didMove = drag.moved;
      drag = null;

      if (didMove) {
        persistDock();
        if (endedKind === 'restore')
          suppressRestoreClick = true;
        else 
          suppressToggleClick = true;
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const bindDragTarget = (node) => {
      on(node, 'pointerdown', beginDrag);
      on(node, 'pointermove', moveDrag);
      on(node, 'pointerup', endDrag);
      on(node, 'pointercancel', endDrag);
    };

    bindDragTarget(toggle);
    bindDragTarget(pipRestoreButton);

    // =========================
    // Events (toggle / close / restore)
    // =========================
    on(toggle, 'click', (e) => {
      if (suppressToggleClick) {
        e.preventDefault();
        suppressToggleClick = false;
        return;
      }
      toggleView();
    });

    on(toggle, 'keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleView();
      }
    });

    on(pipCloseButton, 'click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (isMinimized())
        setPrettyHidden(true);
      else
        setPreviewHidden(true);
    });

    on(pipCloseButton, 'pointerdown', (e) => {
      e.stopPropagation();
    });

    on(pipRestoreButton, 'click', (e) => {
      if (suppressRestoreClick) {
        e.preventDefault();
        suppressRestoreClick = false;
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      if (isMinimized()) 
        setPrettyHidden(false);
      else 
        setPreviewHidden(false);
    });

    // =========================
    // Lifecycle: load / sync / repaint
    // =========================
    const loadState = () => {
      loadDock();
      loadHidden();

      if (isPrettyHidden && !isMinimized())
        setMinimized(true);

      updateUI();
      repaintToDock();
    };

    loadState();

    on(window, 'storage-ready', () => {
      storageReady = true;
      loadState();
    });

    const onViewportChange = () => repaintToDock();

    on(window, 'resize', onViewportChange);

    if (window.visualViewport) {
      on(window.visualViewport, 'resize', onViewportChange);
      on(window.visualViewport, 'scroll', onViewportChange);
    }

    // initial preview
    setTimeout(updatePreview, 100);

    // initial minimized option
    if (${startMinimized}) {
      setMinimized(true);
      repaintToDock();
      void iframe.offsetWidth;
      updateUI();
    }
  } catch (err) {
    console.error('Failed to initialize Nuxt error overlay:', err);
  }
})();
`;
}
function generateErrorOverlayHTML(html, options) {
	const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
	const errorPage = html.replace("<head>", `<head><script>${iframeStorageBridge(nonce)}<\/script>`);
	const base64HTML = Buffer.from(errorPage, "utf8").toString("base64");
	return `
    <script>${parentStorageBridge(nonce)}<\/script>
    <nuxt-error-overlay></nuxt-error-overlay>
    <script>${webComponentScript(base64HTML, options?.startMinimized ?? false)}<\/script>
  `;
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
	if (typeof defaultRes.body !== "string" && Array.isArray(defaultRes.body.stack)) {
		// normalize to string format expected by nuxt `error.vue`
		defaultRes.body.stack = defaultRes.body.stack.join("\n");
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
		const { template } = await Promise.resolve().then(function () { return error500; });
		{
			// TODO: Support `message` in template
			errorObject.description = errorObject.message;
		}
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
	if (!globalThis._importMeta_.test && typeof html === "string") {
		const prettyResponse = await defaultHandler(error, event, { json: false });
		if (typeof prettyResponse.body === "string") {
			return send(event, html.replace("</body>", `${generateErrorOverlayHTML(prettyResponse.body, { startMinimized: 300 <= status && status < 500 })}</body>`));
		}
	}
	return send(event, html);
});

function defineNitroErrorHandler(handler) {
  return handler;
}

const errorHandler$1 = defineNitroErrorHandler(
  async function defaultNitroErrorHandler(error, event) {
    const res = await defaultHandler(error, event);
    if (!event.node?.res.headersSent) {
      setResponseHeaders(event, res.headers);
    }
    setResponseStatus(event, res.status, res.statusText);
    return send(
      event,
      typeof res.body === "string" ? res.body : JSON.stringify(res.body, null, 2)
    );
  }
);
async function defaultHandler(error, event, opts) {
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
  await loadStackTrace(error).catch(consola.error);
  const youch = new Youch();
  if (isSensitive && !opts?.silent) {
    const tags = [error.unhandled && "[unhandled]", error.fatal && "[fatal]"].filter(Boolean).join(" ");
    const ansiError = await (await youch.toANSI(error)).replaceAll(process.cwd(), ".");
    consola.error(
      `[request error] ${tags} [${event.method}] ${url}

`,
      ansiError
    );
  }
  const useJSON = opts?.json ?? !getRequestHeader(event, "accept")?.includes("text/html");
  const headers = {
    "content-type": useJSON ? "application/json" : "text/html",
    // Prevent browser from guessing the MIME types of resources.
    "x-content-type-options": "nosniff",
    // Prevent error page from being embedded in an iframe
    "x-frame-options": "DENY",
    // Prevent browsers from sending the Referer header
    "referrer-policy": "no-referrer",
    // Disable the execution of any js
    "content-security-policy": "script-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self';"
  };
  if (statusCode === 404 || !getResponseHeader(event, "cache-control")) {
    headers["cache-control"] = "no-cache";
  }
  const body = useJSON ? {
    error: true,
    url,
    statusCode,
    statusMessage,
    message: error.message,
    data: error.data,
    stack: error.stack?.split("\n").map((line) => line.trim())
  } : await youch.toHTML(error, {
    request: {
      url: url.href,
      method: event.method,
      headers: getRequestHeaders(event)
    }
  });
  return {
    status: statusCode,
    statusText: statusMessage,
    headers,
    body
  };
}
async function loadStackTrace(error) {
  if (!(error instanceof Error)) {
    return;
  }
  const parsed = await new ErrorParser().defineSourceLoader(sourceLoader).parse(error);
  const stack = error.message + "\n" + parsed.frames.map((frame) => fmtFrame(frame)).join("\n");
  Object.defineProperty(error, "stack", { value: stack });
  if (error.cause) {
    await loadStackTrace(error.cause).catch(consola.error);
  }
}
async function sourceLoader(frame) {
  if (!frame.fileName || frame.fileType !== "fs" || frame.type === "native") {
    return;
  }
  if (frame.type === "app") {
    const rawSourceMap = await readFile(`${frame.fileName}.map`, "utf8").catch(() => {
    });
    if (rawSourceMap) {
      const consumer = await new SourceMapConsumer(rawSourceMap);
      const originalPosition = consumer.originalPositionFor({ line: frame.lineNumber, column: frame.columnNumber });
      if (originalPosition.source && originalPosition.line) {
        frame.fileName = resolve(dirname(frame.fileName), originalPosition.source);
        frame.lineNumber = originalPosition.line;
        frame.columnNumber = originalPosition.column || 0;
      }
    }
  }
  const contents = await readFile(frame.fileName, "utf8").catch(() => {
  });
  return contents ? { contents } : void 0;
}
function fmtFrame(frame) {
  if (frame.type === "native") {
    return frame.raw;
  }
  const src = `${frame.fileName || ""}:${frame.lineNumber}:${frame.columnNumber})`;
  return frame.functionName ? `at ${frame.functionName} (${src}` : `at ${src}`;
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

const script = `
if (!window.__NUXT_DEVTOOLS_TIME_METRIC__) {
  Object.defineProperty(window, '__NUXT_DEVTOOLS_TIME_METRIC__', {
    value: {},
    enumerable: false,
    configurable: true,
  })
}
window.__NUXT_DEVTOOLS_TIME_METRIC__.appInit = Date.now()
`;

const _nl6bQT7yIe_qsvWsHXdxxleKnKhmiwRlnv4mAtiSmw = (function(nitro) {
  nitro.hooks.hook("render:html", (htmlContext) => {
    htmlContext.head.push(`<script>${script}<\/script>`);
  });
});

const rootDir = "/Users/obsidian/Projects/ossuary-projects/snaplify/apps/reference";

const appHead = {"meta":[{"name":"viewport","content":"width=device-width, initial-scale=1"},{"charset":"utf-8"}],"link":[{"rel":"stylesheet","href":"https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css","crossorigin":"anonymous"}],"style":[],"script":[],"noscript":[]};

const appRootTag = "div";

const appRootAttrs = {"id":"__nuxt"};

const appTeleportTag = "div";

const appTeleportAttrs = {"id":"teleports"};

const appId = "nuxt-app";

const devReducers = {
	VNode: (data) => isVNode(data) ? {
		type: data.type,
		props: data.props
	} : undefined,
	URL: (data) => data instanceof URL ? data.toString() : undefined
};
const asyncContext = getContext("nuxt-dev", {
	asyncContext: true,
	AsyncLocalStorage
});
const _zhVm5qprtYX102Z_f_cXuU2baFGsHZqzOLnWUI6gQ9U = (nitroApp) => {
	const handler = nitroApp.h3App.handler;
	nitroApp.h3App.handler = (event) => {
		return asyncContext.callAsync({
			logs: [],
			event
		}, () => handler(event));
	};
	onConsoleLog((_log) => {
		const ctx = asyncContext.tryUse();
		if (!ctx) {
			return;
		}
		const rawStack = captureRawStackTrace();
		if (!rawStack || rawStack.includes("runtime/vite-node.mjs")) {
			return;
		}
		const trace = [];
		let filename = "";
		for (const entry of parseRawStackTrace(rawStack)) {
			if (entry.source === globalThis._importMeta_.url) {
				continue;
			}
			if (EXCLUDE_TRACE_RE.test(entry.source)) {
				continue;
			}
			filename ||= entry.source.replace(withTrailingSlash(rootDir), "");
			trace.push({
				...entry,
				source: entry.source.startsWith("file://") ? entry.source.replace("file://", "") : entry.source
			});
		}
		const log = {
			..._log,
			filename,
			stack: trace
		};
		// retain log to be include in the next render
		ctx.logs.push(log);
	});
	nitroApp.hooks.hook("afterResponse", () => {
		const ctx = asyncContext.tryUse();
		if (!ctx) {
			return;
		}
		return nitroApp.hooks.callHook("dev:ssr-logs", {
			logs: ctx.logs,
			path: ctx.event.path
		});
	});
	// Pass any logs to the client
	nitroApp.hooks.hook("render:html", (htmlContext) => {
		const ctx = asyncContext.tryUse();
		if (!ctx) {
			return;
		}
		try {
			const reducers = Object.assign(Object.create(null), devReducers, ctx.event.context["~payloadReducers"]);
			htmlContext.bodyAppend.unshift(`<script type="application/json" data-nuxt-logs="${appId}">${stringify(ctx.logs, reducers)}<\/script>`);
		} catch (e) {
			const shortError = e instanceof Error && "toString" in e ? ` Received \`${e.toString()}\`.` : "";
			console.warn(`[nuxt] Failed to stringify dev server logs.${shortError} You can define your own reducer/reviver for rich types following the instructions in https://nuxt.com/docs/api/composables/use-nuxt-app#payload.`);
		}
	});
};
const EXCLUDE_TRACE_RE = /\/node_modules\/(?:.*\/)?(?:nuxt|nuxt-nightly|nuxt-edge|nuxt3|consola|@vue)\/|core\/runtime\/nitro/;
function onConsoleLog(callback) {
	consola$1.addReporter({ log(logObj) {
		callback(logObj);
	} });
	consola$1.wrapConsole();
}

const plugins = [
  _nl6bQT7yIe_qsvWsHXdxxleKnKhmiwRlnv4mAtiSmw,
_zhVm5qprtYX102Z_f_cXuU2baFGsHZqzOLnWUI6gQ9U
];

const assets = {};

function readAsset (id) {
  const serverDir = dirname$1(fileURLToPath(globalThis._importMeta_.url));
  return promises.readFile(resolve$1(serverDir, assets[id].path))
}

const publicAssetBases = {"/_nuxt/builds/meta/":{"maxAge":31536000},"/_nuxt/builds/":{"maxAge":1},"/uploads/":{"maxAge":86400}};

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
      throw createError({ statusCode: 404 });
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
  db = drizzle(pool, { schema });
  return db;
}

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
    secret: runtimeConfig.authSecret || "dev-secret-change-me",
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
      throw createError({
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
      throw createError({
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
  const ip = ((_b = (_a = getRequestHeader(event, "x-forwarded-for")) == null ? void 0 : _a.split(",")[0]) == null ? void 0 : _b.trim()) || getRequestHeader(event, "x-real-ip") || "unknown";
  const { result, headers: rlHeaders } = checkRateLimit(store, ip, pathname);
  for (const [key, value] of Object.entries(rlHeaders)) {
    setResponseHeader(event, key, value);
  }
  if (!result.allowed) {
    throw createError({
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

const VueResolver = (_, value) => {
  return isRef(value) ? toValue(value) : value;
};

const headSymbol = "usehead";
// @__NO_SIDE_EFFECTS__
function vueInstall(head) {
  const plugin = {
    install(app) {
      app.config.globalProperties.$unhead = head;
      app.config.globalProperties.$head = head;
      app.provide(headSymbol, head);
    }
  };
  return plugin.install;
}

// @__NO_SIDE_EFFECTS__
function resolveUnrefHeadInput(input) {
  return walkResolver(input, VueResolver);
}

const NUXT_RUNTIME_PAYLOAD_EXTRACTION = false;

// @__NO_SIDE_EFFECTS__
function createHead(options = {}) {
  const head = createHead$1({
    ...options,
    propResolvers: [VueResolver]
  });
  head.install = vueInstall(head);
  return head;
}

const unheadOptions = {
  disableDefaults: true,
  disableCapoSorting: false,
  plugins: [DeprecationsPlugin, PromisesPlugin, TemplateParamsPlugin, AliasSortingPlugin],
};

function createSSRContext(event) {
	const ssrContext = {
		url: event.path,
		event,
		runtimeConfig: useRuntimeConfig(event),
		noSSR: event.context.nuxt?.noSSR || (false),
		head: createHead(unheadOptions),
		error: false,
		nuxt: undefined,
		payload: {},
		["~payloadReducers"]: Object.create(null),
		modules: new Set()
	};
	return ssrContext;
}
function setSSRError(ssrContext, error) {
	ssrContext.error = true;
	ssrContext.payload = { error };
	ssrContext.url = error.url;
}

function buildAssetsDir() {
	// TODO: support passing event to `useRuntimeConfig`
	return useRuntimeConfig().app.buildAssetsDir;
}
function buildAssetsURL(...path) {
	return joinRelativeURL(publicAssetsURL(), buildAssetsDir(), ...path);
}
function publicAssetsURL(...path) {
	// TODO: support passing event to `useRuntimeConfig`
	const app = useRuntimeConfig().app;
	const publicBase = app.cdnURL || app.baseURL;
	return path.length ? joinRelativeURL(publicBase, ...path) : publicBase;
}

const APP_ROOT_OPEN_TAG = `<${appRootTag}${propsToString(appRootAttrs)}>`;
const APP_ROOT_CLOSE_TAG = `</${appRootTag}>`;
// @ts-expect-error file will be produced after app build
const getServerEntry = () => import('file:///Users/obsidian/Projects/ossuary-projects/snaplify/apps/reference/.nuxt//dist/server/server.mjs').then((r) => r.default || r);
// @ts-expect-error file will be produced after app build
const getClientManifest = () => import('file:///Users/obsidian/Projects/ossuary-projects/snaplify/apps/reference/.nuxt//dist/server/client.manifest.mjs').then((r) => r.default || r).then((r) => typeof r === "function" ? r() : r);
// -- SSR Renderer --
const getSSRRenderer = lazyCachedFunction(async () => {
	// Load server bundle
	const createSSRApp = await getServerEntry();
	if (!createSSRApp) {
		throw new Error("Server bundle is not available");
	}
	// Load precomputed dependencies
	const precomputed = undefined ;
	// Create renderer
	const renderer = createRenderer(createSSRApp, {
		precomputed,
		manifest: await getClientManifest() ,
		renderToString: renderToString$1,
		buildAssetsURL
	});
	async function renderToString$1(input, context) {
		const html = await renderToString(input, context);
		// In development with vite-node, the manifest is on-demand and will be available after rendering
		// eslint-disable-next-line no-restricted-globals
		if (process.env.NUXT_VITE_NODE_OPTIONS) {
			renderer.rendererContext.updateManifest(await getClientManifest());
		}
		return APP_ROOT_OPEN_TAG + html + APP_ROOT_CLOSE_TAG;
	}
	return renderer;
});
// -- SPA Renderer --
const getSPARenderer = lazyCachedFunction(async () => {
	const precomputed = undefined ;
	// @ts-expect-error virtual file
	const spaTemplate = await Promise.resolve().then(function () { return _virtual__spaTemplate; }).then((r) => r.template).catch(() => "").then((r) => {
		{
			return APP_ROOT_OPEN_TAG + r + APP_ROOT_CLOSE_TAG;
		}
	});
	// Create SPA renderer and cache the result for all requests
	const renderer = createRenderer(() => () => {}, {
		precomputed,
		manifest: await getClientManifest() ,
		renderToString: () => spaTemplate,
		buildAssetsURL
	});
	const result = await renderer.renderToString({});
	const renderToString = (ssrContext) => {
		const config = useRuntimeConfig(ssrContext.event);
		ssrContext.modules ||= new Set();
		ssrContext.payload.serverRendered = false;
		ssrContext.config = {
			public: config.public,
			app: config.app
		};
		return Promise.resolve(result);
	};
	return {
		rendererContext: renderer.rendererContext,
		renderToString
	};
});
function lazyCachedFunction(fn) {
	let res = null;
	return () => {
		if (res === null) {
			res = fn().catch((err) => {
				res = null;
				throw err;
			});
		}
		return res;
	};
}
function getRenderer(ssrContext) {
	return ssrContext.noSSR ? getSPARenderer() : getSSRRenderer();
}
// @ts-expect-error file will be produced after app build
const getSSRStyles = lazyCachedFunction(() => Promise.resolve().then(function () { return styles$1; }).then((r) => r.default || r));

async function renderInlineStyles(usedModules) {
	const styleMap = await getSSRStyles();
	const inlinedStyles = new Set();
	for (const mod of usedModules) {
		if (mod in styleMap && styleMap[mod]) {
			for (const style of await styleMap[mod]()) {
				inlinedStyles.add(style);
			}
		}
	}
	return Array.from(inlinedStyles).map((style) => ({ innerHTML: style }));
}

// @ts-expect-error virtual file
const ROOT_NODE_REGEX = new RegExp(`^<${appRootTag}[^>]*>([\\s\\S]*)<\\/${appRootTag}>$`);
/**
* remove the root node from the html body
*/
function getServerComponentHTML(body) {
	const match = body.match(ROOT_NODE_REGEX);
	return match?.[1] || body;
}
const SSR_SLOT_TELEPORT_MARKER = /^uid=([^;]*);slot=(.*)$/;
const SSR_CLIENT_TELEPORT_MARKER = /^uid=([^;]*);client=(.*)$/;
const SSR_CLIENT_SLOT_MARKER = /^island-slot=([^;]*);(.*)$/;
function getSlotIslandResponse(ssrContext) {
	if (!ssrContext.islandContext || !Object.keys(ssrContext.islandContext.slots).length) {
		return undefined;
	}
	const response = {};
	for (const [name, slot] of Object.entries(ssrContext.islandContext.slots)) {
		response[name] = {
			...slot,
			fallback: ssrContext.teleports?.[`island-fallback=${name}`]
		};
	}
	return response;
}
function getClientIslandResponse(ssrContext) {
	if (!ssrContext.islandContext || !Object.keys(ssrContext.islandContext.components).length) {
		return undefined;
	}
	const response = {};
	for (const [clientUid, component] of Object.entries(ssrContext.islandContext.components)) {
		// remove teleport anchor to avoid hydration issues
		const html = ssrContext.teleports?.[clientUid]?.replaceAll("<!--teleport start anchor-->", "") || "";
		response[clientUid] = {
			...component,
			html,
			slots: getComponentSlotTeleport(clientUid, ssrContext.teleports ?? {})
		};
	}
	return response;
}
function getComponentSlotTeleport(clientUid, teleports) {
	const entries = Object.entries(teleports);
	const slots = {};
	for (const [key, value] of entries) {
		const match = key.match(SSR_CLIENT_SLOT_MARKER);
		if (match) {
			const [, id, slot] = match;
			if (!slot || clientUid !== id) {
				continue;
			}
			slots[slot] = value;
		}
	}
	return slots;
}
function replaceIslandTeleports(ssrContext, html) {
	const { teleports, islandContext } = ssrContext;
	if (islandContext || !teleports) {
		return html;
	}
	for (const key in teleports) {
		const matchClientComp = key.match(SSR_CLIENT_TELEPORT_MARKER);
		if (matchClientComp) {
			const [, uid, clientId] = matchClientComp;
			if (!uid || !clientId) {
				continue;
			}
			html = html.replace(new RegExp(` data-island-uid="${uid}" data-island-component="${clientId}"[^>]*>`), (full) => {
				return full + teleports[key];
			});
			continue;
		}
		const matchSlot = key.match(SSR_SLOT_TELEPORT_MARKER);
		if (matchSlot) {
			const [, uid, slot] = matchSlot;
			if (!uid || !slot) {
				continue;
			}
			html = html.replace(new RegExp(` data-island-uid="${uid}" data-island-slot="${slot}"[^>]*>`), (full) => {
				return full + teleports[key];
			});
		}
	}
	return html;
}

const ISLAND_SUFFIX_RE = /\.json(?:\?.*)?$/;
const _SxA8c9 = defineEventHandler(async (event) => {
	const nitroApp = useNitroApp();
	setResponseHeaders(event, {
		"content-type": "application/json;charset=utf-8",
		"x-powered-by": "Nuxt"
	});
	const islandContext = await getIslandContext(event);
	const ssrContext = {
		...createSSRContext(event),
		islandContext,
		noSSR: false,
		url: islandContext.url
	};
	// Render app
	const renderer = await getSSRRenderer();
	const renderResult = await renderer.renderToString(ssrContext).catch(async (err) => {
		await ssrContext.nuxt?.hooks.callHook("app:error", err);
		throw err;
	});
	// Handle errors
	if (ssrContext.payload?.error) {
		throw ssrContext.payload.error;
	}
	const inlinedStyles = await renderInlineStyles(ssrContext.modules ?? []);
	await ssrContext.nuxt?.hooks.callHook("app:rendered", {
		ssrContext,
		renderResult
	});
	if (inlinedStyles.length) {
		ssrContext.head.push({ style: inlinedStyles });
	}
	{
		const { styles } = getRequestDependencies(ssrContext, renderer.rendererContext);
		const link = [];
		for (const resource of Object.values(styles)) {
			// Do not add links to resources that are inlined (vite v5+)
			if ("inline" in getQuery(resource.file)) {
				continue;
			}
			// Add CSS links in <head> for CSS files
			// - in dev mode when rendering an island and the file has scoped styles and is not a page
			if (resource.file.includes("scoped") && !resource.file.includes("pages/")) {
				link.push({
					rel: "stylesheet",
					href: renderer.rendererContext.buildAssetsURL(resource.file),
					crossorigin: ""
				});
			}
		}
		if (link.length) {
			ssrContext.head.push({ link }, { mode: "server" });
		}
	}
	const islandHead = {};
	for (const entry of ssrContext.head.entries.values()) {
		// eslint-disable-next-line @typescript-eslint/no-deprecated
		for (const [key, value] of Object.entries(resolveUnrefHeadInput(entry.input))) {
			const currentValue = islandHead[key];
			if (Array.isArray(currentValue)) {
				currentValue.push(...value);
			} else {
				islandHead[key] = value;
			}
		}
	}
	// TODO: remove for v4
	islandHead.link ||= [];
	islandHead.style ||= [];
	const islandResponse = {
		id: islandContext.id,
		head: islandHead,
		html: getServerComponentHTML(renderResult.html),
		components: getClientIslandResponse(ssrContext),
		slots: getSlotIslandResponse(ssrContext)
	};
	await nitroApp.hooks.callHook("render:island", islandResponse, {
		event,
		islandContext
	});
	return islandResponse;
});
async function getIslandContext(event) {
	// TODO: Strict validation for url
	let url = event.path || "";
	const componentParts = url.substring("/__nuxt_island".length + 1).replace(ISLAND_SUFFIX_RE, "").split("_");
	const hashId = componentParts.length > 1 ? componentParts.pop() : undefined;
	const componentName = componentParts.join("_");
	// TODO: Validate context
	const context = event.method === "GET" ? getQuery$1(event) : await readBody(event);
	const ctx = {
		url: "/",
		...context,
		id: hashId,
		name: componentName,
		props: destr$1(context.props) || {},
		slots: {},
		components: {}
	};
	return ctx;
}

const _lazy_FHTzZS = () => Promise.resolve().then(function () { return audit_get$1; });
const _lazy_8Q5Vj4 = () => Promise.resolve().then(function () { return _id__delete$d; });
const _lazy_2Cg2ym = () => Promise.resolve().then(function () { return reports_get$1; });
const _lazy_JBIzUV = () => Promise.resolve().then(function () { return resolve_post$1; });
const _lazy_few2l1 = () => Promise.resolve().then(function () { return settings_get$1; });
const _lazy_kn45dY = () => Promise.resolve().then(function () { return settings_put$1; });
const _lazy_k251rA = () => Promise.resolve().then(function () { return stats_get$3; });
const _lazy_Wew5oZ = () => Promise.resolve().then(function () { return users_get$1; });
const _lazy_AncTe6 = () => Promise.resolve().then(function () { return _id__delete$b; });
const _lazy_rnRD3x = () => Promise.resolve().then(function () { return role_put$1; });
const _lazy_mSN0U6 = () => Promise.resolve().then(function () { return status_put$1; });
const _lazy_TKf7yE = () => Promise.resolve().then(function () { return build_post$1; });
const _lazy_IMfpVg = () => Promise.resolve().then(function () { return fork_post$1; });
const _lazy_INWkw9 = () => Promise.resolve().then(function () { return index_delete$9; });
const _lazy_IwW464 = () => Promise.resolve().then(function () { return index_get$x; });
const _lazy_JVK3iP = () => Promise.resolve().then(function () { return index_put$9; });
const _lazy_QDBZ5L = () => Promise.resolve().then(function () { return productsSync_post$1; });
const _lazy_COvTvp = () => Promise.resolve().then(function () { return products_get$3; });
const _lazy_DP4Ay7 = () => Promise.resolve().then(function () { return products_post$3; });
const _lazy_Cs2g1s = () => Promise.resolve().then(function () { return _productId__delete$1; });
const _lazy_nvGW0A = () => Promise.resolve().then(function () { return publish_post$3; });
const _lazy_znufi_ = () => Promise.resolve().then(function () { return report_post$1; });
const _lazy_T1Or0I = () => Promise.resolve().then(function () { return versions_get$1; });
const _lazy_5xwqzL = () => Promise.resolve().then(function () { return view_post$1; });
const _lazy_x5oiU1 = () => Promise.resolve().then(function () { return index_get$v; });
const _lazy_d1wpDk = () => Promise.resolve().then(function () { return index_post$f; });
const _lazy_aWSNzD = () => Promise.resolve().then(function () { return entries_get$1; });
const _lazy_2Vbyzt = () => Promise.resolve().then(function () { return entries_post$1; });
const _lazy_1xBq08 = () => Promise.resolve().then(function () { return index_delete$7; });
const _lazy_b6CdKN = () => Promise.resolve().then(function () { return index_get$t; });
const _lazy_kZqaoT = () => Promise.resolve().then(function () { return index_put$7; });
const _lazy_KvT54o = () => Promise.resolve().then(function () { return judge_post$1; });
const _lazy_Vtturf = () => Promise.resolve().then(function () { return transition_post$1; });
const _lazy_DECgZ5 = () => Promise.resolve().then(function () { return index_get$r; });
const _lazy_XOr96X = () => Promise.resolve().then(function () { return index_post$d; });
const _lazy_P7zJOr = () => Promise.resolve().then(function () { return index_delete$5; });
const _lazy_ckimER = () => Promise.resolve().then(function () { return index_get$p; });
const _lazy_N18wUp = () => Promise.resolve().then(function () { return index_put$5; });
const _lazy_Lm1t5u = () => Promise.resolve().then(function () { return nav_get$1; });
const _lazy_TB2PWK = () => Promise.resolve().then(function () { return pages_get$1; });
const _lazy_t6h8n4 = () => Promise.resolve().then(function () { return pages_post$1; });
const _lazy_uvwSIz = () => Promise.resolve().then(function () { return _pageId__put$1; });
const _lazy_kwKJ8K = () => Promise.resolve().then(function () { return search_get$1; });
const _lazy_9ZpYPh = () => Promise.resolve().then(function () { return versions_post$1; });
const _lazy_qgBaDe = () => Promise.resolve().then(function () { return index_get$n; });
const _lazy_d2gy1E = () => Promise.resolve().then(function () { return index_post$b; });
const _lazy_Tn0njh = () => Promise.resolve().then(function () { return _id__delete$9; });
const _lazy_TvYAs4 = () => Promise.resolve().then(function () { return mine_get$1; });
const _lazy_inDOPa = () => Promise.resolve().then(function () { return upload_post$1; });
const _lazy_Z1yxwm = () => Promise.resolve().then(function () { return health_get$1; });
const _lazy_94SzjH = () => Promise.resolve().then(function () { return bans_get$1; });
const _lazy_akeW7s = () => Promise.resolve().then(function () { return bans_post$1; });
const _lazy_rpBiY6 = () => Promise.resolve().then(function () { return _userId__delete$3; });
const _lazy_rJWQ_1 = () => Promise.resolve().then(function () { return feed_xml_get$3; });
const _lazy_dnkjHg = () => Promise.resolve().then(function () { return gallery_get$1; });
const _lazy_Cl0fdz = () => Promise.resolve().then(function () { return index_delete$3; });
const _lazy_K0TlR8 = () => Promise.resolve().then(function () { return index_get$l; });
const _lazy_9SfoLn = () => Promise.resolve().then(function () { return index_put$3; });
const _lazy_PBg7X_ = () => Promise.resolve().then(function () { return invites_get$1; });
const _lazy_gFIK_y = () => Promise.resolve().then(function () { return invites_post$1; });
const _lazy_UuI17m = () => Promise.resolve().then(function () { return join_post$1; });
const _lazy_qT8pYp = () => Promise.resolve().then(function () { return leave_post$1; });
const _lazy_seQlVL = () => Promise.resolve().then(function () { return members_get$1; });
const _lazy_P6keue = () => Promise.resolve().then(function () { return _userId__delete$1; });
const _lazy_vs5UWR = () => Promise.resolve().then(function () { return _userId__put$1; });
const _lazy_rmgBTp = () => Promise.resolve().then(function () { return _postId__delete$1; });
const _lazy_Uwo27T = () => Promise.resolve().then(function () { return replies_get$1; });
const _lazy_9JGU7y = () => Promise.resolve().then(function () { return replies_post$1; });
const _lazy_HAAigD = () => Promise.resolve().then(function () { return index_get$j; });
const _lazy_N4SgUN = () => Promise.resolve().then(function () { return index_post$9; });
const _lazy_gBbnz3 = () => Promise.resolve().then(function () { return products_get$1; });
const _lazy_RWRJ2C = () => Promise.resolve().then(function () { return products_post$1; });
const _lazy_7kuZa4 = () => Promise.resolve().then(function () { return share_post$1; });
const _lazy_CTfFMz = () => Promise.resolve().then(function () { return index_get$h; });
const _lazy_ScB6nf = () => Promise.resolve().then(function () { return index_post$7; });
const _lazy_1zJXwa = () => Promise.resolve().then(function () { return _lessonSlug__get$1; });
const _lazy_OyZPOn = () => Promise.resolve().then(function () { return complete_post$1; });
const _lazy_DQT6YB = () => Promise.resolve().then(function () { return enroll_post$1; });
const _lazy_fMDPwz = () => Promise.resolve().then(function () { return index_delete$1; });
const _lazy_1vnyR0 = () => Promise.resolve().then(function () { return index_get$f; });
const _lazy_TrJryK = () => Promise.resolve().then(function () { return index_put$1; });
const _lazy_Rwf2_Q = () => Promise.resolve().then(function () { return lessons_post$1; });
const _lazy_X3v9gU = () => Promise.resolve().then(function () { return _lessonId__delete$1; });
const _lazy_JWIgCr = () => Promise.resolve().then(function () { return modules_post$1; });
const _lazy_iZMtYH = () => Promise.resolve().then(function () { return _moduleId__delete$1; });
const _lazy_Lmvao6 = () => Promise.resolve().then(function () { return _moduleId__put$1; });
const _lazy_d1qV60 = () => Promise.resolve().then(function () { return publish_post$1; });
const _lazy_QicDxD = () => Promise.resolve().then(function () { return unenroll_post$1; });
const _lazy_R_OGzY = () => Promise.resolve().then(function () { return certificates_get$1; });
const _lazy_KegwTJ = () => Promise.resolve().then(function () { return enrollments_get$1; });
const _lazy_y83Zc3 = () => Promise.resolve().then(function () { return index_get$d; });
const _lazy_QJK2we = () => Promise.resolve().then(function () { return index_post$5; });
const _lazy_MJWCL7 = () => Promise.resolve().then(function () { return _conversationId__get$1; });
const _lazy_bdtAxU = () => Promise.resolve().then(function () { return _conversationId__post$1; });
const _lazy_VTyKDL = () => Promise.resolve().then(function () { return stream_get$3; });
const _lazy_hB4OMw = () => Promise.resolve().then(function () { return index_get$b; });
const _lazy_FyqIjH = () => Promise.resolve().then(function () { return index_post$3; });
const _lazy_vP0SVO = () => Promise.resolve().then(function () { return _id__delete$7; });
const _lazy_25WxSl = () => Promise.resolve().then(function () { return count_get$1; });
const _lazy_jIohCW = () => Promise.resolve().then(function () { return index_get$9; });
const _lazy_RPIH2G = () => Promise.resolve().then(function () { return read_post$1; });
const _lazy_P11qqE = () => Promise.resolve().then(function () { return stream_get$1; });
const _lazy_0RdBdA = () => Promise.resolve().then(function () { return openapi_get$1; });
const _lazy_wrgU9F = () => Promise.resolve().then(function () { return _id__delete$5; });
const _lazy_w5HYlr = () => Promise.resolve().then(function () { return _id__put$3; });
const _lazy_HGXzkB = () => Promise.resolve().then(function () { return _slug__get$1; });
const _lazy_17IMid = () => Promise.resolve().then(function () { return content_get$3; });
const _lazy_p6cYPD = () => Promise.resolve().then(function () { return index_get$7; });
const _lazy_hKnS3T = () => Promise.resolve().then(function () { return profile_get$1; });
const _lazy_MjHZeY = () => Promise.resolve().then(function () { return profile_put$1; });
const _lazy_0ZVjVg = () => Promise.resolve().then(function () { return index_get$5; });
const _lazy_GPSZVC = () => Promise.resolve().then(function () { return trending_get$1; });
const _lazy_RZKWJe = () => Promise.resolve().then(function () { return bookmark_post$1; });
const _lazy_NrrwiT = () => Promise.resolve().then(function () { return bookmarks_get$1; });
const _lazy_zTkwK8 = () => Promise.resolve().then(function () { return comments_get$1; });
const _lazy_j5WvfR = () => Promise.resolve().then(function () { return comments_post$1; });
const _lazy_BFGQGB = () => Promise.resolve().then(function () { return _id__delete$3; });
const _lazy_H_NnLL = () => Promise.resolve().then(function () { return like_get$1; });
const _lazy__1MI6F = () => Promise.resolve().then(function () { return like_post$1; });
const _lazy_9ZZaRw = () => Promise.resolve().then(function () { return stats_get$1; });
const _lazy_H03rTy = () => Promise.resolve().then(function () { return _username__get$1; });
const _lazy_04EajR = () => Promise.resolve().then(function () { return content_get$1; });
const _lazy_cfktEX = () => Promise.resolve().then(function () { return feed_xml_get$1; });
const _lazy_0U6x7e = () => Promise.resolve().then(function () { return follow_delete$1; });
const _lazy_a9Dse6 = () => Promise.resolve().then(function () { return follow_post$1; });
const _lazy_v_BuVH = () => Promise.resolve().then(function () { return followers_get$1; });
const _lazy_E79g5r = () => Promise.resolve().then(function () { return following_get$1; });
const _lazy_nKJeMq = () => Promise.resolve().then(function () { return index_get$3; });
const _lazy_41m87_ = () => Promise.resolve().then(function () { return _id__get$1; });
const _lazy_TNPVVm = () => Promise.resolve().then(function () { return categories_get$1; });
const _lazy_s07_Sv = () => Promise.resolve().then(function () { return categories_post$1; });
const _lazy_74X2_5 = () => Promise.resolve().then(function () { return _id__delete$1; });
const _lazy_a5Ikuo = () => Promise.resolve().then(function () { return _id__put$1; });
const _lazy_SM0QnG = () => Promise.resolve().then(function () { return index_get$1; });
const _lazy_V2m1Rm = () => Promise.resolve().then(function () { return index_post$1; });
const _lazy_UfE1f_ = () => Promise.resolve().then(function () { return nodeinfo$1; });
const _lazy_SYVK3d = () => Promise.resolve().then(function () { return webfinger$1; });
const _lazy_WOZO80 = () => Promise.resolve().then(function () { return feed_xml$1; });
const _lazy_JOhz5F = () => Promise.resolve().then(function () { return inbox$3; });
const _lazy_5I7kwM = () => Promise.resolve().then(function () { return _2_1$1; });
const _lazy_DIF4QD = () => Promise.resolve().then(function () { return robots_txt$1; });
const _lazy_nTomkI = () => Promise.resolve().then(function () { return sitemap_xml$1; });
const _lazy_8dZriH = () => Promise.resolve().then(function () { return _username_$1; });
const _lazy_iUTKuI = () => Promise.resolve().then(function () { return followers$1; });
const _lazy_8IfJxf = () => Promise.resolve().then(function () { return following$1; });
const _lazy_joGsUR = () => Promise.resolve().then(function () { return inbox$1; });
const _lazy_pgkIhY = () => Promise.resolve().then(function () { return outbox$1; });
const _lazy_oHgnvy = () => Promise.resolve().then(function () { return renderer$1; });

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
  { route: '/api/docs/:siteSlug/pages', handler: _lazy_TB2PWK, lazy: true, middleware: false, method: "get" },
  { route: '/api/docs/:siteSlug/pages', handler: _lazy_t6h8n4, lazy: true, middleware: false, method: "post" },
  { route: '/api/docs/:siteSlug/pages/:pageId', handler: _lazy_uvwSIz, lazy: true, middleware: false, method: "put" },
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
  { route: '/api/learn/:slug/:lessonSlug', handler: _lazy_1zJXwa, lazy: true, middleware: false, method: "get" },
  { route: '/api/learn/:slug/:lessonSlug/complete', handler: _lazy_OyZPOn, lazy: true, middleware: false, method: "post" },
  { route: '/api/learn/:slug/enroll', handler: _lazy_DQT6YB, lazy: true, middleware: false, method: "post" },
  { route: '/api/learn/:slug', handler: _lazy_fMDPwz, lazy: true, middleware: false, method: "delete" },
  { route: '/api/learn/:slug', handler: _lazy_1vnyR0, lazy: true, middleware: false, method: "get" },
  { route: '/api/learn/:slug', handler: _lazy_TrJryK, lazy: true, middleware: false, method: "put" },
  { route: '/api/learn/:slug/lessons', handler: _lazy_Rwf2_Q, lazy: true, middleware: false, method: "post" },
  { route: '/api/learn/:slug/lessons/:lessonId', handler: _lazy_X3v9gU, lazy: true, middleware: false, method: "delete" },
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
    debug: destr(true),
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
  const router = createRouter$1({
    preemptive: true
  });
  const nodeHandler = toNodeListener(h3App);
  const localCall = (aRequest) => callNodeRequestHandler(
    nodeHandler,
    aRequest
  );
  const localFetch = (input, init) => {
    if (!input.toString().startsWith("/")) {
      return globalThis.fetch(input, init);
    }
    return fetchNodeRequestHandler(
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

const scheduledTasks = false;

const tasks = {
  
};

const __runningTasks__ = {};
async function runTask(name, {
  payload = {},
  context = {}
} = {}) {
  if (__runningTasks__[name]) {
    return __runningTasks__[name];
  }
  if (!(name in tasks)) {
    throw createError({
      message: `Task \`${name}\` is not available!`,
      statusCode: 404
    });
  }
  if (!tasks[name].resolve) {
    throw createError({
      message: `Task \`${name}\` is not implemented!`,
      statusCode: 501
    });
  }
  const handler = await tasks[name].resolve();
  const taskEvent = { name, payload, context };
  __runningTasks__[name] = handler.run(taskEvent);
  try {
    const res = await __runningTasks__[name];
    return res;
  } finally {
    delete __runningTasks__[name];
  }
}

if (!globalThis.crypto) {
  globalThis.crypto = nodeCrypto.webcrypto;
}
const { NITRO_NO_UNIX_SOCKET, NITRO_DEV_WORKER_ID } = process.env;
trapUnhandledNodeErrors();
parentPort?.on("message", (msg) => {
  if (msg && msg.event === "shutdown") {
    shutdown();
  }
});
const nitroApp = useNitroApp();
const server = new Server(toNodeListener(nitroApp.h3App));
let listener;
listen().catch(() => listen(
  true
  /* use random port */
)).catch((error) => {
  console.error("Dev worker failed to listen:", error);
  return shutdown();
});
nitroApp.router.get(
  "/_nitro/tasks",
  defineEventHandler(async (event) => {
    const _tasks = await Promise.all(
      Object.entries(tasks).map(async ([name, task]) => {
        const _task = await task.resolve?.();
        return [name, { description: _task?.meta?.description }];
      })
    );
    return {
      tasks: Object.fromEntries(_tasks),
      scheduledTasks
    };
  })
);
nitroApp.router.use(
  "/_nitro/tasks/:name",
  defineEventHandler(async (event) => {
    const name = getRouterParam(event, "name");
    const payload = {
      ...getQuery$1(event),
      ...await readBody(event).then((r) => r?.payload).catch(() => ({}))
    };
    return await runTask(name, { payload });
  })
);
function listen(useRandomPort = Boolean(
  NITRO_NO_UNIX_SOCKET || process.versions.webcontainer || "Bun" in globalThis && process.platform === "win32"
)) {
  return new Promise((resolve, reject) => {
    try {
      listener = server.listen(useRandomPort ? 0 : getSocketAddress(), () => {
        const address = server.address();
        parentPort?.postMessage({
          event: "listen",
          address: typeof address === "string" ? { socketPath: address } : { host: "localhost", port: address?.port }
        });
        resolve();
      });
    } catch (error) {
      reject(error);
    }
  });
}
function getSocketAddress() {
  const socketName = `nitro-worker-${process.pid}-${threadId}-${NITRO_DEV_WORKER_ID}-${Math.round(Math.random() * 1e4)}.sock`;
  if (process.platform === "win32") {
    return join(String.raw`\\.\pipe`, socketName);
  }
  if (process.platform === "linux") {
    const nodeMajor = Number.parseInt(process.versions.node.split(".")[0], 10);
    if (nodeMajor >= 20) {
      return `\0${socketName}`;
    }
  }
  return join(tmpdir(), socketName);
}
async function shutdown() {
  server.closeAllConnections?.();
  await Promise.all([
    new Promise((resolve) => listener?.close(resolve)),
    nitroApp.hooks.callHook("close").catch(console.error)
  ]);
  parentPort?.postMessage({ event: "exit" });
}

const _messages = {
	"appName": "Nuxt",
	"version": "",
	"status": 500,
	"statusText": "Server error",
	"description": "This page is temporarily unavailable."
};
const template$1 = (messages) => {
	messages = {
		..._messages,
		...messages
	};
	return "<!DOCTYPE html><html lang=\"en\"><head><title>" + escapeHtml(messages.status) + " - " + escapeHtml(messages.statusText) + " | " + escapeHtml(messages.appName) + "</title><meta charset=\"utf-8\"><meta content=\"width=device-width,initial-scale=1.0,minimum-scale=1.0\" name=\"viewport\"><style>.spotlight{background:linear-gradient(45deg,#00dc82,#36e4da 50%,#0047e1);filter:blur(20vh)}*,:after,:before{border-color:var(--un-default-border-color,#e5e7eb);border-style:solid;border-width:0;box-sizing:border-box}:after,:before{--un-content:\"\"}html{line-height:1.5;-webkit-text-size-adjust:100%;font-family:ui-sans-serif,system-ui,sans-serif,Apple Color Emoji,Segoe UI Emoji,Segoe UI Symbol,Noto Color Emoji;font-feature-settings:normal;font-variation-settings:normal;-moz-tab-size:4;tab-size:4;-webkit-tap-highlight-color:transparent}body{line-height:inherit;margin:0}h1{font-size:inherit;font-weight:inherit}h1,p{margin:0}*,:after,:before{--un-rotate:0;--un-rotate-x:0;--un-rotate-y:0;--un-rotate-z:0;--un-scale-x:1;--un-scale-y:1;--un-scale-z:1;--un-skew-x:0;--un-skew-y:0;--un-translate-x:0;--un-translate-y:0;--un-translate-z:0;--un-pan-x: ;--un-pan-y: ;--un-pinch-zoom: ;--un-scroll-snap-strictness:proximity;--un-ordinal: ;--un-slashed-zero: ;--un-numeric-figure: ;--un-numeric-spacing: ;--un-numeric-fraction: ;--un-border-spacing-x:0;--un-border-spacing-y:0;--un-ring-offset-shadow:0 0 transparent;--un-ring-shadow:0 0 transparent;--un-shadow-inset: ;--un-shadow:0 0 transparent;--un-ring-inset: ;--un-ring-offset-width:0px;--un-ring-offset-color:#fff;--un-ring-width:0px;--un-ring-color:rgba(147,197,253,.5);--un-blur: ;--un-brightness: ;--un-contrast: ;--un-drop-shadow: ;--un-grayscale: ;--un-hue-rotate: ;--un-invert: ;--un-saturate: ;--un-sepia: ;--un-backdrop-blur: ;--un-backdrop-brightness: ;--un-backdrop-contrast: ;--un-backdrop-grayscale: ;--un-backdrop-hue-rotate: ;--un-backdrop-invert: ;--un-backdrop-opacity: ;--un-backdrop-saturate: ;--un-backdrop-sepia: }.fixed{position:fixed}.-bottom-1\\/2{bottom:-50%}.left-0{left:0}.right-0{right:0}.grid{display:grid}.mb-16{margin-bottom:4rem}.mb-8{margin-bottom:2rem}.h-1\\/2{height:50%}.max-w-520px{max-width:520px}.min-h-screen{min-height:100vh}.place-content-center{place-content:center}.overflow-hidden{overflow:hidden}.bg-white{--un-bg-opacity:1;background-color:rgb(255 255 255/var(--un-bg-opacity))}.px-8{padding-left:2rem;padding-right:2rem}.text-center{text-align:center}.text-8xl{font-size:6rem;line-height:1}.text-xl{font-size:1.25rem;line-height:1.75rem}.text-black{--un-text-opacity:1;color:rgb(0 0 0/var(--un-text-opacity))}.font-light{font-weight:300}.font-medium{font-weight:500}.leading-tight{line-height:1.25}.font-sans{font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica Neue,Arial,Noto Sans,sans-serif,Apple Color Emoji,Segoe UI Emoji,Segoe UI Symbol,Noto Color Emoji}.antialiased{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}@media(prefers-color-scheme:dark){.dark\\:bg-black{--un-bg-opacity:1;background-color:rgb(0 0 0/var(--un-bg-opacity))}.dark\\:text-white{--un-text-opacity:1;color:rgb(255 255 255/var(--un-text-opacity))}}@media(min-width:640px){.sm\\:px-0{padding-left:0;padding-right:0}.sm\\:text-4xl{font-size:2.25rem;line-height:2.5rem}}</style><script>!function(){const e=document.createElement(\"link\").relList;if(!(e&&e.supports&&e.supports(\"modulepreload\"))){for(const e of document.querySelectorAll('link[rel=\"modulepreload\"]'))r(e);new MutationObserver(e=>{for(const o of e)if(\"childList\"===o.type)for(const e of o.addedNodes)\"LINK\"===e.tagName&&\"modulepreload\"===e.rel&&r(e)}).observe(document,{childList:!0,subtree:!0})}function r(e){if(e.ep)return;e.ep=!0;const r=function(e){const r={};return e.integrity&&(r.integrity=e.integrity),e.referrerPolicy&&(r.referrerPolicy=e.referrerPolicy),\"use-credentials\"===e.crossOrigin?r.credentials=\"include\":\"anonymous\"===e.crossOrigin?r.credentials=\"omit\":r.credentials=\"same-origin\",r}(e);fetch(e.href,r)}}();<\/script></head><body class=\"antialiased bg-white dark:bg-black dark:text-white font-sans grid min-h-screen overflow-hidden place-content-center text-black\"><div class=\"-bottom-1/2 fixed h-1/2 left-0 right-0 spotlight\"></div><div class=\"max-w-520px text-center\"><h1 class=\"font-medium mb-8 sm:text-10xl text-8xl\">" + escapeHtml(messages.status) + "</h1><p class=\"font-light leading-tight mb-16 px-8 sm:px-0 sm:text-4xl text-xl\">" + escapeHtml(messages.description) + "</p></div></body></html>";
};

const error500 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  template: template$1
}, Symbol.toStringTag, { value: 'Module' }));

const template = "";

const _virtual__spaTemplate = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  template: template
}, Symbol.toStringTag, { value: 'Module' }));

const styles = {};

const styles$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: styles
}, Symbol.toStringTag, { value: 'Module' }));

function requireAuth(event) {
  const auth = event.context.auth;
  if (!(auth == null ? void 0 : auth.user)) {
    const cookie = getRequestHeader(event, "cookie") || "";
    const hasSessionCookie = cookie.includes("better-auth.session_token");
    throw createError({
      statusCode: 401,
      statusMessage: hasSessionCookie ? "Session expired or invalid. Please log in again." : "Not logged in. Please log in to continue."
    });
  }
  return auth.user;
}
function requireAdmin(event) {
  const user = requireAuth(event);
  if (user.role !== "admin") {
    throw createError({ statusCode: 403, statusMessage: "Admin access required" });
  }
  return user;
}
function getOptionalUser(event) {
  var _a;
  const auth = event.context.auth;
  return (_a = auth == null ? void 0 : auth.user) != null ? _a : null;
}

const auditQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional()
});
const audit_get = defineEventHandler(async (event) => {
  requireAdmin(event);
  const db = useDB();
  const filters = auditQuerySchema.parse(getQuery$1(event));
  return listAuditLogs(db, filters);
});

const audit_get$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: audit_get
}, Symbol.toStringTag, { value: 'Module' }));

const _id__delete$c = defineEventHandler(async (event) => {
  const admin = requireAdmin(event);
  const db = useDB();
  const id = getRouterParam(event, "id");
  return removeContent(db, id, admin.id);
});

const _id__delete$d = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: _id__delete$c
}, Symbol.toStringTag, { value: 'Module' }));

const reportsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional()
});
const reports_get = defineEventHandler(async (event) => {
  requireAdmin(event);
  const db = useDB();
  const filters = reportsQuerySchema.parse(getQuery$1(event));
  return listReports(db, filters);
});

const reports_get$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: reports_get
}, Symbol.toStringTag, { value: 'Module' }));

const resolve_post = defineEventHandler(async (event) => {
  var _a;
  const admin = requireAdmin(event);
  const db = useDB();
  const id = getRouterParam(event, "id");
  const body = await readBody(event);
  const parsed = resolveReportSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Validation failed",
      data: { errors: parsed.error.flatten().fieldErrors }
    });
  }
  return resolveReport(db, id, parsed.data.resolution, (_a = parsed.data.status) != null ? _a : "resolved", admin.id);
});

const resolve_post$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: resolve_post
}, Symbol.toStringTag, { value: 'Module' }));

const settings_get = defineEventHandler(async (event) => {
  requireAdmin(event);
  const db = useDB();
  return getInstanceSettings(db);
});

const settings_get$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: settings_get
}, Symbol.toStringTag, { value: 'Module' }));

const settings_put = defineEventHandler(async (event) => {
  const admin = requireAdmin(event);
  const db = useDB();
  const body = await readBody(event);
  const parsed = adminSettingSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Validation failed",
      data: { errors: parsed.error.flatten().fieldErrors }
    });
  }
  return setInstanceSetting(db, parsed.data.key, parsed.data.value, admin.id);
});

const settings_put$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: settings_put
}, Symbol.toStringTag, { value: 'Module' }));

const stats_get$2 = defineEventHandler(async (event) => {
  requireAdmin(event);
  const db = useDB();
  return getPlatformStats(db);
});

const stats_get$3 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: stats_get$2
}, Symbol.toStringTag, { value: 'Module' }));

const adminUsersQuerySchema = z.object({
  search: z.string().max(200).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional()
});
const users_get = defineEventHandler(async (event) => {
  requireAdmin(event);
  const db = useDB();
  const filters = adminUsersQuerySchema.parse(getQuery$1(event));
  return listUsers(db, filters);
});

const users_get$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: users_get
}, Symbol.toStringTag, { value: 'Module' }));

const _id__delete$a = defineEventHandler(async (event) => {
  const admin = requireAdmin(event);
  const db = useDB();
  const id = getRouterParam(event, "id");
  return deleteUser(db, id, admin.id);
});

const _id__delete$b = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: _id__delete$a
}, Symbol.toStringTag, { value: 'Module' }));

const role_put = defineEventHandler(async (event) => {
  const admin = requireAdmin(event);
  const db = useDB();
  const id = getRouterParam(event, "id");
  const body = await readBody(event);
  const parsed = adminUpdateRoleSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Validation failed",
      data: { errors: parsed.error.flatten().fieldErrors }
    });
  }
  return updateUserRole(db, id, parsed.data.role, admin.id);
});

const role_put$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: role_put
}, Symbol.toStringTag, { value: 'Module' }));

const status_put = defineEventHandler(async (event) => {
  const admin = requireAdmin(event);
  const db = useDB();
  const id = getRouterParam(event, "id");
  const body = await readBody(event);
  const parsed = adminUpdateStatusSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Validation failed",
      data: { errors: parsed.error.flatten().fieldErrors }
    });
  }
  return updateUserStatus(db, id, parsed.data.status, admin.id);
});

const status_put$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: status_put
}, Symbol.toStringTag, { value: 'Module' }));

const build_post = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const id = getRouterParam(event, "id");
  return toggleBuildMark(db, id, user.id);
});

const build_post$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: build_post
}, Symbol.toStringTag, { value: 'Module' }));

const fork_post = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const id = getRouterParam(event, "id");
  return forkContent(db, id, user.id);
});

const fork_post$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: fork_post
}, Symbol.toStringTag, { value: 'Module' }));

const index_delete$8 = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const id = getRouterParam(event, "id");
  const deleted = await deleteContent(db, id, user.id);
  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: "Content not found or not owned by you" });
  }
  return { success: true };
});

const index_delete$9 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: index_delete$8
}, Symbol.toStringTag, { value: 'Module' }));

const index_get$w = defineEventHandler(async (event) => {
  const db = useDB();
  const slugOrId = getRouterParam(event, "id");
  const user = getOptionalUser(event);
  const content = await getContentBySlug(db, slugOrId, user == null ? void 0 : user.id);
  if (!content) {
    throw createError({ statusCode: 404, statusMessage: "Content not found" });
  }
  return content;
});

const index_get$x = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: index_get$w
}, Symbol.toStringTag, { value: 'Module' }));

const index_put$8 = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const id = getRouterParam(event, "id");
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!id || !uuidRegex.test(id)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid content ID" });
  }
  const body = await readBody(event);
  const parsed = updateContentSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Validation failed",
      data: { errors: parsed.error.flatten().fieldErrors }
    });
  }
  const content = await updateContent(db, id, user.id, parsed.data);
  if (!content) {
    throw createError({ statusCode: 404, statusMessage: "Content not found or not owned by you" });
  }
  return content;
});

const index_put$9 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: index_put$8
}, Symbol.toStringTag, { value: 'Module' }));

const productsSync_post = defineEventHandler(async (event) => {
  const db = useDB();
  requireAuth(event);
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "Content ID is required" });
  }
  const body = await readBody(event);
  if (!Array.isArray(body == null ? void 0 : body.items)) {
    throw createError({ statusCode: 400, statusMessage: "items array is required" });
  }
  return syncContentProducts(db, id, body.items);
});

const productsSync_post$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: productsSync_post
}, Symbol.toStringTag, { value: 'Module' }));

const products_get$2 = defineEventHandler(async (event) => {
  const db = useDB();
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "Content ID is required" });
  }
  return listContentProducts(db, id);
});

const products_get$3 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: products_get$2
}, Symbol.toStringTag, { value: 'Module' }));

const products_post$2 = defineEventHandler(async (event) => {
  const db = useDB();
  requireAuth(event);
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "Content ID is required" });
  }
  const body = await readBody(event);
  const parsed = addContentProductSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: "Invalid input", data: parsed.error.flatten() });
  }
  const result = await addContentProduct(db, id, parsed.data);
  if (!result) {
    throw createError({ statusCode: 404, statusMessage: "Product not found or already linked" });
  }
  return result;
});

const products_post$3 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: products_post$2
}, Symbol.toStringTag, { value: 'Module' }));

const _productId__delete = defineEventHandler(async (event) => {
  const db = useDB();
  requireAuth(event);
  const id = getRouterParam(event, "id");
  const productId = getRouterParam(event, "productId");
  if (!id || !productId) {
    throw createError({ statusCode: 400, statusMessage: "Content ID and Product ID are required" });
  }
  const removed = await removeContentProduct(db, id, productId);
  if (!removed) {
    throw createError({ statusCode: 404, statusMessage: "Product link not found" });
  }
  return { removed: true };
});

const _productId__delete$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: _productId__delete
}, Symbol.toStringTag, { value: 'Module' }));

const publish_post$2 = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const config = useConfig();
  const id = getRouterParam(event, "id");
  const content = await publishContent(db, id, user.id);
  if (!content) {
    throw createError({ statusCode: 404, statusMessage: "Content not found or not owned by you" });
  }
  await onContentPublished(db, id, config);
  return content;
});

const publish_post$3 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: publish_post$2
}, Symbol.toStringTag, { value: 'Module' }));

const report_post = defineEventHandler(async (event) => {
  const db = useDB();
  const user = requireAuth(event);
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "Content ID is required" });
  }
  const body = await readBody(event);
  const parsed = createReportSchema.safeParse({ ...body, targetId: id });
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: "Invalid input", data: parsed.error.flatten() });
  }
  return createReport(db, user.id, parsed.data);
});

const report_post$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: report_post
}, Symbol.toStringTag, { value: 'Module' }));

const versions_get = defineEventHandler(async (event) => {
  const db = useDB();
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "Content ID is required" });
  }
  return listContentVersions(db, id);
});

const versions_get$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: versions_get
}, Symbol.toStringTag, { value: 'Module' }));

const view_post = defineEventHandler(async (event) => {
  const db = useDB();
  const id = getRouterParam(event, "id");
  await incrementViewCount(db, id);
  return { success: true };
});

const view_post$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: view_post
}, Symbol.toStringTag, { value: 'Module' }));

const index_get$u = defineEventHandler(async (event) => {
  var _a;
  const db = useDB();
  const user = getOptionalUser(event);
  const filters = contentFiltersSchema.parse(getQuery$1(event));
  const isOwnContent = filters.authorId && (user == null ? void 0 : user.id) === filters.authorId;
  return listContent(db, {
    ...filters,
    status: isOwnContent ? filters.status : (_a = filters.status) != null ? _a : "published"
  });
});

const index_get$v = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: index_get$u
}, Symbol.toStringTag, { value: 'Module' }));

const index_post$e = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const body = await readBody(event);
  const parsed = createContentSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Validation failed",
      data: { errors: parsed.error.flatten().fieldErrors }
    });
  }
  return createContent(db, user.id, parsed.data);
});

const index_post$f = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: index_post$e
}, Symbol.toStringTag, { value: 'Module' }));

const entries_get = defineEventHandler(async (event) => {
  const db = useDB();
  const slug = getRouterParam(event, "slug");
  if (!slug) throw createError({ statusCode: 400, statusMessage: "Slug required" });
  const contest = await getContestBySlug(db, slug);
  if (!contest) throw createError({ statusCode: 404, statusMessage: "Contest not found" });
  return listContestEntries(db, contest.id);
});

const entries_get$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: entries_get
}, Symbol.toStringTag, { value: 'Module' }));

const submitEntrySchema = z.object({
  contentId: z.string().uuid()
});
const entries_post = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const slug = getRouterParam(event, "slug");
  if (!slug) throw createError({ statusCode: 400, statusMessage: "Slug required" });
  const contest = await getContestBySlug(db, slug);
  if (!contest) throw createError({ statusCode: 404, statusMessage: "Contest not found" });
  const body = await readBody(event);
  const parsed = submitEntrySchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Validation failed",
      data: { errors: parsed.error.flatten().fieldErrors }
    });
  }
  return submitContestEntry(db, contest.id, parsed.data.contentId, user.id);
});

const entries_post$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: entries_post
}, Symbol.toStringTag, { value: 'Module' }));

const index_delete$6 = defineEventHandler(async (event) => {
  const db = useDB();
  const user = requireAuth(event);
  const slug = getRouterParam(event, "slug");
  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: "Contest slug is required" });
  }
  const contest = await getContestBySlug(db, slug);
  if (!contest) {
    throw createError({ statusCode: 404, statusMessage: "Contest not found" });
  }
  const deleted = await deleteContest(db, contest.id, user.id);
  if (!deleted) {
    throw createError({ statusCode: 403, statusMessage: "Not authorized to delete this contest" });
  }
  return { deleted: true };
});

const index_delete$7 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: index_delete$6
}, Symbol.toStringTag, { value: 'Module' }));

const index_get$s = defineEventHandler(async (event) => {
  const db = useDB();
  const slug = getRouterParam(event, "slug");
  if (!slug) throw createError({ statusCode: 400, statusMessage: "Slug required" });
  const contest = await getContestBySlug(db, slug);
  if (!contest) throw createError({ statusCode: 404, statusMessage: "Contest not found" });
  return contest;
});

const index_get$t = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: index_get$s
}, Symbol.toStringTag, { value: 'Module' }));

const index_put$6 = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const slug = getRouterParam(event, "slug");
  if (!slug) throw createError({ statusCode: 400, statusMessage: "Slug required" });
  const body = await readBody(event);
  const parsed = updateContestSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Validation failed",
      data: { errors: parsed.error.flatten().fieldErrors }
    });
  }
  const result = await updateContest(db, slug, user.id, parsed.data);
  if (!result) throw createError({ statusCode: 403, statusMessage: "Not authorized or contest not found" });
  return result;
});

const index_put$7 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: index_put$6
}, Symbol.toStringTag, { value: 'Module' }));

const judge_post = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const body = await readBody(event);
  const parsed = judgeEntrySchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Validation failed",
      data: { errors: parsed.error.flatten().fieldErrors }
    });
  }
  await judgeContestEntry(db, parsed.data.entryId, parsed.data.score, user.id);
  return { success: true };
});

const judge_post$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: judge_post
}, Symbol.toStringTag, { value: 'Module' }));

const transition_post = defineEventHandler(async (event) => {
  const db = useDB();
  const user = requireAuth(event);
  const slug = getRouterParam(event, "slug");
  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: "Contest slug is required" });
  }
  const body = await readBody(event);
  const parsed = contestTransitionSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: "Invalid input", data: parsed.error.flatten() });
  }
  const contest = await getContestBySlug(db, slug);
  if (!contest) {
    throw createError({ statusCode: 404, statusMessage: "Contest not found" });
  }
  const result = await transitionContestStatus(db, contest.id, user.id, parsed.data.status);
  if (!result.transitioned) {
    throw createError({ statusCode: 400, statusMessage: result.error || "Transition failed" });
  }
  return { transitioned: true, newStatus: parsed.data.status };
});

const transition_post$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: transition_post
}, Symbol.toStringTag, { value: 'Module' }));

const index_get$q = defineEventHandler(async (event) => {
  const db = useDB();
  const filters = contestFiltersSchema.parse(getQuery$1(event));
  return listContests(db, filters);
});

const index_get$r = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: index_get$q
}, Symbol.toStringTag, { value: 'Module' }));

const index_post$c = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const body = await readBody(event);
  const parsed = createContestSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Validation failed",
      data: { errors: parsed.error.flatten().fieldErrors }
    });
  }
  return createContest(db, { ...parsed.data, createdBy: user.id });
});

const index_post$d = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: index_post$c
}, Symbol.toStringTag, { value: 'Module' }));

const index_delete$4 = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const siteSlug = getRouterParam(event, "siteSlug");
  const result = await getDocsSiteBySlug(db, siteSlug);
  if (!result) {
    throw createError({ statusCode: 404, statusMessage: "Docs site not found" });
  }
  return deleteDocsSite(db, result.site.id, user.id);
});

const index_delete$5 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: index_delete$4
}, Symbol.toStringTag, { value: 'Module' }));

const index_get$o = defineEventHandler(async (event) => {
  const db = useDB();
  const siteSlug = getRouterParam(event, "siteSlug");
  const site = await getDocsSiteBySlug(db, siteSlug);
  if (!site) {
    throw createError({ statusCode: 404, statusMessage: "Docs site not found" });
  }
  return site;
});

const index_get$p = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: index_get$o
}, Symbol.toStringTag, { value: 'Module' }));

const index_put$4 = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const siteSlug = getRouterParam(event, "siteSlug");
  const body = await readBody(event);
  const parsed = updateDocsSiteSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Validation failed",
      data: { errors: parsed.error.flatten().fieldErrors }
    });
  }
  const result = await getDocsSiteBySlug(db, siteSlug);
  if (!result) {
    throw createError({ statusCode: 404, statusMessage: "Docs site not found" });
  }
  return updateDocsSite(db, result.site.id, user.id, parsed.data);
});

const index_put$5 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: index_put$4
}, Symbol.toStringTag, { value: 'Module' }));

const navQuerySchema = z.object({
  version: z.string().max(32).optional()
});
const nav_get = defineEventHandler(async (event) => {
  const db = useDB();
  const siteSlug = getRouterParam(event, "siteSlug");
  const query = navQuerySchema.parse(getQuery$1(event));
  return getDocsNav(db, siteSlug, query.version);
});

const nav_get$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: nav_get
}, Symbol.toStringTag, { value: 'Module' }));

const pagesQuerySchema = z.object({
  version: z.string().max(32).optional()
});
const pages_get = defineEventHandler(async (event) => {
  const db = useDB();
  const siteSlug = getRouterParam(event, "siteSlug");
  const query = pagesQuerySchema.parse(getQuery$1(event));
  const result = await getDocsSiteBySlug(db, siteSlug);
  if (!result) {
    throw createError({ statusCode: 404, statusMessage: "Docs site not found" });
  }
  const requestedVersion = query.version;
  let version = requestedVersion ? result.versions.find((v) => v.version === requestedVersion) : result.versions.find((v) => v.isDefault === true);
  if (!version && result.versions.length > 0) {
    version = result.versions[0];
  }
  if (!version) {
    throw createError({ statusCode: 404, statusMessage: "No version found for docs site" });
  }
  return listDocsPages(db, version.id);
});

const pages_get$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: pages_get
}, Symbol.toStringTag, { value: 'Module' }));

const pages_post = defineEventHandler(async (event) => {
  var _a;
  const user = requireAuth(event);
  const db = useDB();
  const siteSlug = getRouterParam(event, "siteSlug");
  const body = await readBody(event);
  const parsed = createDocsPageSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Validation failed",
      data: { errors: parsed.error.flatten().fieldErrors }
    });
  }
  const data = { ...parsed.data };
  if (!data.versionId) {
    const result = await getDocsSiteBySlug(db, siteSlug);
    if (!result) {
      throw createError({ statusCode: 404, statusMessage: "Docs site not found" });
    }
    const defaultVersion = (_a = result.versions.find((v) => v.isDefault === true)) != null ? _a : result.versions[0];
    if (!defaultVersion) {
      throw createError({ statusCode: 404, statusMessage: "No version found for docs site" });
    }
    data.versionId = defaultVersion.id;
  }
  return createDocsPage(db, user.id, data);
});

const pages_post$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: pages_post
}, Symbol.toStringTag, { value: 'Module' }));

const _pageId__put = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const pageId = getRouterParam(event, "pageId");
  const body = await readBody(event);
  const parsed = updateDocsPageSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Validation failed",
      data: { errors: parsed.error.flatten().fieldErrors }
    });
  }
  return updateDocsPage(db, pageId, user.id, parsed.data);
});

const _pageId__put$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: _pageId__put
}, Symbol.toStringTag, { value: 'Module' }));

const searchQuerySchema$1 = z.object({
  q: z.string().max(200).optional()
});
const search_get = defineEventHandler(async (event) => {
  var _a;
  const db = useDB();
  const siteSlug = getRouterParam(event, "siteSlug");
  const query = searchQuerySchema$1.parse(getQuery$1(event));
  return searchDocsPages(db, siteSlug, (_a = query.q) != null ? _a : "");
});

const search_get$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: search_get
}, Symbol.toStringTag, { value: 'Module' }));

const versions_post = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const siteSlug = getRouterParam(event, "siteSlug");
  const body = await readBody(event);
  const parsed = createDocsVersionSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Validation failed",
      data: { errors: parsed.error.flatten().fieldErrors }
    });
  }
  return createDocsVersion(db, siteSlug, user.id, parsed.data);
});

const versions_post$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: versions_post
}, Symbol.toStringTag, { value: 'Module' }));

const index_get$m = defineEventHandler(async (event) => {
  const db = useDB();
  return listDocsSites(db);
});

const index_get$n = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: index_get$m
}, Symbol.toStringTag, { value: 'Module' }));

const index_post$a = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const body = await readBody(event);
  const parsed = createDocsSiteSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Validation failed",
      data: { errors: parsed.error.flatten().fieldErrors }
    });
  }
  return createDocsSite(db, user.id, parsed.data);
});

const index_post$b = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: index_post$a
}, Symbol.toStringTag, { value: 'Module' }));

let storage$1 = null;
function getStorage$1() {
  if (!storage$1) storage$1 = createStorageFromEnv();
  return storage$1;
}
const _id__delete$8 = defineEventHandler(async (event) => {
  const db = useDB();
  const user = requireAuth(event);
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "File ID is required" });
  }
  const result = await db.delete(files).where(and(eq(files.id, id), eq(files.uploaderId, user.id))).returning({ id: files.id, storageKey: files.storageKey });
  if (result.length === 0) {
    throw createError({ statusCode: 404, statusMessage: "File not found or not owned by you" });
  }
  try {
    const adapter = getStorage$1();
    await adapter.delete(result[0].storageKey);
  } catch {
    console.warn(`[files] Failed to delete storage key: ${result[0].storageKey}`);
  }
  return { deleted: true };
});

const _id__delete$9 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: _id__delete$8
}, Symbol.toStringTag, { value: 'Module' }));

const mine_get = defineEventHandler(async (event) => {
  const db = useDB();
  const user = requireAuth(event);
  const query = getQuery$1(event);
  const rows = await db.select().from(files).where(eq(files.uploaderId, user.id)).orderBy(desc(files.createdAt)).limit(query.limit ? Number(query.limit) : 50);
  return rows.map((f) => ({
    id: f.id,
    filename: f.filename,
    originalName: f.originalName,
    mimeType: f.mimeType,
    sizeBytes: f.sizeBytes,
    url: f.publicUrl,
    purpose: f.purpose,
    createdAt: f.createdAt
  }));
});

const mine_get$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: mine_get
}, Symbol.toStringTag, { value: 'Module' }));

let storage = null;
function getStorage() {
  if (!storage) storage = createStorageFromEnv();
  return storage;
}
const upload_post = defineEventHandler(async (event) => {
  var _a, _b;
  const db = useDB();
  const user = requireAuth(event);
  const formData = await readMultipartFormData(event);
  if (!formData || formData.length === 0) {
    throw createError({ statusCode: 400, statusMessage: "No file uploaded" });
  }
  const file = formData[0];
  const filename = file.filename || `upload-${Date.now()}`;
  const mimeType = file.type || "application/octet-stream";
  const sizeBytes = file.data.length;
  const purpose = ((_a = formData.find((f) => f.name === "purpose")) == null ? void 0 : _a.data.toString()) || "content";
  const validation = validateUpload(mimeType, sizeBytes, purpose);
  if (!validation.valid) {
    throw createError({ statusCode: 400, statusMessage: (_b = validation.error) != null ? _b : "Invalid upload" });
  }
  const adapter = getStorage();
  let publicUrl;
  let storageKey;
  let width = null;
  let height = null;
  let variants = null;
  if (isProcessableImage(mimeType)) {
    const processed = await processImage(file.data, filename, purpose, adapter);
    publicUrl = processed.originalUrl;
    storageKey = processed.originalKey;
    width = processed.width;
    height = processed.height;
    if (processed.variants.length > 0) {
      variants = {};
      for (const v of processed.variants) {
        variants[v.name] = v.url;
      }
    }
  } else {
    storageKey = generateStorageKey(filename, purpose);
    publicUrl = await adapter.upload(storageKey, file.data, mimeType);
  }
  const [row] = await db.insert(files).values({
    uploaderId: user.id,
    filename: storageKey,
    originalName: filename,
    mimeType,
    sizeBytes,
    storageKey,
    publicUrl,
    purpose,
    width,
    height
  }).returning();
  return {
    id: row.id,
    filename: row.filename,
    originalName: filename,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    url: publicUrl,
    width,
    height,
    variants,
    purpose: row.purpose
  };
});

const upload_post$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: upload_post
}, Symbol.toStringTag, { value: 'Module' }));

const health_get = defineEventHandler(() => ({
  status: "ok",
  timestamp: (/* @__PURE__ */ new Date()).toISOString()
}));

const health_get$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: health_get
}, Symbol.toStringTag, { value: 'Module' }));

const bans_get = defineEventHandler(async (event) => {
  requireAuth(event);
  const db = useDB();
  const slug = getRouterParam(event, "slug");
  const community = await getHubBySlug(db, slug);
  if (!community) {
    throw createError({ statusCode: 404, statusMessage: "Community not found" });
  }
  return listBans(db, community.id);
});

const bans_get$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: bans_get
}, Symbol.toStringTag, { value: 'Module' }));

const bans_post = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const slug = getRouterParam(event, "slug");
  const body = await readBody(event);
  const parsed = banUserSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Validation failed",
      data: { errors: parsed.error.flatten().fieldErrors }
    });
  }
  const hub = await getHubBySlug(db, slug);
  if (!hub) {
    throw createError({ statusCode: 404, statusMessage: "Hub not found" });
  }
  return banUser(
    db,
    user.id,
    hub.id,
    parsed.data.userId,
    parsed.data.reason,
    parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : void 0
  );
});

const bans_post$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: bans_post
}, Symbol.toStringTag, { value: 'Module' }));

const _userId__delete$2 = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const slug = getRouterParam(event, "slug");
  const userId = getRouterParam(event, "userId");
  const community = await getHubBySlug(db, slug);
  if (!community) {
    throw createError({ statusCode: 404, statusMessage: "Community not found" });
  }
  return unbanUser(db, user.id, community.id, userId);
});

const _userId__delete$3 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: _userId__delete$2
}, Symbol.toStringTag, { value: 'Module' }));

function escapeXml$3(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
const feed_xml_get$2 = defineEventHandler(async (event) => {
  var _a, _b;
  const db = useDB();
  const config = useRuntimeConfig();
  const siteUrl = config.public.siteUrl;
  const slug = getRouterParam(event, "slug");
  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: "Hub slug required" });
  }
  const hub = await getHubBySlug(db, slug);
  if (!hub) {
    throw createError({ statusCode: 404, statusMessage: "Hub not found" });
  }
  const { items } = await listHubGallery(db, hub.id, { limit: 50 });
  const lastBuildDate = items.length > 0 ? new Date((_a = items[0].publishedAt) != null ? _a : items[0].createdAt).toUTCString() : (/* @__PURE__ */ new Date()).toUTCString();
  const rssItems = items.map((item) => {
    var _a2, _b2, _c;
    const link = `${siteUrl}/${item.type}/${item.slug}`;
    const pubDate = new Date((_a2 = item.publishedAt) != null ? _a2 : item.createdAt).toUTCString();
    return `    <item>
      <title>${escapeXml$3(item.title)}</title>
      <link>${escapeXml$3(link)}</link>
      <guid isPermaLink="true">${escapeXml$3(link)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml$3((_b2 = item.description) != null ? _b2 : "")}</description>
      <author>${escapeXml$3((_c = item.author.displayName) != null ? _c : item.author.username)}</author>
      <category>${escapeXml$3(item.type)}</category>
    </item>`;
  });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml$3(hub.name)} \u2014 CommonPub</title>
    <link>${escapeXml$3(siteUrl)}/hubs/${escapeXml$3(slug)}</link>
    <description>${escapeXml$3((_b = hub.description) != null ? _b : `Content from ${hub.name}`)}</description>
    <language>en</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${escapeXml$3(siteUrl)}/api/hubs/${escapeXml$3(slug)}/feed.xml" rel="self" type="application/rss+xml"/>
${rssItems.join("\n")}
  </channel>
</rss>`;
  setResponseHeader(event, "Content-Type", "application/rss+xml; charset=utf-8");
  setResponseHeader(event, "Cache-Control", "public, max-age=600, stale-while-revalidate=300");
  return xml;
});

const feed_xml_get$3 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: feed_xml_get$2
}, Symbol.toStringTag, { value: 'Module' }));

const galleryQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional()
});
const gallery_get = defineEventHandler(async (event) => {
  const db = useDB();
  const slug = getRouterParam(event, "slug");
  const query = galleryQuerySchema.parse(getQuery$1(event));
  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: "Hub slug is required" });
  }
  const hub = await getHubBySlug(db, slug);
  if (!hub) {
    throw createError({ statusCode: 404, statusMessage: "Hub not found" });
  }
  return listHubGallery(db, hub.id, query);
});

const gallery_get$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: gallery_get
}, Symbol.toStringTag, { value: 'Module' }));

const index_delete$2 = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const slug = getRouterParam(event, "slug");
  const hub = await getHubBySlug(db, slug, user.id);
  if (!hub) {
    throw createError({ statusCode: 404, statusMessage: "Hub not found" });
  }
  const deleted = await deleteHub(db, hub.id, user.id);
  if (!deleted) {
    throw createError({ statusCode: 403, statusMessage: "Not authorized to delete this hub" });
  }
  return { success: true };
});

const index_delete$3 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: index_delete$2
}, Symbol.toStringTag, { value: 'Module' }));

const index_get$k = defineEventHandler(async (event) => {
  const db = useDB();
  const slug = getRouterParam(event, "slug");
  const user = getOptionalUser(event);
  const community = await getHubBySlug(db, slug, user == null ? void 0 : user.id);
  if (!community) {
    throw createError({ statusCode: 404, statusMessage: "Community not found" });
  }
  return community;
});

const index_get$l = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: index_get$k
}, Symbol.toStringTag, { value: 'Module' }));

const index_put$2 = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const slug = getRouterParam(event, "slug");
  const body = await readBody(event);
  const hub = await getHubBySlug(db, slug, user.id);
  if (!hub) {
    throw createError({ statusCode: 404, statusMessage: "Hub not found" });
  }
  const parsed = updateHubSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Validation failed",
      data: { errors: parsed.error.flatten().fieldErrors }
    });
  }
  const updated = await updateHub(db, hub.id, user.id, parsed.data);
  if (!updated) {
    throw createError({ statusCode: 403, statusMessage: "Not authorized to update this hub" });
  }
  return updated;
});

const index_put$3 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: index_put$2
}, Symbol.toStringTag, { value: 'Module' }));

const invites_get = defineEventHandler(async (event) => {
  requireAuth(event);
  const db = useDB();
  const slug = getRouterParam(event, "slug");
  const community = await getHubBySlug(db, slug);
  if (!community) {
    throw createError({ statusCode: 404, statusMessage: "Community not found" });
  }
  return listInvites(db, community.id);
});

const invites_get$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: invites_get
}, Symbol.toStringTag, { value: 'Module' }));

const invites_post = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const slug = getRouterParam(event, "slug");
  const body = await readBody(event);
  const parsed = createInviteSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Validation failed",
      data: { errors: parsed.error.flatten().fieldErrors }
    });
  }
  const hub = await getHubBySlug(db, slug);
  if (!hub) {
    throw createError({ statusCode: 404, statusMessage: "Hub not found" });
  }
  return createInvite(
    db,
    user.id,
    hub.id,
    parsed.data.maxUses,
    parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : void 0
  );
});

const invites_post$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: invites_post
}, Symbol.toStringTag, { value: 'Module' }));

const join_post = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const slug = getRouterParam(event, "slug");
  const community = await getHubBySlug(db, slug);
  if (!community) {
    throw createError({ statusCode: 404, statusMessage: "Community not found" });
  }
  return joinHub(db, user.id, community.id);
});

const join_post$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: join_post
}, Symbol.toStringTag, { value: 'Module' }));

const leave_post = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const slug = getRouterParam(event, "slug");
  const community = await getHubBySlug(db, slug);
  if (!community) {
    throw createError({ statusCode: 404, statusMessage: "Community not found" });
  }
  return leaveHub(db, user.id, community.id);
});

const leave_post$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: leave_post
}, Symbol.toStringTag, { value: 'Module' }));

const members_get = defineEventHandler(async (event) => {
  const db = useDB();
  const slug = getRouterParam(event, "slug");
  const community = await getHubBySlug(db, slug);
  if (!community) {
    throw createError({ statusCode: 404, statusMessage: "Community not found" });
  }
  return listMembers(db, community.id);
});

const members_get$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: members_get
}, Symbol.toStringTag, { value: 'Module' }));

const _userId__delete = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const slug = getRouterParam(event, "slug");
  const userId = getRouterParam(event, "userId");
  const community = await getHubBySlug(db, slug);
  if (!community) {
    throw createError({ statusCode: 404, statusMessage: "Community not found" });
  }
  return kickMember(db, user.id, community.id, userId);
});

const _userId__delete$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: _userId__delete
}, Symbol.toStringTag, { value: 'Module' }));

const _userId__put = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const slug = getRouterParam(event, "slug");
  const userId = getRouterParam(event, "userId");
  const body = await readBody(event);
  const parsed = changeRoleSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Validation failed",
      data: { errors: parsed.error.flatten().fieldErrors }
    });
  }
  const hub = await getHubBySlug(db, slug);
  if (!hub) {
    throw createError({ statusCode: 404, statusMessage: "Hub not found" });
  }
  return changeRole(db, user.id, hub.id, userId, parsed.data.role);
});

const _userId__put$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: _userId__put
}, Symbol.toStringTag, { value: 'Module' }));

const _postId__delete = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const slug = getRouterParam(event, "slug");
  const postId = getRouterParam(event, "postId");
  const community = await getHubBySlug(db, slug);
  if (!community) {
    throw createError({ statusCode: 404, statusMessage: "Community not found" });
  }
  return deletePost(db, postId, user.id, community.id);
});

const _postId__delete$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: _postId__delete
}, Symbol.toStringTag, { value: 'Module' }));

const replies_get = defineEventHandler(async (event) => {
  const db = useDB();
  const postId = getRouterParam(event, "postId");
  return listReplies(db, postId);
});

const replies_get$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: replies_get
}, Symbol.toStringTag, { value: 'Module' }));

const replies_post = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const postId = getRouterParam(event, "postId");
  const body = await readBody(event);
  const parsed = createReplySchema.safeParse({ ...body, postId });
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Validation failed",
      data: { errors: parsed.error.flatten().fieldErrors }
    });
  }
  return createReply(db, user.id, parsed.data);
});

const replies_post$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: replies_post
}, Symbol.toStringTag, { value: 'Module' }));

const index_get$i = defineEventHandler(async (event) => {
  const db = useDB();
  const slug = getRouterParam(event, "slug");
  const filters = hubPostFiltersSchema.parse(getQuery$1(event));
  const hub = await getHubBySlug(db, slug);
  if (!hub) {
    throw createError({ statusCode: 404, statusMessage: "Hub not found" });
  }
  return listPosts(db, hub.id, filters);
});

const index_get$j = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: index_get$i
}, Symbol.toStringTag, { value: 'Module' }));

const index_post$8 = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const slug = getRouterParam(event, "slug");
  const body = await readBody(event);
  const community = await getHubBySlug(db, slug);
  if (!community) {
    throw createError({ statusCode: 404, statusMessage: "Community not found" });
  }
  const parsed = createPostSchema.safeParse({ hubId: community.id, ...body });
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Validation failed",
      data: { errors: parsed.error.flatten().fieldErrors }
    });
  }
  return createPost(db, user.id, parsed.data);
});

const index_post$9 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: index_post$8
}, Symbol.toStringTag, { value: 'Module' }));

const productQuerySchema = z.object({
  search: z.string().max(200).optional(),
  category: productCategorySchema.optional(),
  status: productStatusSchema.optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional()
});
const products_get = defineEventHandler(async (event) => {
  const db = useDB();
  const slug = getRouterParam(event, "slug");
  const filters = productQuerySchema.parse(getQuery$1(event));
  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: "Hub slug is required" });
  }
  const hub = await getHubBySlug(db, slug);
  if (!hub) {
    throw createError({ statusCode: 404, statusMessage: "Hub not found" });
  }
  return listHubProducts(db, hub.id, filters);
});

const products_get$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: products_get
}, Symbol.toStringTag, { value: 'Module' }));

const products_post = defineEventHandler(async (event) => {
  const db = useDB();
  const user = requireAuth(event);
  const slug = getRouterParam(event, "slug");
  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: "Hub slug is required" });
  }
  const hub = await getHubBySlug(db, slug, user.id);
  if (!hub) {
    throw createError({ statusCode: 404, statusMessage: "Hub not found" });
  }
  const body = await readBody(event);
  const parsed = createProductSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: "Invalid input", data: parsed.error.flatten() });
  }
  return createProduct(db, user.id, hub.id, parsed.data);
});

const products_post$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: products_post
}, Symbol.toStringTag, { value: 'Module' }));

const shareContentSchema = z.object({
  contentId: z.string().uuid()
});
const share_post = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const slug = getRouterParam(event, "slug");
  const body = await readBody(event);
  const parsed = shareContentSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Validation failed",
      data: { errors: parsed.error.flatten().fieldErrors }
    });
  }
  const hub = await getHubBySlug(db, slug);
  if (!hub) {
    throw createError({ statusCode: 404, statusMessage: "Hub not found" });
  }
  return shareContent(db, user.id, hub.id, parsed.data.contentId);
});

const share_post$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: share_post
}, Symbol.toStringTag, { value: 'Module' }));

const index_get$g = defineEventHandler(async (event) => {
  const db = useDB();
  const filters = hubFiltersSchema.parse(getQuery$1(event));
  return listHubs(db, filters);
});

const index_get$h = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: index_get$g
}, Symbol.toStringTag, { value: 'Module' }));

const index_post$6 = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const body = await readBody(event);
  const parsed = createHubSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Validation failed",
      data: { errors: parsed.error.flatten().fieldErrors }
    });
  }
  return createHub(db, user.id, parsed.data);
});

const index_post$7 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: index_post$6
}, Symbol.toStringTag, { value: 'Module' }));

const _lessonSlug__get = defineEventHandler(async (event) => {
  const db = useDB();
  const slug = getRouterParam(event, "slug");
  const lessonSlug = getRouterParam(event, "lessonSlug");
  const lesson = await getLessonBySlug(db, slug, lessonSlug);
  if (!lesson) {
    throw createError({ statusCode: 404, statusMessage: "Lesson not found" });
  }
  return lesson;
});

const _lessonSlug__get$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: _lessonSlug__get
}, Symbol.toStringTag, { value: 'Module' }));

const complete_post = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const slug = getRouterParam(event, "slug");
  const lessonSlug = getRouterParam(event, "lessonSlug");
  const body = await readBody(event).catch(() => ({}));
  const lesson = await getLessonBySlug(db, slug, lessonSlug);
  if (!lesson) throw createError({ statusCode: 404, statusMessage: "Lesson not found" });
  return markLessonComplete(db, user.id, lesson.id, body == null ? void 0 : body.quizScore, body == null ? void 0 : body.quizPassed);
});

const complete_post$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: complete_post
}, Symbol.toStringTag, { value: 'Module' }));

const enroll_post = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const slug = getRouterParam(event, "slug");
  const path = await getPathBySlug(db, slug);
  if (!path) throw createError({ statusCode: 404, statusMessage: "Path not found" });
  return enroll(db, user.id, path.id);
});

const enroll_post$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: enroll_post
}, Symbol.toStringTag, { value: 'Module' }));

const index_delete = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const slug = getRouterParam(event, "slug");
  const path = await getPathBySlug(db, slug);
  if (!path) throw createError({ statusCode: 404, statusMessage: "Path not found" });
  return deletePath(db, path.id, user.id);
});

const index_delete$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: index_delete
}, Symbol.toStringTag, { value: 'Module' }));

const index_get$e = defineEventHandler(async (event) => {
  const db = useDB();
  const slug = getRouterParam(event, "slug");
  const user = getOptionalUser(event);
  const path = await getPathBySlug(db, slug, user == null ? void 0 : user.id);
  if (!path) {
    throw createError({ statusCode: 404, statusMessage: "Learning path not found" });
  }
  return path;
});

const index_get$f = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: index_get$e
}, Symbol.toStringTag, { value: 'Module' }));

const index_put = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const slug = getRouterParam(event, "slug");
  const body = await readBody(event);
  const parsed = updateLearningPathSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Validation failed",
      data: { errors: parsed.error.flatten().fieldErrors }
    });
  }
  const path = await getPathBySlug(db, slug);
  if (!path) throw createError({ statusCode: 404, statusMessage: "Path not found" });
  return updatePath(db, path.id, user.id, parsed.data);
});

const index_put$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: index_put
}, Symbol.toStringTag, { value: 'Module' }));

const lessons_post = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const body = await readBody(event);
  const parsed = createLessonSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Validation failed",
      data: { errors: parsed.error.flatten().fieldErrors }
    });
  }
  return createLesson(db, user.id, parsed.data);
});

const lessons_post$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: lessons_post
}, Symbol.toStringTag, { value: 'Module' }));

const _lessonId__delete = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const lessonId = getRouterParam(event, "lessonId");
  const deleted = await deleteLesson(db, lessonId, user.id);
  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: "Lesson not found or not authorized" });
  }
  return { success: true };
});

const _lessonId__delete$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: _lessonId__delete
}, Symbol.toStringTag, { value: 'Module' }));

const modules_post = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const slug = getRouterParam(event, "slug");
  const body = await readBody(event);
  const parsed = createModuleSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Validation failed",
      data: { errors: parsed.error.flatten().fieldErrors }
    });
  }
  const path = await getPathBySlug(db, slug);
  if (!path) throw createError({ statusCode: 404, statusMessage: "Path not found" });
  return createModule(db, user.id, { ...parsed.data, pathId: path.id });
});

const modules_post$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: modules_post
}, Symbol.toStringTag, { value: 'Module' }));

const _moduleId__delete = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const moduleId = getRouterParam(event, "moduleId");
  const deleted = await deleteModule(db, moduleId, user.id);
  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: "Module not found or not authorized" });
  }
  return { success: true };
});

const _moduleId__delete$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: _moduleId__delete
}, Symbol.toStringTag, { value: 'Module' }));

const _moduleId__put = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const moduleId = getRouterParam(event, "moduleId");
  const body = await readBody(event);
  const parsed = updateModuleSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Validation failed",
      data: { errors: parsed.error.flatten().fieldErrors }
    });
  }
  return updateModule(db, moduleId, user.id, parsed.data);
});

const _moduleId__put$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: _moduleId__put
}, Symbol.toStringTag, { value: 'Module' }));

const publish_post = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const slug = getRouterParam(event, "slug");
  const path = await getPathBySlug(db, slug);
  if (!path) throw createError({ statusCode: 404, statusMessage: "Path not found" });
  return publishPath(db, path.id, user.id);
});

const publish_post$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: publish_post
}, Symbol.toStringTag, { value: 'Module' }));

const unenroll_post = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const slug = getRouterParam(event, "slug");
  const path = await getPathBySlug(db, slug);
  if (!path) throw createError({ statusCode: 404, statusMessage: "Path not found" });
  return unenroll(db, user.id, path.id);
});

const unenroll_post$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: unenroll_post
}, Symbol.toStringTag, { value: 'Module' }));

const certificates_get = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  return getUserCertificates(db, user.id);
});

const certificates_get$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: certificates_get
}, Symbol.toStringTag, { value: 'Module' }));

const enrollments_get = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  return getUserEnrollments(db, user.id);
});

const enrollments_get$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: enrollments_get
}, Symbol.toStringTag, { value: 'Module' }));

const index_get$c = defineEventHandler(async (event) => {
  var _a;
  const db = useDB();
  const filters = learningPathFiltersSchema.parse(getQuery$1(event));
  return listPaths(db, {
    ...filters,
    status: (_a = filters.status) != null ? _a : "published"
  });
});

const index_get$d = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: index_get$c
}, Symbol.toStringTag, { value: 'Module' }));

const index_post$4 = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const body = await readBody(event);
  const parsed = createLearningPathSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Validation failed",
      data: { errors: parsed.error.flatten().fieldErrors }
    });
  }
  return createPath(db, user.id, parsed.data);
});

const index_post$5 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: index_post$4
}, Symbol.toStringTag, { value: 'Module' }));

const _conversationId__get = defineEventHandler(async (event) => {
  const db = useDB();
  const user = await requireAuth(event);
  const conversationId = getRouterParam(event, "conversationId");
  const messages = await getConversationMessages(db, conversationId, user.id);
  await markMessagesRead(db, conversationId, user.id);
  return messages;
});

const _conversationId__get$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: _conversationId__get
}, Symbol.toStringTag, { value: 'Module' }));

const _conversationId__post = defineEventHandler(async (event) => {
  const db = useDB();
  const user = requireAuth(event);
  const conversationId = getRouterParam(event, "conversationId");
  const body = await readBody(event);
  const parsed = sendMessageSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Validation failed",
      data: { errors: parsed.error.flatten().fieldErrors }
    });
  }
  return sendMessage(db, conversationId, user.id, parsed.data.body);
});

const _conversationId__post$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: _conversationId__post
}, Symbol.toStringTag, { value: 'Module' }));

const stream_get$2 = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const userId = user.id;
  const conversationId = getRouterParam(event, "conversationId");
  if (!conversationId) {
    throw createError({ statusCode: 400, statusMessage: "Conversation ID required" });
  }
  const db = useDB();
  setResponseHeader(event, "Content-Type", "text/event-stream");
  setResponseHeader(event, "Cache-Control", "no-cache");
  setResponseHeader(event, "Connection", "keep-alive");
  const encoder = new TextEncoder();
  let lastMessageCount = 0;
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const msgs = await getConversationMessages(db, conversationId, userId);
        lastMessageCount = msgs.length;
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "init", messages: msgs })}

`)
        );
      } catch {
        controller.close();
        return;
      }
      const interval = setInterval(async () => {
        try {
          const msgs = await getConversationMessages(db, conversationId, userId);
          if (msgs.length > lastMessageCount) {
            const newMsgs = msgs.slice(lastMessageCount);
            lastMessageCount = msgs.length;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "new", messages: newMsgs })}

`)
            );
          }
        } catch {
          clearInterval(interval);
          controller.close();
        }
      }, 3e3);
      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          clearInterval(keepalive);
          clearInterval(interval);
        }
      }, 25e3);
      event.node.req.on("close", () => {
        clearInterval(interval);
        clearInterval(keepalive);
        try {
          controller.close();
        } catch {
        }
      });
    }
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    }
  });
});

const stream_get$3 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: stream_get$2
}, Symbol.toStringTag, { value: 'Module' }));

const index_get$a = defineEventHandler(async (event) => {
  const db = useDB();
  const user = await requireAuth(event);
  return listConversations(db, user.id);
});

const index_get$b = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: index_get$a
}, Symbol.toStringTag, { value: 'Module' }));

const index_post$2 = defineEventHandler(async (event) => {
  const db = useDB();
  const user = requireAuth(event);
  const body = await readBody(event);
  const parsed = createConversationSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Validation failed",
      data: { errors: parsed.error.flatten().fieldErrors }
    });
  }
  const participants = parsed.data.participants;
  if (!participants.includes(user.id)) {
    participants.push(user.id);
  }
  return createConversation(db, participants);
});

const index_post$3 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: index_post$2
}, Symbol.toStringTag, { value: 'Module' }));

const _id__delete$6 = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const id = getRouterParam(event, "id");
  await deleteNotification(db, id, user.id);
  return { success: true };
});

const _id__delete$7 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: _id__delete$6
}, Symbol.toStringTag, { value: 'Module' }));

const count_get = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const count = await getUnreadCount(db, user.id);
  return { count };
});

const count_get$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: count_get
}, Symbol.toStringTag, { value: 'Module' }));

const notificationsQuerySchema = z.object({
  type: z.string().max(64).optional(),
  read: z.enum(["true", "false"]).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional()
});
const index_get$8 = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const query = notificationsQuerySchema.parse(getQuery$1(event));
  return listNotifications(db, {
    userId: user.id,
    type: query.type,
    read: query.read !== void 0 ? query.read === "true" : void 0,
    limit: query.limit,
    offset: query.offset
  });
});

const index_get$9 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: index_get$8
}, Symbol.toStringTag, { value: 'Module' }));

const read_post = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const body = await readBody(event);
  if (body.notificationId) {
    await markNotificationRead(db, body.notificationId, user.id);
  } else {
    await markAllNotificationsRead(db, user.id);
  }
  return { success: true };
});

const read_post$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: read_post
}, Symbol.toStringTag, { value: 'Module' }));

const stream_get = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const userId = user.id;
  const db = useDB();
  setResponseHeader(event, "Content-Type", "text/event-stream");
  setResponseHeader(event, "Cache-Control", "no-cache");
  setResponseHeader(event, "Connection", "keep-alive");
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const count = await getUnreadCount(db, userId);
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "count", count })}

`));
      const interval = setInterval(async () => {
        try {
          const currentCount = await getUnreadCount(db, userId);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "count", count: currentCount })}

`));
        } catch {
          clearInterval(interval);
          controller.close();
        }
      }, 1e4);
      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          clearInterval(keepalive);
          clearInterval(interval);
        }
      }, 3e4);
      event.node.req.on("close", () => {
        clearInterval(interval);
        clearInterval(keepalive);
        controller.close();
      });
    }
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    }
  });
});

const stream_get$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: stream_get
}, Symbol.toStringTag, { value: 'Module' }));

const openapi_get = defineEventHandler(() => {
  return generateOpenAPISpec();
});

const openapi_get$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: openapi_get
}, Symbol.toStringTag, { value: 'Module' }));

const _id__delete$4 = defineEventHandler(async (event) => {
  const db = useDB();
  requireAdmin(event);
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "Product ID is required" });
  }
  const deleted = await deleteProduct(db, id);
  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: "Product not found" });
  }
  return { deleted: true };
});

const _id__delete$5 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: _id__delete$4
}, Symbol.toStringTag, { value: 'Module' }));

const _id__put$2 = defineEventHandler(async (event) => {
  const db = useDB();
  const user = requireAuth(event);
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "Product ID is required" });
  }
  const body = await readBody(event);
  const parsed = updateProductSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: "Invalid input", data: parsed.error.flatten() });
  }
  const product = await updateProduct(db, id, user.id, parsed.data);
  if (!product) {
    throw createError({ statusCode: 404, statusMessage: "Product not found" });
  }
  return product;
});

const _id__put$3 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: _id__put$2
}, Symbol.toStringTag, { value: 'Module' }));

const _slug__get = defineEventHandler(async (event) => {
  const db = useDB();
  const slug = getRouterParam(event, "slug");
  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: "Slug is required" });
  }
  const product = await getProductBySlug(db, slug);
  if (!product) {
    throw createError({ statusCode: 404, statusMessage: "Product not found" });
  }
  return product;
});

const _slug__get$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: _slug__get
}, Symbol.toStringTag, { value: 'Module' }));

const content_get$2 = defineEventHandler(async (event) => {
  const db = useDB();
  const slug = getRouterParam(event, "slug");
  const query = getQuery$1(event);
  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: "Slug is required" });
  }
  const product = await getProductBySlug(db, slug);
  if (!product) {
    throw createError({ statusCode: 404, statusMessage: "Product not found" });
  }
  return listProductContent(db, product.id, {
    limit: query.limit ? Number(query.limit) : void 0,
    offset: query.offset ? Number(query.offset) : void 0
  });
});

const content_get$3 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: content_get$2
}, Symbol.toStringTag, { value: 'Module' }));

const productSearchSchema = z.object({
  q: z.string().max(200).optional(),
  search: z.string().max(200).optional(),
  category: productCategorySchema.optional(),
  status: productStatusSchema.optional(),
  hubId: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional()
});
const index_get$6 = defineEventHandler(async (event) => {
  var _a;
  const db = useDB();
  const query = productSearchSchema.parse(getQuery$1(event));
  return searchProducts(db, {
    search: (_a = query.q) != null ? _a : query.search,
    category: query.category,
    status: query.status,
    hubId: query.hubId,
    limit: query.limit,
    offset: query.offset
  });
});

const index_get$7 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: index_get$6
}, Symbol.toStringTag, { value: 'Module' }));

const profile_get = defineEventHandler(async (event) => {
  const db = useDB();
  const user = requireAuth(event);
  const profile = await getUserByUsername(db, user.username);
  if (!profile) {
    throw createError({ statusCode: 404, statusMessage: "Profile not found" });
  }
  return profile;
});

const profile_get$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: profile_get
}, Symbol.toStringTag, { value: 'Module' }));

const profile_put = defineEventHandler(async (event) => {
  const db = useDB();
  const user = requireAuth(event);
  const body = await readBody(event);
  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: "Invalid input", data: parsed.error.flatten() });
  }
  const profile = await updateUserProfile(db, user.id, parsed.data);
  if (!profile) {
    throw createError({ statusCode: 404, statusMessage: "Profile not found" });
  }
  return profile;
});

const profile_put$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: profile_put
}, Symbol.toStringTag, { value: 'Module' }));

const searchQuerySchema = contentFiltersSchema.extend({
  q: z.string().max(200).optional()
});
const index_get$4 = defineEventHandler(async (event) => {
  const db = useDB();
  const filters = searchQuerySchema.parse(getQuery$1(event));
  const q = filters.q || filters.search;
  if (!q) {
    return { items: [], total: 0 };
  }
  return listContent(db, {
    ...filters,
    status: "published",
    search: q
  });
});

const index_get$5 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: index_get$4
}, Symbol.toStringTag, { value: 'Module' }));

const trending_get = defineEventHandler(async () => {
  const db = useDB();
  const rows = await db.select({
    title: contentItems.title,
    viewCount: contentItems.viewCount
  }).from(contentItems).where(sql`${contentItems.status} = 'published'`).orderBy(sql`${contentItems.viewCount} DESC`).limit(8);
  return rows.map((r) => ({
    query: r.title,
    trend: r.viewCount
  }));
});

const trending_get$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: trending_get
}, Symbol.toStringTag, { value: 'Module' }));

const toggleBookmarkSchema = z.object({
  targetType: z.enum(["project", "article", "blog", "explainer", "learning_path"]),
  targetId: z.string().uuid()
});
const bookmark_post = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const body = await readBody(event);
  const parsed = toggleBookmarkSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Validation failed",
      data: { errors: parsed.error.flatten().fieldErrors }
    });
  }
  return toggleBookmark(db, user.id, parsed.data.targetType, parsed.data.targetId);
});

const bookmark_post$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: bookmark_post
}, Symbol.toStringTag, { value: 'Module' }));

const bookmarksQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional()
});
const bookmarks_get = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const query = bookmarksQuerySchema.parse(getQuery$1(event));
  return listUserBookmarks(db, user.id, query);
});

const bookmarks_get$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: bookmarks_get
}, Symbol.toStringTag, { value: 'Module' }));

const commentsQuerySchema = z.object({
  targetType: commentTargetTypeSchema,
  targetId: z.string().uuid()
});
const comments_get = defineEventHandler(async (event) => {
  const db = useDB();
  const query = commentsQuerySchema.parse(getQuery$1(event));
  return listComments(db, query.targetType, query.targetId);
});

const comments_get$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: comments_get
}, Symbol.toStringTag, { value: 'Module' }));

const comments_post = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const body = await readBody(event);
  const parsed = createCommentSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Validation failed",
      data: { errors: parsed.error.flatten().fieldErrors }
    });
  }
  return createComment(db, user.id, parsed.data);
});

const comments_post$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: comments_post
}, Symbol.toStringTag, { value: 'Module' }));

const _id__delete$2 = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const id = getRouterParam(event, "id");
  const deleted = await deleteComment(db, id, user.id);
  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: "Comment not found or not owned by you" });
  }
  return { success: true };
});

const _id__delete$3 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: _id__delete$2
}, Symbol.toStringTag, { value: 'Module' }));

const likeQuerySchema = z.object({
  targetType: likeTargetTypeSchema,
  targetId: z.string().uuid()
});
const like_get = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const query = likeQuerySchema.parse(getQuery$1(event));
  const liked = await isLiked(db, user.id, query.targetType, query.targetId);
  return { liked };
});

const like_get$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: like_get
}, Symbol.toStringTag, { value: 'Module' }));

const toggleLikeSchema = z.object({
  targetType: likeTargetTypeSchema,
  targetId: z.string().uuid()
});
const like_post = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const body = await readBody(event);
  const parsed = toggleLikeSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Validation failed",
      data: { errors: parsed.error.flatten().fieldErrors }
    });
  }
  return toggleLike(db, user.id, parsed.data.targetType, parsed.data.targetId);
});

const like_post$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: like_post
}, Symbol.toStringTag, { value: 'Module' }));

const stats_get = defineEventHandler(async (event) => {
  const db = useDB();
  const stats = await getPlatformStats(db);
  return stats;
});

const stats_get$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: stats_get
}, Symbol.toStringTag, { value: 'Module' }));

const _username__get = defineEventHandler(async (event) => {
  const db = useDB();
  const username = getRouterParam(event, "username");
  const profile = await getUserByUsername(db, username);
  if (!profile) {
    throw createError({ statusCode: 404, statusMessage: "User not found" });
  }
  return profile;
});

const _username__get$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: _username__get
}, Symbol.toStringTag, { value: 'Module' }));

const userContentQuerySchema = z.object({
  type: contentTypeSchema.optional()
});
const content_get = defineEventHandler(async (event) => {
  const db = useDB();
  const username = getRouterParam(event, "username");
  const query = userContentQuerySchema.parse(getQuery$1(event));
  const user = await getUserByUsername(db, username);
  if (!user) {
    throw createError({ statusCode: 404, statusMessage: "User not found" });
  }
  return getUserContent(db, user.id, query.type);
});

const content_get$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: content_get
}, Symbol.toStringTag, { value: 'Module' }));

function escapeXml$2(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
const feed_xml_get = defineEventHandler(async (event) => {
  var _a, _b;
  const db = useDB();
  const config = useRuntimeConfig();
  const siteUrl = config.public.siteUrl;
  const username = getRouterParam(event, "username");
  if (!username) {
    throw createError({ statusCode: 400, statusMessage: "Username required" });
  }
  const user = await getUserByUsername(db, username);
  if (!user) {
    throw createError({ statusCode: 404, statusMessage: "User not found" });
  }
  const { items } = await listContent(db, {
    status: "published",
    authorId: user.id,
    sort: "recent",
    limit: 50
  });
  const displayName = (_a = user.displayName) != null ? _a : user.username;
  const lastBuildDate = items.length > 0 ? new Date((_b = items[0].publishedAt) != null ? _b : items[0].createdAt).toUTCString() : (/* @__PURE__ */ new Date()).toUTCString();
  const rssItems = items.map((item) => {
    var _a2, _b2;
    const link = `${siteUrl}/${item.type}/${item.slug}`;
    const pubDate = new Date((_a2 = item.publishedAt) != null ? _a2 : item.createdAt).toUTCString();
    return `    <item>
      <title>${escapeXml$2(item.title)}</title>
      <link>${escapeXml$2(link)}</link>
      <guid isPermaLink="true">${escapeXml$2(link)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml$2((_b2 = item.description) != null ? _b2 : "")}</description>
      <category>${escapeXml$2(item.type)}</category>
    </item>`;
  });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml$2(displayName)} \u2014 CommonPub</title>
    <link>${escapeXml$2(siteUrl)}/profile/${escapeXml$2(username)}</link>
    <description>Content by ${escapeXml$2(displayName)}</description>
    <language>en</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${escapeXml$2(siteUrl)}/api/users/${escapeXml$2(username)}/feed.xml" rel="self" type="application/rss+xml"/>
${rssItems.join("\n")}
  </channel>
</rss>`;
  setResponseHeader(event, "Content-Type", "application/rss+xml; charset=utf-8");
  setResponseHeader(event, "Cache-Control", "public, max-age=600, stale-while-revalidate=300");
  return xml;
});

const feed_xml_get$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: feed_xml_get
}, Symbol.toStringTag, { value: 'Module' }));

const follow_delete = defineEventHandler(async (event) => {
  const db = useDB();
  const user = requireAuth(event);
  const username = getRouterParam(event, "username");
  if (!username) {
    throw createError({ statusCode: 400, statusMessage: "Username is required" });
  }
  const target = await getUserByUsername(db, username);
  if (!target) {
    throw createError({ statusCode: 404, statusMessage: "User not found" });
  }
  return unfollowUser(db, user.id, target.id);
});

const follow_delete$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: follow_delete
}, Symbol.toStringTag, { value: 'Module' }));

const follow_post = defineEventHandler(async (event) => {
  const db = useDB();
  const user = requireAuth(event);
  const username = getRouterParam(event, "username");
  if (!username) {
    throw createError({ statusCode: 400, statusMessage: "Username is required" });
  }
  const target = await getUserByUsername(db, username);
  if (!target) {
    throw createError({ statusCode: 404, statusMessage: "User not found" });
  }
  return followUser(db, user.id, target.id);
});

const follow_post$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: follow_post
}, Symbol.toStringTag, { value: 'Module' }));

const paginationSchema$1 = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional()
});
const followers_get = defineEventHandler(async (event) => {
  const db = useDB();
  const username = getRouterParam(event, "username");
  const query = paginationSchema$1.parse(getQuery$1(event));
  if (!username) {
    throw createError({ statusCode: 400, statusMessage: "Username is required" });
  }
  const target = await getUserByUsername(db, username);
  if (!target) {
    throw createError({ statusCode: 404, statusMessage: "User not found" });
  }
  return listFollowers(db, target.id, query);
});

const followers_get$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: followers_get
}, Symbol.toStringTag, { value: 'Module' }));

const paginationSchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional()
});
const following_get = defineEventHandler(async (event) => {
  const db = useDB();
  const username = getRouterParam(event, "username");
  const query = paginationSchema.parse(getQuery$1(event));
  if (!username) {
    throw createError({ statusCode: 400, statusMessage: "Username is required" });
  }
  const target = await getUserByUsername(db, username);
  if (!target) {
    throw createError({ statusCode: 404, statusMessage: "User not found" });
  }
  return listFollowing(db, target.id, query);
});

const following_get$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: following_get
}, Symbol.toStringTag, { value: 'Module' }));

const usersQuerySchema = z.object({
  q: z.string().max(200).optional(),
  search: z.string().max(200).optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
  offset: z.coerce.number().int().min(0).optional()
});
const index_get$2 = defineEventHandler(async (event) => {
  var _a, _b;
  const db = useDB();
  const query = usersQuerySchema.parse(getQuery$1(event));
  const limit = (_a = query.limit) != null ? _a : 20;
  const offset = (_b = query.offset) != null ? _b : 0;
  const search = query.q || query.search;
  const conditions = [];
  if (search) {
    const term = `%${search}%`;
    conditions.push(or(ilike(users.username, term), ilike(users.displayName, term)));
  }
  const where = conditions.length > 0 ? conditions[0] : void 0;
  const rows = await db.select({
    id: users.id,
    username: users.username,
    displayName: users.displayName,
    headline: users.bio,
    avatarUrl: users.avatarUrl,
    createdAt: users.createdAt
  }).from(users).where(where).orderBy(desc(users.createdAt)).limit(limit).offset(offset);
  const userIds = rows.map((r) => r.id);
  const followerCounts = {};
  if (userIds.length > 0) {
    const counts = await db.select({
      followingId: follows.followingId,
      count: sql`count(*)::int`
    }).from(follows).where(sql`${follows.followingId} = ANY(ARRAY[${sql.join(userIds.map((id) => sql`${id}::uuid`), sql`, `)}])`).groupBy(follows.followingId);
    for (const c of counts) {
      followerCounts[c.followingId] = c.count;
    }
  }
  const items = rows.map((r) => {
    var _a2;
    return {
      id: r.id,
      username: r.username,
      displayName: r.displayName,
      headline: r.headline,
      avatarUrl: r.avatarUrl,
      followerCount: (_a2 = followerCounts[r.id]) != null ? _a2 : 0
    };
  });
  return { items };
});

const index_get$3 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: index_get$2
}, Symbol.toStringTag, { value: 'Module' }));

const _id__get = defineEventHandler(async (event) => {
  const db = useDB();
  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "ID required" });
  const video = await getVideoById(db, id);
  if (!video) throw createError({ statusCode: 404, statusMessage: "Video not found" });
  await incrementVideoViewCount(db, id);
  return video;
});

const _id__get$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: _id__get
}, Symbol.toStringTag, { value: 'Module' }));

const categories_get = defineEventHandler(async (event) => {
  const db = useDB();
  return listVideoCategories(db);
});

const categories_get$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: categories_get
}, Symbol.toStringTag, { value: 'Module' }));

const categories_post = defineEventHandler(async (event) => {
  var _a, _b;
  requireAdmin(event);
  const body = await readBody(event);
  const parsed = createVideoCategorySchema.safeParse(body);
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: (_b = (_a = parsed.error.issues[0]) == null ? void 0 : _a.message) != null ? _b : "Invalid input" });
  }
  const db = useDB();
  return createVideoCategory(db, parsed.data);
});

const categories_post$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: categories_post
}, Symbol.toStringTag, { value: 'Module' }));

const _id__delete = defineEventHandler(async (event) => {
  requireAdmin(event);
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "Category ID required" });
  }
  const db = useDB();
  const deleted = await deleteVideoCategory(db, id);
  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: "Category not found" });
  }
  return { success: true };
});

const _id__delete$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: _id__delete
}, Symbol.toStringTag, { value: 'Module' }));

const _id__put = defineEventHandler(async (event) => {
  var _a, _b;
  requireAdmin(event);
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "Category ID required" });
  }
  const body = await readBody(event);
  const parsed = createVideoCategorySchema.partial().safeParse(body);
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: (_b = (_a = parsed.error.issues[0]) == null ? void 0 : _a.message) != null ? _b : "Invalid input" });
  }
  const db = useDB();
  const result = await updateVideoCategory(db, id, parsed.data);
  if (!result) {
    throw createError({ statusCode: 404, statusMessage: "Category not found" });
  }
  return result;
});

const _id__put$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: _id__put
}, Symbol.toStringTag, { value: 'Module' }));

const index_get = defineEventHandler(async (event) => {
  const db = useDB();
  const filters = videoFiltersSchema.parse(getQuery$1(event));
  return listVideos(db, filters);
});

const index_get$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: index_get
}, Symbol.toStringTag, { value: 'Module' }));

const index_post = defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const body = await readBody(event);
  const parsed = createVideoSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Validation failed",
      data: { errors: parsed.error.flatten().fieldErrors }
    });
  }
  return createVideo(db, { ...parsed.data, authorId: user.id });
});

const index_post$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: index_post
}, Symbol.toStringTag, { value: 'Module' }));

const nodeinfo = defineEventHandler((event) => {
  const origin = getRequestURL(event).origin;
  return {
    links: [
      {
        rel: "http://nodeinfo.diaspora.software/ns/schema/2.1",
        href: `${origin}/nodeinfo/2.1`
      }
    ]
  };
});

const nodeinfo$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: nodeinfo
}, Symbol.toStringTag, { value: 'Module' }));

const webfinger = defineEventHandler(async (event) => {
  const query = getQuery$1(event);
  const resource = query.resource;
  if (!resource) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing resource parameter"
    });
  }
  const parsed = parseWebFingerResource(resource);
  if (!parsed) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid resource format. Expected acct:user@domain"
    });
  }
  const requestUrl = getRequestURL(event);
  const instanceDomain = requestUrl.host;
  if (parsed.domain !== instanceDomain) {
    throw createError({
      statusCode: 404,
      statusMessage: "Resource not found on this instance"
    });
  }
  const db = useDB();
  const profile = await getUserByUsername(db, parsed.username);
  if (!profile) {
    throw createError({
      statusCode: 404,
      statusMessage: "User not found"
    });
  }
  const actorUri = `https://${instanceDomain}/users/${parsed.username}`;
  setResponseHeader(event, "content-type", "application/jrd+json");
  return buildWebFingerResponse({
    username: parsed.username,
    domain: instanceDomain,
    actorUri
  });
});

const webfinger$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: webfinger
}, Symbol.toStringTag, { value: 'Module' }));

function escapeXml$1(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
const feed_xml = defineEventHandler(async (event) => {
  var _a;
  const db = useDB();
  const config = useRuntimeConfig();
  const siteUrl = config.public.siteUrl;
  const siteName = config.public.siteName;
  const siteDescription = config.public.siteDescription;
  const { items } = await listContent(db, {
    status: "published",
    sort: "recent",
    limit: 50
  });
  const lastBuildDate = items.length > 0 ? new Date((_a = items[0].publishedAt) != null ? _a : items[0].createdAt).toUTCString() : (/* @__PURE__ */ new Date()).toUTCString();
  const rssItems = items.map((item) => {
    var _a2, _b, _c;
    const link = `${siteUrl}/${item.type}/${item.slug}`;
    const pubDate = new Date((_a2 = item.publishedAt) != null ? _a2 : item.createdAt).toUTCString();
    return `    <item>
      <title>${escapeXml$1(item.title)}</title>
      <link>${escapeXml$1(link)}</link>
      <guid isPermaLink="true">${escapeXml$1(link)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml$1((_b = item.description) != null ? _b : "")}</description>
      <author>${escapeXml$1((_c = item.author.displayName) != null ? _c : item.author.username)}</author>
      <category>${escapeXml$1(item.type)}</category>
    </item>`;
  });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml$1(siteName)}</title>
    <link>${escapeXml$1(siteUrl)}</link>
    <description>${escapeXml$1(siteDescription)}</description>
    <language>en</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${escapeXml$1(siteUrl)}/feed.xml" rel="self" type="application/rss+xml"/>
${rssItems.join("\n")}
  </channel>
</rss>`;
  setResponseHeader(event, "Content-Type", "application/rss+xml; charset=utf-8");
  setResponseHeader(event, "Cache-Control", "public, max-age=600, stale-while-revalidate=300");
  return xml;
});

const feed_xml$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: feed_xml
}, Symbol.toStringTag, { value: 'Module' }));

const inbox$2 = defineEventHandler(async (event) => {
  const method = getMethod(event);
  if (method !== "POST") {
    throw createError({ statusCode: 405, statusMessage: "Method Not Allowed" });
  }
  const body = await readBody(event);
  try {
    await processInboxActivity(body);
    return { status: "accepted" };
  } catch (err) {
    console.error("[shared-inbox]", err);
    throw createError({ statusCode: 400, statusMessage: "Invalid activity" });
  }
});

const inbox$3 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: inbox$2
}, Symbol.toStringTag, { value: 'Module' }));

const _2_1 = defineEventHandler(async () => {
  var _a, _b;
  const config = useConfig();
  const db = useDB();
  let userCount = 0;
  let localPostCount = 0;
  try {
    const stats = await getPlatformStats(db);
    userCount = (_a = stats.userCount) != null ? _a : 0;
    localPostCount = (_b = stats.contentCount) != null ? _b : 0;
  } catch {
  }
  return buildNodeInfoResponse({
    config,
    version: "0.0.1",
    userCount,
    activeMonthCount: userCount,
    localPostCount
  });
});

const _2_1$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: _2_1
}, Symbol.toStringTag, { value: 'Module' }));

const robots_txt = defineEventHandler((event) => {
  const config = useRuntimeConfig();
  const siteUrl = config.public.siteUrl;
  const content = `User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /settings/
Disallow: /messages/
Disallow: /create/

Sitemap: ${siteUrl}/sitemap.xml
`;
  setResponseHeader(event, "Content-Type", "text/plain; charset=utf-8");
  setResponseHeader(event, "Cache-Control", "public, max-age=86400");
  return content;
});

const robots_txt$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: robots_txt
}, Symbol.toStringTag, { value: 'Module' }));

function escapeXml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
const sitemap_xml = defineEventHandler(async (event) => {
  const db = useDB();
  const config = useRuntimeConfig();
  const siteUrl = config.public.siteUrl;
  const publishedContent = await db.select({
    type: contentItems.type,
    slug: contentItems.slug,
    updatedAt: contentItems.updatedAt
  }).from(contentItems).where(eq(contentItems.status, "published"));
  const publicUsers = await db.select({
    username: users.username,
    updatedAt: users.updatedAt
  }).from(users).where(eq(users.status, "active"));
  const { items: hubs } = await listHubs(db, { limit: 100 });
  const { items: paths } = await listPaths(db, { status: "published", limit: 100 });
  const urls = [];
  urls.push({ loc: siteUrl, lastmod: (/* @__PURE__ */ new Date()).toISOString(), priority: "1.0", changefreq: "daily" });
  urls.push({ loc: `${siteUrl}/search`, lastmod: (/* @__PURE__ */ new Date()).toISOString(), priority: "0.5", changefreq: "weekly" });
  for (const item of publishedContent) {
    urls.push({
      loc: `${siteUrl}/${item.type}/${item.slug}`,
      lastmod: new Date(item.updatedAt).toISOString(),
      priority: "0.8",
      changefreq: "weekly"
    });
  }
  for (const user of publicUsers) {
    urls.push({
      loc: `${siteUrl}/profile/${user.username}`,
      lastmod: new Date(user.updatedAt).toISOString(),
      priority: "0.6",
      changefreq: "weekly"
    });
  }
  for (const hub of hubs) {
    urls.push({
      loc: `${siteUrl}/hubs/${hub.slug}`,
      lastmod: new Date(hub.createdAt).toISOString(),
      priority: "0.7",
      changefreq: "weekly"
    });
  }
  for (const path of paths) {
    urls.push({
      loc: `${siteUrl}/learn/${path.slug}`,
      lastmod: new Date(path.createdAt).toISOString(),
      priority: "0.7",
      changefreq: "monthly"
    });
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url>
    <loc>${escapeXml(u.loc)}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join("\n")}
</urlset>`;
  setResponseHeader(event, "Content-Type", "application/xml; charset=utf-8");
  setResponseHeader(event, "Cache-Control", "public, max-age=3600, stale-while-revalidate=1800");
  return xml;
});

const sitemap_xml$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: sitemap_xml
}, Symbol.toStringTag, { value: 'Module' }));

const _username_ = defineEventHandler(async (event) => {
  const username = getRouterParam(event, "username");
  const accept = getRequestHeader(event, "accept") || "";
  if (!accept.includes("application/activity+json") && !accept.includes("application/ld+json")) {
    return sendRedirect(event, `/u/${username}`);
  }
  const db = useDB();
  const config = useConfig();
  const profile = await getUserByUsername(db, username);
  if (!profile) {
    throw createError({ statusCode: 404, statusMessage: "Actor not found" });
  }
  const domain = config.instance.domain;
  const actorUri = `https://${domain}/users/${username}`;
  let publicKeyPem = "";
  try {
    const keypair = await getOrCreateActorKeypair(db, profile.id, domain);
    publicKeyPem = keypair.publicKeyPem;
  } catch {
  }
  setResponseHeader(event, "content-type", "application/activity+json");
  return {
    "@context": [
      "https://www.w3.org/ns/activitystreams",
      "https://w3id.org/security/v1"
    ],
    id: actorUri,
    type: "Person",
    preferredUsername: username,
    name: profile.displayName || username,
    summary: profile.bio || "",
    inbox: `${actorUri}/inbox`,
    outbox: `${actorUri}/outbox`,
    followers: `${actorUri}/followers`,
    following: `${actorUri}/following`,
    url: `https://${domain}/u/${username}`,
    ...publicKeyPem ? {
      publicKey: {
        id: `${actorUri}#main-key`,
        owner: actorUri,
        publicKeyPem
      }
    } : {}
  };
});

const _username_$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: _username_
}, Symbol.toStringTag, { value: 'Module' }));

const followers = defineEventHandler(async (event) => {
  const username = getRouterParam(event, "username");
  const db = useDB();
  const config = useConfig();
  const profile = await getUserByUsername(db, username);
  if (!profile) {
    throw createError({ statusCode: 404, statusMessage: "Actor not found" });
  }
  const domain = config.instance.domain;
  const actorUri = `https://${domain}/users/${username}`;
  let followers = [];
  try {
    const result = await getFollowers(db, actorUri);
    followers = result.map((f) => f.followerActorUri);
  } catch {
  }
  setResponseHeader(event, "content-type", "application/activity+json");
  return {
    "@context": "https://www.w3.org/ns/activitystreams",
    id: `${actorUri}/followers`,
    type: "OrderedCollection",
    totalItems: followers.length,
    orderedItems: followers
  };
});

const followers$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: followers
}, Symbol.toStringTag, { value: 'Module' }));

const following = defineEventHandler(async (event) => {
  const username = getRouterParam(event, "username");
  const db = useDB();
  const config = useConfig();
  const profile = await getUserByUsername(db, username);
  if (!profile) {
    throw createError({ statusCode: 404, statusMessage: "Actor not found" });
  }
  const domain = config.instance.domain;
  const actorUri = `https://${domain}/users/${username}`;
  let following = [];
  try {
    const result = await getFollowing(db, actorUri);
    following = result.map((f) => f.followingActorUri);
  } catch {
  }
  setResponseHeader(event, "content-type", "application/activity+json");
  return {
    "@context": "https://www.w3.org/ns/activitystreams",
    id: `${actorUri}/following`,
    type: "OrderedCollection",
    totalItems: following.length,
    orderedItems: following
  };
});

const following$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: following
}, Symbol.toStringTag, { value: 'Module' }));

const inbox = defineEventHandler(async (event) => {
  const method = getMethod(event);
  if (method !== "POST") {
    throw createError({ statusCode: 405, statusMessage: "Method Not Allowed" });
  }
  const body = await readBody(event);
  try {
    await processInboxActivity(body);
    return { status: "accepted" };
  } catch (err) {
    console.error("[inbox]", err);
    throw createError({ statusCode: 400, statusMessage: "Invalid activity" });
  }
});

const inbox$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: inbox
}, Symbol.toStringTag, { value: 'Module' }));

const outbox = defineEventHandler(async (event) => {
  const username = getRouterParam(event, "username");
  const db = useDB();
  const config = useConfig();
  const profile = await getUserByUsername(db, username);
  if (!profile) {
    throw createError({ statusCode: 404, statusMessage: "Actor not found" });
  }
  const actorUri = `https://${config.instance.domain}/users/${username}`;
  setResponseHeader(event, "content-type", "application/activity+json");
  return generateOutboxCollection(actorUri, []);
});

const outbox$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: outbox
}, Symbol.toStringTag, { value: 'Module' }));

function renderPayloadResponse(ssrContext) {
	return {
		body: stringify(splitPayload(ssrContext).payload, ssrContext["~payloadReducers"]) ,
		statusCode: getResponseStatus(ssrContext.event),
		statusMessage: getResponseStatusText(ssrContext.event),
		headers: {
			"content-type": "application/json;charset=utf-8" ,
			"x-powered-by": "Nuxt"
		}
	};
}
function renderPayloadJsonScript(opts) {
	const contents = opts.data ? stringify(opts.data, opts.ssrContext["~payloadReducers"]) : "";
	const payload = {
		"type": "application/json",
		"innerHTML": contents,
		"data-nuxt-data": appId,
		"data-ssr": !(opts.ssrContext.noSSR)
	};
	{
		payload.id = "__NUXT_DATA__";
	}
	if (opts.src) {
		payload["data-src"] = opts.src;
	}
	const config = uneval(opts.ssrContext.config);
	return [payload, { innerHTML: `window.__NUXT__={};window.__NUXT__.config=${config}` }];
}
function splitPayload(ssrContext) {
	const { data, prerenderedAt, ...initial } = ssrContext.payload;
	return {
		initial: {
			...initial,
			prerenderedAt
		},
		payload: {
			data,
			prerenderedAt
		}
	};
}

const renderSSRHeadOptions = {"omitLineBreaks":false};

// @ts-expect-error private property consumed by vite-generated url helpers
globalThis.__buildAssetsURL = buildAssetsURL;
// @ts-expect-error private property consumed by vite-generated url helpers
globalThis.__publicAssetsURL = publicAssetsURL;
const HAS_APP_TELEPORTS = !!(appTeleportAttrs.id);
const APP_TELEPORT_OPEN_TAG = HAS_APP_TELEPORTS ? `<${appTeleportTag}${propsToString(appTeleportAttrs)}>` : "";
const APP_TELEPORT_CLOSE_TAG = HAS_APP_TELEPORTS ? `</${appTeleportTag}>` : "";
const PAYLOAD_URL_RE = /^[^?]*\/_payload.json(?:\?.*)?$/ ;
const PAYLOAD_FILENAME = "_payload.json" ;
const renderer = defineRenderHandler(async (event) => {
	const nitroApp = useNitroApp();
	// Whether we're rendering an error page
	const ssrError = event.path.startsWith("/__nuxt_error") ? getQuery$1(event) : null;
	if (ssrError && !("__unenv__" in event.node.req)) {
		throw createError({
			status: 404,
			statusText: "Page Not Found: /__nuxt_error",
			message: "Page Not Found: /__nuxt_error"
		});
	}
	// Initialize ssr context
	const ssrContext = createSSRContext(event);
	// needed for hash hydration plugin to work
	const headEntryOptions = { mode: "server" };
	ssrContext.head.push(appHead, headEntryOptions);
	if (ssrError) {
		// eslint-disable-next-line @typescript-eslint/no-deprecated
		const status = ssrError.status || ssrError.statusCode;
		if (status) {
			// eslint-disable-next-line @typescript-eslint/no-deprecated
			ssrError.status = ssrError.statusCode = Number.parseInt(status);
		}
		setSSRError(ssrContext, ssrError);
	}
	// Get route options (for `ssr: false`, `isr`, `cache` and `noScripts`)
	const routeOptions = getRouteRules(event);
	// Whether we are prerendering route or using ISR/SWR caching
	const _PAYLOAD_EXTRACTION = !ssrContext.noSSR && (NUXT_RUNTIME_PAYLOAD_EXTRACTION);
	const isRenderingPayload = (_PAYLOAD_EXTRACTION || routeOptions.prerender) && PAYLOAD_URL_RE.test(ssrContext.url);
	if (isRenderingPayload) {
		const url = ssrContext.url.substring(0, ssrContext.url.lastIndexOf("/")) || "/";
		ssrContext.url = url;
		event._path = event.node.req.url = url;
	}
	if (routeOptions.ssr === false) {
		ssrContext.noSSR = true;
	}
	const payloadURL = _PAYLOAD_EXTRACTION ? joinURL(ssrContext.runtimeConfig.app.cdnURL || ssrContext.runtimeConfig.app.baseURL, ssrContext.url.replace(/\?.*$/, ""), PAYLOAD_FILENAME) + "?" + ssrContext.runtimeConfig.app.buildId : undefined;
	// Render app
	const renderer = await getRenderer(ssrContext);
	const _rendered = await renderer.renderToString(ssrContext).catch(async (error) => {
		// We use error to bypass full render if we have an early response we can make
		// TODO: remove _renderResponse in nuxt v5
		if ((ssrContext["~renderResponse"] || ssrContext._renderResponse) && error.message === "skipping render") {
			return {};
		}
		// Use explicitly thrown error in preference to subsequent rendering errors
		const _err = !ssrError && ssrContext.payload?.error || error;
		await ssrContext.nuxt?.hooks.callHook("app:error", _err);
		throw _err;
	});
	// Render inline styles
	// TODO: remove _renderResponse in nuxt v5
	const inlinedStyles = [];
	await ssrContext.nuxt?.hooks.callHook("app:rendered", {
		ssrContext,
		renderResult: _rendered
	});
	if (ssrContext["~renderResponse"] || ssrContext._renderResponse) {
		// TODO: remove _renderResponse in nuxt v5
		return ssrContext["~renderResponse"] || ssrContext._renderResponse;
	}
	// Handle errors
	if (ssrContext.payload?.error && !ssrError) {
		throw ssrContext.payload.error;
	}
	// Directly render payload routes
	if (isRenderingPayload) {
		const response = renderPayloadResponse(ssrContext);
		return response;
	}
	const NO_SCRIPTS = routeOptions.noScripts;
	// Setup head
	const { styles, scripts } = getRequestDependencies(ssrContext, renderer.rendererContext);
	// 1. Preload payloads and app manifest
	if (_PAYLOAD_EXTRACTION && !NO_SCRIPTS) {
		ssrContext.head.push({ link: [{
			rel: "preload",
			as: "fetch",
			crossorigin: "anonymous",
			href: payloadURL
		} ] }, headEntryOptions);
	}
	if (ssrContext["~preloadManifest"] && !NO_SCRIPTS) {
		ssrContext.head.push({ link: [{
			rel: "preload",
			as: "fetch",
			fetchpriority: "low",
			crossorigin: "anonymous",
			href: buildAssetsURL(`builds/meta/${ssrContext.runtimeConfig.app.buildId}.json`)
		}] }, {
			...headEntryOptions,
			tagPriority: "low"
		});
	}
	// 2. Styles
	if (inlinedStyles.length) {
		ssrContext.head.push({ style: inlinedStyles });
	}
	const link = [];
	for (const resource of Object.values(styles)) {
		// Do not add links to resources that are inlined (vite v5+)
		if ("inline" in getQuery(resource.file)) {
			continue;
		}
		// Add CSS links in <head> for CSS files
		// - in production
		// - in dev mode when not rendering an island
		link.push({
			rel: "stylesheet",
			href: renderer.rendererContext.buildAssetsURL(resource.file),
			crossorigin: ""
		});
	}
	if (link.length) {
		ssrContext.head.push({ link }, headEntryOptions);
	}
	if (!NO_SCRIPTS) {
		// 4. Resource Hints
		// Remove lazy hydrated modules from ssrContext.modules so they don't get preloaded
		// (CSS links are already added above, this only affects JS preloads)
		if (ssrContext["~lazyHydratedModules"]) {
			for (const id of ssrContext["~lazyHydratedModules"]) {
				ssrContext.modules?.delete(id);
			}
		}
		// TODO: add priorities based on Capo
		ssrContext.head.push({ link: getPreloadLinks(ssrContext, renderer.rendererContext) }, headEntryOptions);
		ssrContext.head.push({ link: getPrefetchLinks(ssrContext, renderer.rendererContext) }, headEntryOptions);
		// 5. Payloads
		ssrContext.head.push({ script: _PAYLOAD_EXTRACTION ? renderPayloadJsonScript({
			ssrContext,
			data: splitPayload(ssrContext).initial,
			src: payloadURL
		})  : renderPayloadJsonScript({
			ssrContext,
			data: ssrContext.payload
		})  }, {
			...headEntryOptions,
			tagPosition: "bodyClose",
			tagPriority: "high"
		});
	}
	// 6. Scripts
	if (!routeOptions.noScripts) {
		const tagPosition = "head";
		ssrContext.head.push({ script: Object.values(scripts).map((resource) => ({
			type: resource.module ? "module" : null,
			src: renderer.rendererContext.buildAssetsURL(resource.file),
			defer: resource.module ? null : true,
			tagPosition,
			crossorigin: ""
		})) }, headEntryOptions);
	}
	const { headTags, bodyTags, bodyTagsOpen, htmlAttrs, bodyAttrs } = await renderSSRHead(ssrContext.head, renderSSRHeadOptions);
	// Create render context
	const htmlContext = {
		htmlAttrs: htmlAttrs ? [htmlAttrs] : [],
		head: normalizeChunks([headTags]),
		bodyAttrs: bodyAttrs ? [bodyAttrs] : [],
		bodyPrepend: normalizeChunks([bodyTagsOpen, ssrContext.teleports?.body]),
		body: [replaceIslandTeleports(ssrContext, _rendered.html) , APP_TELEPORT_OPEN_TAG + (HAS_APP_TELEPORTS ? joinTags([ssrContext.teleports?.[`#${appTeleportAttrs.id}`]]) : "") + APP_TELEPORT_CLOSE_TAG],
		bodyAppend: [bodyTags]
	};
	// Allow hooking into the rendered result
	await nitroApp.hooks.callHook("render:html", htmlContext, { event });
	// Construct HTML response
	return {
		body: renderHTMLDocument(htmlContext),
		statusCode: getResponseStatus(event),
		statusMessage: getResponseStatusText(event),
		headers: {
			"content-type": "text/html;charset=utf-8",
			"x-powered-by": "Nuxt"
		}
	};
});
function normalizeChunks(chunks) {
	const result = [];
	for (const _chunk of chunks) {
		const chunk = _chunk?.trim();
		if (chunk) {
			result.push(chunk);
		}
	}
	return result;
}
function joinTags(tags) {
	return tags.join("");
}
function joinAttrs(chunks) {
	if (chunks.length === 0) {
		return "";
	}
	return " " + chunks.join(" ");
}
function renderHTMLDocument(html) {
	return "<!DOCTYPE html>" + `<html${joinAttrs(html.htmlAttrs)}>` + `<head>${joinTags(html.head)}</head>` + `<body${joinAttrs(html.bodyAttrs)}>${joinTags(html.bodyPrepend)}${joinTags(html.body)}${joinTags(html.bodyAppend)}</body>` + "</html>";
}

const renderer$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: renderer
}, Symbol.toStringTag, { value: 'Module' }));
//# sourceMappingURL=index.mjs.map
