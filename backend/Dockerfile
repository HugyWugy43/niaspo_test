FROM node:20-alpine

WORKDIR /app

# Сначала копируем только файлы зависимостей и устанавливаем их в образе
COPY package.json package-lock.json* ./
RUN npm install

COPY . ./

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["npm", "start"]

