# Development Dockerfile for React frontend
FROM node:18-alpine

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install all dependencies (including devDependencies for development)
RUN npm ci

# Copy source code
COPY . .

# Expose port 3000 for React development server
EXPOSE 3000

# Set environment to development
ENV NODE_ENV=development
ENV WDS_SOCKET_PORT=3011

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# Start React development server
CMD ["npm", "start"]