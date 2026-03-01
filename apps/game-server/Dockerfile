# BossRoom Game Server
# ---- Build stage ----
FROM node:22-slim AS builder
WORKDIR /app

COPY package*.json ./
COPY apps/game-server/package.json apps/game-server/
COPY apps/game-frontend/package.json apps/game-frontend/
COPY libs/shared-types/package.json libs/shared-types/
COPY libs/shared-utils/package.json libs/shared-utils/

RUN npm ci

COPY tsconfig.base.json tsconfig.json nx.json ./
COPY apps/game-server/ apps/game-server/
COPY libs/shared-types/ libs/shared-types/
COPY libs/shared-utils/ libs/shared-utils/

RUN npx nx sync && npx nx build game-server --configuration=production

# ---- Production stage ----
FROM node:22-slim
WORKDIR /app

COPY package*.json ./
COPY apps/game-server/package.json apps/game-server/
COPY apps/game-frontend/package.json apps/game-frontend/
COPY libs/shared-types/package.json libs/shared-types/
COPY libs/shared-utils/package.json libs/shared-utils/

RUN npm ci --omit=dev

# Copy built server + workspace lib outputs
COPY --from=builder /app/apps/game-server/dist/ apps/game-server/dist/
COPY --from=builder /app/libs/shared-types/dist/ libs/shared-types/dist/
COPY --from=builder /app/libs/shared-utils/dist/ libs/shared-utils/dist/

ENV PORT=8080
EXPOSE 8080

CMD ["node", "apps/game-server/dist/main.js"]
