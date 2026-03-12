# Stage 1: deps
FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@10.10.0 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/ packages/
COPY apps/ apps/
COPY tools/ tools/
RUN pnpm install --frozen-lockfile

# Stage 2: build
FROM deps AS build
COPY . .
RUN pnpm build

# Stage 3: prod deps only
FROM deps AS prod-deps
RUN pnpm prune --prod

# Stage 4: runtime
FROM node:22-alpine AS runtime
RUN addgroup -S commonpub && adduser -S commonpub -G commonpub
WORKDIR /app
COPY --from=build /app/apps/reference/build ./build
COPY --from=build /app/apps/reference/package.json ./package.json
COPY --from=prod-deps /app/node_modules ./node_modules
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
USER commonpub
CMD ["node", "build/index.js"]
