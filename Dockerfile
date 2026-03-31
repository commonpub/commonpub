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
COPY --from=build /app/apps/reference/package.json ./package.json
COPY --from=build /app/apps/reference/node_modules ./node_modules
COPY --from=build /app/apps/reference/drizzle.config.ts ./drizzle.config.ts
COPY --from=build /app/packages/schema/dist ./schema/dist
ENV NODE_ENV=production
ENV PORT=3000
ENV NITRO_PORT=3000
EXPOSE 3000
USER commonpub
CMD ["node", ".output/server/index.mjs"]
