# ---- Build the website ----
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Run: one Node process serves the website, the API and the SQLite database ----
# Uses only Node's built-in modules (http, sqlite, crypto), so no node_modules are needed here.
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 DATA_DIR=/data DIST_DIR=/app/dist
COPY package.json ./
COPY server ./server
COPY src/lib/ledger.ts ./src/lib/ledger.ts
COPY --from=build /app/dist ./dist
RUN mkdir -p /data && chown -R node:node /data
USER node
EXPOSE 3000
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:3000/api/health || exit 1
CMD ["node", "server/index.ts"]
