# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app

# Copy lock files first so dependency layer is cached until they change
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and compile
COPY . .
RUN npm run build


# ── Stage 2: Serve ────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS serve

# Remove default placeholder page
RUN rm -rf /usr/share/nginx/html/*

# Copy Vite output from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# The nginx:alpine entrypoint automatically runs envsubst on every file inside
# /etc/nginx/templates/ and writes the result to /etc/nginx/conf.d/.
# This is how we inject the Cloud Run $PORT at container start-up.
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Cloud Run sets $PORT at runtime (default 8080).
# We declare a build-time default so the image works locally without it.
ENV PORT=8080
EXPOSE 8080

# Default nginx:alpine CMD starts nginx in the foreground after template processing
