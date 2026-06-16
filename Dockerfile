# Stage 1: deps
FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@10.10.0 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/ packages/
COPY layers/ layers/
COPY apps/ apps/
RUN pnpm install --frozen-lockfile

# Stage 2: build
FROM deps AS build
COPY . .
RUN pnpm build

# Stage 3: runtime (Nuxt outputs a self-contained .output dir)
FROM node:22-alpine AS runtime
RUN corepack enable && corepack prepare pnpm@10.10.0 --activate
RUN addgroup -S commonpub && adduser -S commonpub -G commonpub
WORKDIR /app
COPY --from=build /app/apps/reference/.output ./.output
COPY --from=build /app/apps/reference/node_modules ./node_modules
COPY --from=build /app/apps/reference/drizzle.config.js ./drizzle.config.js
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/packages/schema/dist ./schema/dist
COPY --from=build /app/packages/schema/migrations ./schema/migrations
# Install drizzle-kit + deps for schema push (drizzle-kit needs drizzle-orm + pg driver, schema imports zod)
# type:module required because schema dist files use ES module syntax
RUN echo '{"private":true,"type":"module"}' > package.json && npm install --no-save drizzle-kit@0.31.10 drizzle-orm pg zod
# After the npm install — npm prunes anything not in the freshly-created
# package.json + the deps we just asked for ("removed 11 packages" in
# the build log). That means the @commonpub/* symlinks copied from
# apps/reference/node_modules get reaped. Re-install the two we need
# AFTER npm is done so they survive: wipe-then-COPY drops a real dir
# (vs the original dangling symlink at the path) and stays put because
# npm won't run again.
#
# Why: CLI scripts like scripts/migrate-homepage-layout.mjs do plain
# ESM resolution (vs. Nuxt's nitro bundle, which inlines workspace
# packages into chunks at build time).
RUN rm -rf ./node_modules/@commonpub/schema ./node_modules/@commonpub/server
COPY --from=build /app/packages/schema/package.json ./node_modules/@commonpub/schema/package.json
COPY --from=build /app/packages/schema/dist ./node_modules/@commonpub/schema/dist
COPY --from=build /app/packages/schema/migrations ./node_modules/@commonpub/schema/migrations
COPY --from=build /app/packages/server/package.json ./node_modules/@commonpub/server/package.json
COPY --from=build /app/packages/server/dist ./node_modules/@commonpub/server/dist
# Pre-create the local uploads dir owned by the non-root runtime user. The
# LocalStorageAdapter writes here when no S3 bucket is configured; an empty named
# volume mounted at /app/uploads inherits this ownership so the non-root user can
# write to it (otherwise: EACCES on mkdir → 500 on every upload).
RUN mkdir -p /app/uploads && chown -R commonpub:commonpub /app/uploads
ENV NODE_ENV=production
ENV PORT=3000
ENV NITRO_PORT=3000
ENV UPLOAD_DIR=/app/uploads
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/', (r) => { if(r.statusCode !== 200) throw new Error() })"
USER commonpub
CMD ["node", ".output/server/index.mjs"]
