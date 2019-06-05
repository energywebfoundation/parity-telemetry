FROM node:10-alpine
ADD . .
RUN npm install
CMD ["node","src/index.js"]