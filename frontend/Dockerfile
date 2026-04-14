FROM node:20-alpine AS builder
WORKDIR /workspace

# Copy idev-ui (local dependency from project root)
COPY idev-ui/ ./idev-ui/

# Install frontend deps
WORKDIR /workspace/frontend
COPY frontend/package*.json ./
RUN npm ci

# Build with vite (skip tsc type-check for production)
COPY frontend/ .
RUN npx vite build

FROM scratch
COPY --from=builder /workspace/frontend/dist /app/dist
VOLUME /app/dist
