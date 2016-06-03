FROM mhart/alpine-node:6.2

WORKDIR /src
ADD . .

RUN npm install

CMD node app.js
