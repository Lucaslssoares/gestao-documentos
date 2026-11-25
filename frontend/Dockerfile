# ---- build (Vite) ----
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Variáveis públicas embutidas no bundle no momento do build.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_API_URL=/api
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
    VITE_API_URL=$VITE_API_URL
RUN npm run build

# ---- runtime (nginx: arquivos estáticos + proxy /api → backend) ----
FROM nginx:1.29-alpine
# Template: o nginx substitui ${SUPABASE_AUTH_UPSTREAM} ao iniciar (só variáveis definidas;
# $host, $scheme etc. ficam intactas).
ENV SUPABASE_AUTH_UPSTREAM=http://host.docker.internal:54321
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
