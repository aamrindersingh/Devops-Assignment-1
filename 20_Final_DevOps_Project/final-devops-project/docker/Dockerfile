# Multi stage. The runtime image carries no npm cache, no tests and no
# dev dependencies.
FROM node:20-alpine AS deps
WORKDIR /app
COPY application/package.json ./
RUN npm install --omit=dev

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# tini makes PID 1 a real init, so SIGTERM reaches node and the pod stops
# in a second instead of waiting out the 30s grace period.
RUN apk add --no-cache tini

COPY --from=deps /app/node_modules ./node_modules
COPY application/package.json ./
COPY application/src ./src

# The node image ships an unprivileged "node" user. Running as root in a
# container that is reachable from the internet has no upside.
USER node
EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/server.js"]
