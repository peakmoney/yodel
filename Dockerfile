FROM node:6.2

# Setup the base app directory
RUN mkdir /usr/src/yodel
WORKDIR /usr/src/yodel

# Pull package.json in. Install things.
# We do it here so it can be cached a bit.
COPY package.json /usr/src/yodel/
RUN npm install --production

# Now bring in the source code.
COPY . /usr/src/yodel

EXPOSE 3402
CMD node app.js
