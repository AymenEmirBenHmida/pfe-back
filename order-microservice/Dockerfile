FROM node:alpine as development

WORKDIR /order-microservice

COPY package.json ./
COPY package-lock.json ./

RUN npm install

COPY . .

RUN npm run build

FROM node:alpine as production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /order-microservice

COPY package.json ./
COPY package-lock.json ./

RUN npm install --only=production

COPY --from=development /order-microservice/dist ./dist

CMD ["node", "dist/main"]