FROM node:lts

RUN apt-get update && apt-get install -y wget gnupg libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libxss1 libasound2 libxshmfence1 libgbm1

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

RUN npx playwright install --with-deps

CMD ["npm", "start"]
