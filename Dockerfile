FROM node:6.9

# This seems like the most sensible place to do upgrades, but it's likely not needed for every build
RUN apt-get update && apt-get upgrade -y

# Setup the base app directory
RUN mkdir /usr/src/yodel
WORKDIR /usr/src/yodel

# Pull package.json in. Install things.
# We do it here so it can be cached a bit.
COPY package.json /usr/src/yodel/
RUN npm install --production

# Now bring in the source code.
COPY . /usr/src/yodel

CMD node app.js
