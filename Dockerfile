FROM node:24-alpine AS builder

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY eolib-ts ./eolib-ts
RUN corepack enable
RUN pnpm install --frozen-lockfile

WORKDIR /app/eolib-ts
RUN CI=true pnpm install && pnpm generate && pnpm build
WORKDIR /app

COPY . .
RUN pnpm build

FROM joseluisq/static-web-server:2-alpine AS runtime

COPY --from=builder /app/dist /home/sws/public

EXPOSE 80
