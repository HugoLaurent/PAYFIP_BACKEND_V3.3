# syntax=docker/dockerfile:1
FROM node:24-alpine AS base

# ---------------------------------------------------------------------------
# deps : dépendances complètes (dev incluses), pour pouvoir builder ensuite
# ---------------------------------------------------------------------------
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts && npm rebuild @swc/core

# ---------------------------------------------------------------------------
# build : compile le TypeScript et produit ./build (bundle autonome)
# ---------------------------------------------------------------------------
FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules /app/node_modules
COPY . .
RUN node ace build

# ---------------------------------------------------------------------------
# production : uniquement le build + les deps de prod
# ---------------------------------------------------------------------------
FROM base AS production
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/build /app
RUN npm ci --ignore-scripts --omit=dev

EXPOSE 3339
CMD ["node", "./bin/server.js"]
