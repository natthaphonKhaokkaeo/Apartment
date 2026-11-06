# DEV ONLY: production startup remains intentionally blocked by application security guards.
FROM node:24-bookworm-slim AS build
WORKDIR /workspace
RUN npm install -g corepack@0.36.0 && corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/domain/package.json packages/domain/package.json
RUN corepack pnpm install --frozen-lockfile
COPY apps ./apps
COPY packages ./packages
COPY docs/help-knowledge ./docs/help-knowledge
ARG VITE_LIFF_ID=
ENV VITE_LIFF_ID=${VITE_LIFF_ID}
RUN corepack pnpm --filter @apartment/web build

FROM node:24-bookworm-slim AS api
WORKDIR /workspace
ENV NODE_ENV=development
RUN npm install -g corepack@0.36.0 && corepack enable
COPY --from=build /workspace /workspace
EXPOSE 8088
CMD ["corepack","pnpm","--filter","@apartment/api","start"]

FROM nginx:1.27-alpine AS web
COPY --from=build /workspace/apps/web/dist /usr/share/nginx/html
COPY infra/nginx.dev.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=4s --start-period=15s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
