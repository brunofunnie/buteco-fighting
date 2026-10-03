# syntax=docker/dockerfile:1
FROM node:24-alpine AS asset-build
WORKDIR /build
COPY build/package.json build/package-lock.json ./build/
RUN --mount=type=cache,target=/root/.npm npm ci --prefix build --no-audit --no-fund
COPY build/production-assets.mjs ./build/
COPY package.json package-lock.json index.html server.mjs ./
COPY src/ ./src/
COPY styles/ ./styles/
COPY assets/ ./assets/
ARG ASSET_WORKERS=4
RUN ASSET_WORKERS=$ASSET_WORKERS node build/production-assets.mjs /production

FROM node:24-alpine AS dependencies
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --no-audit --no-fund

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=80 RANKING_DB=/data/rankings.sqlite
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=asset-build /production/ ./
RUN mkdir -p /data && chown node:node /data
VOLUME /data
USER node
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:80/').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "server.mjs"]
