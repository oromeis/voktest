FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY server.js ./
COPY index.html ./
COPY styles.css ./
COPY app.js ./
COPY sw.js ./
COPY manifest.webmanifest ./
COPY data ./data
COPY icons ./icons
COPY assets ./assets
COPY modules ./modules
COPY server-data ./server-data

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=5173

EXPOSE 5173

CMD ["node", "server.js"]
