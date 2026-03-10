FROM node:20-slim
WORKDIR /app
COPY package.json .
RUN npm install --production
COPY . .
EXPOSE 3010
CMD ["node", "src/server.js"]
