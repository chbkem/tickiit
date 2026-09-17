FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY client/package.json client/package-lock.json ./client/
RUN npm install --prefix client

COPY server/package.json server/package-lock.json ./server/
RUN npm install --prefix server

COPY . .

RUN npm run prisma:generate --prefix server

ENV HOST=0.0.0.0

EXPOSE 3000 5000

CMD ["npm", "run", "dev"]