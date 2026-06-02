FROM node:24-alpine AS builder

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY eolib-ts ./eolib-ts
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

RUN cd eolib-ts && pnpm install --frozen-lockfile && pnpm generate && pnpm build

COPY . .
RUN pnpm build

FROM joseluisq/static-web-server:2-alpine AS runtime

COPY --from=builder /app/dist /home/sws/public

EXPOSE 80
