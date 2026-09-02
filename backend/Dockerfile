# ============================================================
# TFRS 16 Backend — Production Dockerfile
# ============================================================
#
# ÖNEMLİ — BUILD CONTEXT:
# Bu proje bağımlılıklarını (express, pg, jsonwebtoken, vb.)
# backend/ altında değil, REPO KÖKÜNDEKİ package.json'da tanımlar
# (bkz. /package.json — "main": "backend/server.js"). backend/
# altında yalnızca bir package-lock.json bulunur, package.json
# YOKTUR. Bu yüzden bu image'in REPO KÖKÜNDEN build edilmesi
# gerekir:
#
#   docker build -f backend/Dockerfile -t tfrs16-backend .
#
# (Not: -f ile Dockerfile'ın konumu belirtilir, ama build context
# hâlâ sondaki "." yani repo köküdür — COPY komutları buna göre
# repo köküne relatif çalışır.)
#
# Önceki hali (COPY package*.json ./ + CMD ["node","app.js"])
# repo kökünden değil backend/ dizininden build edildiği
# varsayımıyla yazılmıştı ve gerçek proje yapısıyla uyuşmuyordu
# (backend/package.json yok, backend/app.js HTTP server
# başlatmıyor — bkz. backend/server.js). Bu Dockerfile ile image
# hiç ayağa kalkmıyordu.

FROM node:18-alpine AS base

# Production'da gerekli olmayan araçları/gereksiz katmanları
# azaltmak ve reproducibility için npm cache'i devre dışı bırakılır.
ENV NODE_ENV=production

WORKDIR /app

# Yalnızca bağımlılık manifestleri kopyalanır — böylece kaynak
# kod değiştiğinde Docker layer cache'i (npm install adımı)
# gereksiz yere invalidate olmaz.
COPY package.json package-lock.json* ./

# devDependencies (jest, supertest vb.) production image'a dahil
# edilmez.
RUN npm install --omit=dev --no-audit --no-fund \
    && npm cache clean --force

# Uygulama kaynak kodu.
COPY backend ./backend

# ============================================================
# NON-ROOT USER
# ============================================================
#
# node:18-alpine image'ı hazır bir "node" kullanıcısı/grubu
# (uid/gid 1000) içerir. Container'ın root olarak çalışması,
# bir uygulama açığı (ör. RCE) durumunda saldırganın host'a
# yakın ayrıcalıklarla işlem yapmasına imkan tanıyabileceğinden
# en az ayrıcalık ilkesi gereği açıkça non-root kullanıcıya
# geçilir.
RUN chown -R node:node /app
USER node

EXPOSE 8080

# Basit process-level health check — /health endpoint'i auth
# gerektirmez (bkz. backend/app.js).
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://127.0.0.1:' + (process.env.PORT || 8080) + '/health', res => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# GÜVENLİK: Önceki CMD ["node","app.js"] hem yanlış dosyayı
# (backend/app.js yalnızca Express instance'ını export eder, HTTP
# server BAŞLATMAZ — bkz. backend/app.js docstring'i) hem de
# yanlış çalışma dizinini varsayıyordu. Gerçek HTTP server
# backend/server.js içindedir.
CMD ["node", "backend/server.js"]

COPY frontend ./frontend
