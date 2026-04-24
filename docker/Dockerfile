FROM node:20-alpine AS deps
WORKDIR /app

ARG VITE_API_BASE_URL=http://localhost:8080
ARG VITE_GATEWAY_BASE_URL=http://localhost:8080
ARG VITE_API_PROXY_TARGET=http://localhost:8080
ARG VITE_DOCUMENTS_API_BASE_URL=http://localhost:8080
ARG VITE_START_FRONTEND_URL=http://localhost:3000
ARG VITE_SITE_URL=http://localhost:5174
ARG VITE_POST_AUTH_REDIRECT_URL=http://localhost:5174
ARG VITE_ENABLE_REMOTE_DOCS=true
ARG VITE_PORT=5174

ENV VITE_API_BASE_URL=${VITE_API_BASE_URL} \
    VITE_GATEWAY_BASE_URL=${VITE_GATEWAY_BASE_URL} \
    VITE_API_PROXY_TARGET=${VITE_API_PROXY_TARGET} \
    VITE_DOCUMENTS_API_BASE_URL=${VITE_DOCUMENTS_API_BASE_URL} \
    VITE_START_FRONTEND_URL=${VITE_START_FRONTEND_URL} \
    VITE_SITE_URL=${VITE_SITE_URL} \
    VITE_POST_AUTH_REDIRECT_URL=${VITE_POST_AUTH_REDIRECT_URL} \
    VITE_ENABLE_REMOTE_DOCS=${VITE_ENABLE_REMOTE_DOCS} \
    VITE_PORT=${VITE_PORT}

COPY package*.json ./
RUN npm ci

FROM deps AS dev
COPY . .
EXPOSE 5174
CMD ["sh", "-lc", "npm run dev -- --host 0.0.0.0 --port ${VITE_PORT:-5174}"]

FROM deps AS build
COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS production
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
