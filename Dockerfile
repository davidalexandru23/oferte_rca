FROM mcr.microsoft.com/playwright:v1.63.0-jammy AS deps

WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM mcr.microsoft.com/playwright:v1.63.0-jammy AS build

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM mcr.microsoft.com/playwright:v1.63.0-jammy

ENV NODE_ENV=production
ENV PORT=8000
WORKDIR /app

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public
RUN mkdir -p /app/data

EXPOSE 8000
CMD ["node", "dist/src/server.js"]
