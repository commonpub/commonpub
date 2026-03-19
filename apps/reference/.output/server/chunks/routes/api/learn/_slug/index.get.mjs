import { d as defineEventHandler, u as useDB, b5 as getLessonBySlug, p as createError, ac as renderMarkdown } from '../../../../nitro/nitro.mjs';
import { a as parseParams } from '../../../../_/validate.mjs';
import 'drizzle-orm';
import 'unified';
import 'remark-parse';
import 'remark-gfm';
import 'remark-frontmatter';
import 'remark-rehype';
import 'rehype-stringify';
import 'rehype-slug';
import 'rehype-sanitize';
import 'yaml';
import 'drizzle-orm/pg-core';
import 'jose';
import 'node:fs';
import 'node:fs/promises';
import 'node:path';
import 'node:stream/promises';
import 'node:crypto';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'node:url';
import 'zod';
import 'drizzle-orm/node-postgres';
import 'pg';
import 'better-auth';
import 'better-auth/adapters/drizzle';
import 'better-auth/plugins';

function blocksToHtml(blocks) {
  if (!Array.isArray(blocks)) return "";
  const parts = [];
  for (const block of blocks) {
    const [type, data] = block;
    if (!data) continue;
    if (typeof data.html === "string" && data.html) {
      parts.push(data.html);
    } else if (type === "heading" && typeof data.text === "string") {
      const level = Math.min(Math.max(Number(data.level) || 2, 1), 6);
      const escaped = data.text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      parts.push(`<h${level}>${escaped}</h${level}>`);
    } else if (type === "code_block" && typeof data.code === "string") {
      const lang = String(data.language || "").replace(/[^a-zA-Z0-9-]/g, "");
      const escaped = data.code.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      parts.push(`<pre><code class="language-${lang}">${escaped}</code></pre>`);
    } else if (type === "image" && (data.src || data.url)) {
      const src = String(data.src || data.url).replace(/"/g, "&quot;");
      const alt = String(data.alt || "").replace(/"/g, "&quot;");
      if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("/")) {
        parts.push(`<figure><img src="${src}" alt="${alt}" /></figure>`);
      }
    } else if (type === "blockquote" && typeof data.text === "string") {
      const escaped = data.text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      parts.push(`<blockquote>${escaped}</blockquote>`);
    } else if (type === "callout" && typeof data.text === "string") {
      const escaped = data.text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      parts.push(`<div class="cpub-callout">${escaped}</div>`);
    } else if (type === "horizontal_rule" || type === "divider") {
      parts.push("<hr />");
    }
  }
  return parts.join("\n");
}
const index_get = defineEventHandler(async (event) => {
  var _a;
  const db = useDB();
  const { slug, lessonSlug } = parseParams(event, { slug: "string", lessonSlug: "string" });
  const result = await getLessonBySlug(db, slug, lessonSlug);
  if (!result) {
    throw createError({ statusCode: 404, statusMessage: "Lesson not found" });
  }
  let renderedHtml = "";
  if ((_a = result.linkedContent) == null ? void 0 : _a.content) {
    renderedHtml = blocksToHtml(result.linkedContent.content);
  } else {
    const content = result.lesson.content;
    if (content) {
      const md = typeof content.markdown === "string" ? content.markdown : typeof content.notes === "string" ? content.notes : "";
      if (md) {
        const rendered = await renderMarkdown(md);
        renderedHtml = rendered.html;
      }
    }
  }
  return { ...result, renderedHtml };
});

export { index_get as default };
//# sourceMappingURL=index.get.mjs.map
