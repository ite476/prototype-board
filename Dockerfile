FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/src/core ./src/core
RUN mkdir /data && chown node:node /data
USER node
ENV PROTOTYPE_BOARD_HOST=0.0.0.0
CMD ["node", "server/main.mjs", "--data-dir", "/data"]
