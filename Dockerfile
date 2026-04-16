# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (layer-cached unless package.json changes)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .

# Build in mock mode by default — no API keys needed, safe to share/run anywhere
ARG VITE_MOCK_API=true
ARG VITE_API_BASE_URL=http://localhost:5000
ENV VITE_MOCK_API=$VITE_MOCK_API
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build

# ── Stage 2: Serve ───────────────────────────────────────────────────────────
FROM nginx:stable-alpine AS runner

# Copy built static files
COPY --from=builder /app/dist /usr/share/nginx/html

# nginx config: serve SPA (all routes → index.html)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
