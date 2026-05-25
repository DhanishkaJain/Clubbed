# 1. Use Node.js version 24 as the base
FROM node:24

# 2. Create app directory
WORKDIR /usr/src/app

# 3. Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# 4. Copy the rest of your code (Note the space between the dots)
COPY . .

# 5. Expose the port your app runs on
EXPOSE 3000

# 6. Command to start the app directly
CMD [ "node", "server.js" ]