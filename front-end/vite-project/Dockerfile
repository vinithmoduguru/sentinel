# /web/Dockerfile
FROM node:22-alpine

WORKDIR /app

# Copy and install
COPY package*.json ./
RUN npm install

# Copy rest of the frontend
COPY . .

# Build static assets
RUN npm run build

# Expose web port
EXPOSE 5173

# Start the dev server (or serve build)
CMD ["npm", "run", "dev"]

# RUN npm install -g serve
# CMD ["serve", "-s", "dist"]
