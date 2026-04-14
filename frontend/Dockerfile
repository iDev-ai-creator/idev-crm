FROM node:20-alpine AS builder
WORKDIR /workspace

# Install idev-ui deps (react peer dependency)
COPY idev-ui/package*.json ./idev-ui/
RUN cd idev-ui && npm install --legacy-peer-deps --prefer-offline 2>/dev/null || npm install --legacy-peer-deps

# Install frontend deps
WORKDIR /workspace/frontend
COPY frontend/package*.json ./
RUN npm ci

# Copy sources
COPY idev-ui/ /workspace/idev-ui/
COPY frontend/ .

# Build
RUN npx vite build

FROM scratch
COPY --from=builder /workspace/frontend/dist /app/dist
VOLUME /app/dist
