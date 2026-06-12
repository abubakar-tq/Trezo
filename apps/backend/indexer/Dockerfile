FROM node:20.19-alpine

# Create app directory and assign ownership to node user
RUN mkdir -p /app && chown node:node /app

WORKDIR /app

# Switch context to node user early
USER node

# Copy dependency manifests with correct ownership
COPY --chown=node:node package.json package-lock.json ./

# Install all dependencies (development dependencies are required by Ponder to compile TS config at start)
RUN npm ci

# Copy the rest of the application files with correct ownership
COPY --chown=node:node . .

# Run code generation with dummy RPC URLs to compile TypeScript types without network/env errors
RUN PONDER_BASE_SEPOLIA_RPC_URL=https://dummy PONDER_ETH_SEPOLIA_RPC_URL=https://dummy npm run codegen

# Set production flag
ENV NODE_ENV=production

# Expose API port
EXPOSE 8080

# Run Ponder start, binding to all interfaces and port 8080
CMD ["npm", "run", "start", "--", "--hostname", "0.0.0.0", "--port", "8080"]
