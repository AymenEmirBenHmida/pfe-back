FROM node:alpine as development

WORKDIR /gateway

COPY package.json ./
COPY package-lock.json ./

RUN npm install

COPY . .

RUN npm run build

FROM node:alpine as production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /gateway

COPY package.json ./
COPY package-lock.json ./

RUN npm install --only=production

COPY --from=development /gateway/dist ./dist

CMD ["node", "dist/main"]