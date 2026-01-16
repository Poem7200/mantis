FROM mcr.microsoft.com/playwright:v1.40.0-focal
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
RUN npx playwright install chromium
EXPOSE 3000
CMD ["npm", "run", "start:prod"]