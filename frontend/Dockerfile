# Sử dụng Node 20 (Alpine linux cho nhẹ)
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

# Cài đặt dependencies
RUN npm install

# Copy toàn bộ code
COPY . .

# Build dự án Next.js
RUN npm run build

# Chạy ứng dụng
CMD ["npm", "start"]