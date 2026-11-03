# ---- DevOpsHub App image ----
# App mein koi npm dependency nahi hai, isliye image bohat chhoti rehti hai.
FROM node:20-alpine

ARG APP_VERSION=local
ENV NODE_ENV=production \
    APP_VERSION=${APP_VERSION} \
    PORT=3000

WORKDIR /app

COPY package.json ./
COPY src ./src
COPY public ./public

# Security: root ki bajaye non-root user
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "src/server.js"]
