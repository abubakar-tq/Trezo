# ERC-4337 Bundler Infrastructure

This folder contains the Docker-based ERC-4337 Account Abstraction bundler infrastructure required for Trezo Wallet development.

## 🎯 Purpose

Trezo Wallet uses **ERC-4337 Account Abstraction** to provide:
- **Gasless transactions** via paymasters
- **Social recovery** mechanisms
- **Batch transactions** for improved UX
- **Smart contract wallets** instead of EOAs

This bundler infrastructure is **required** for local development and testing of AA wallet features.

---

## 📦 Services

### 1. **Anvil** (Port 8545)
Local Ethereum testnet using Foundry
- Fast block times (0.1s)
- Prague hardfork compatibility
- Provides test accounts with ETH

### 2. **Alto Bundler** (Port 4337)
Pimlico's ERC-4337 bundler
- Processes UserOperations
- Submits bundles to the blockchain
- EntryPoint: `0x0000000071727De22E5E9d8BAf0edAc6f37da032` (v0.7)

### 3. **Mock Paymaster** (Port 3000)
Verifying paymaster for gas sponsorship
- Sponsors transaction gas fees
- Used for gasless transaction testing

### 4. **Contract Deployer**
Deploys required AA contracts on startup:
- EntryPoint contract
- Account factory contracts
- Paymaster contracts

---

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose installed
- No services running on ports 8545, 4337, or 3000

### Start the Bundler

```bash
# Navigate to Bundler directory
cd Bundler

# Pull latest images
docker compose pull

# Start all services
docker compose up
```

### Stop the Bundler

```bash
# Stop services (Ctrl+C or in another terminal)
docker compose down
```

### Run in Background

```bash
# Start detached
docker compose up -d

# View logs
docker compose logs -f

# Stop when done
docker compose down
```

---

## ⚙️ Configuration

### `alto-config.json`

Key settings:
```json
{
  "rpcUrl": "http://anvil:8545",           // Internal blockchain RPC
  "publicRpcUrl": "http://localhost:8545",  // External blockchain RPC
  "entryPoints": ["0x0000000071727De22E5E9d8BAf0edAc6f37da032"],  // ERC-4337 v0.7
  "port": 4337,                             // Bundler port
  "minBalance": "1000000000000000000",      // 1 ETH minimum for operations
  "maxBundleSize": 20,                      // Max UserOps per bundle
  "gasPriceMultipliers": {
    "normal": 1.0,
    "fast": 1.2,
    "instant": 1.5
  }
}
```

### Private Keys (Development Only)

The bundler uses **Anvil's default test private key**:
```
0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

⚠️ **WARNING**: This is a well-known test key. **NEVER** use in production!

---

## 🔗 Integration with Trezo Wallet

### Bundler Endpoints

Once running, your app should connect to:

```typescript
// In your app configuration
const BUNDLER_URL = "http://localhost:4337";
const RPC_URL = "http://localhost:8545";
const PAYMASTER_URL = "http://localhost:3000";
```

### UserOperation Flow

1. **User initiates action** (send tokens, interact with dApp)
2. **App creates UserOperation** with transaction data
3. **Paymaster signs** to sponsor gas (optional)
4. **Bundler receives** UserOp via RPC
5. **Bundler submits** bundle to EntryPoint contract
6. **Blockchain executes** UserOp from smart wallet

---

## 🧪 Testing

### Check Services Health

```bash
# Check if Anvil is running
curl http://localhost:8545 -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"web3_clientVersion","params":[],"id":1}'

# Check if Alto is running
curl http://localhost:4337 -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_supportedEntryPoints","params":[],"id":1}'

# Check if Paymaster is running
curl http://localhost:3000/health
```

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f alto
docker compose logs -f anvil
docker compose logs -f mock-paymaster
```

---

## 🐛 Troubleshooting

### Port Already in Use

If you get port conflicts:

```bash
# Check what's using the port
netstat -ano | findstr :4337
netstat -ano | findstr :8545
netstat -ano | findstr :3000

# Kill the process or stop other services
```

### Services Not Starting

```bash
# Clean up and restart
docker compose down -v
docker compose pull
docker compose up
```

### Reset Everything

```bash
# Remove all containers and volumes
docker compose down -v

# Remove images (will re-download on next start)
docker compose down --rmi all -v

# Start fresh
docker compose up
```

---

## 📚 Resources

- [ERC-4337 Specification](https://eips.ethereum.org/EIPS/eip-4337)
- [Pimlico Alto Bundler](https://github.com/pimlicolabs/alto)
- [Foundry Anvil](https://book.getfoundry.sh/anvil/)
- [Account Abstraction Docs](https://docs.alchemy.com/docs/account-abstraction-overview)

---

## 🔐 Production Notes

When deploying to production:

1. **DO NOT** use these test private keys
2. **Use a production bundler** (Pimlico, Alchemy, etc.)
3. **Configure proper gas pricing**
4. **Set up monitoring** for bundler health
5. **Use a production paymaster** with proper policies
6. **Secure RPC endpoints** with authentication

---

## 📝 Notes

- This setup is **for development only**
- All data is **ephemeral** and resets on restart
- Test accounts are **pre-funded** with ETH
- Block times are **fast** (0.1s) for testing

---

**Need help?** Check the logs or restart the services. The bundler must be running before starting the Trezo Wallet app for AA features to work.
