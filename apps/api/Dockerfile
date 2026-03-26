FROM node:20-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY package.json package-lock.json ./
COPY apps apps
COPY packages packages
COPY services services

RUN npm ci --omit=dev --workspace=@workside/api --include-workspace-root=false \
  && npm cache clean --force

WORKDIR /app/apps/api

EXPOSE 8080

CMD ["npm", "start"]
