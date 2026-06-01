FROM node:20-alpine

WORKDIR /app

# Copiamos manifests primero para cachear capas de npm install
COPY package*.json ./

# Producción: --omit=dev (excluye devDependencies). Más robusto que `npm ci`
# cuando hay mismatch de plataforma o caché de build corrupto.
RUN npm install --omit=dev --no-audit --no-fund

# Copiamos el resto del código
COPY . .

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Healthcheck con node puro (no requiere wget/curl)
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=5 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "src/server.js"]
