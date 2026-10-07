# Multi-stage so the runtime image does not carry npm's cache or dev files.
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json ./
# --omit=dev leaves test tooling out of the shipped image
RUN npm install --omit=dev

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src

# The node image already has an unprivileged "node" user.
USER node
EXPOSE 3000

# Exec form, so node is PID 1 and gets SIGTERM straight from docker stop.
CMD ["node", "src/server.js"]
