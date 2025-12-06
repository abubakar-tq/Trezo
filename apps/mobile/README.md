# Trezo Wallet 🔐

A next-generation Web3 wallet built with React Native Expo, featuring Account Abstraction (ERC-4337) and biometric passkey authentication.

## Features

- 🔐 **Account Abstraction (ERC-4337)**: Gasless transactions and smart wallet capabilities
- 🔑 **Passkey Authentication**: Biometric security using fingerprint/Face ID
- 🌐 **Multi-chain Support**: Compatible with EVM chains
- 📱 **Cross-platform**: iOS and Android support
- 🧪 **Comprehensive Testing**: Local testing infrastructure with Docker bundler

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npx expo start
```

For detailed setup, see [docs/QUICKSTART.md](./docs/QUICKSTART.md)

## Documentation

All documentation is in the [docs/](./docs/) folder:

- 📚 [Quick Commands](./docs/QUICK_COMMANDS.md) - Common development commands
- 🧪 [Testing Instructions](./docs/TESTING_INSTRUCTIONS.md) - Local AA wallet testing
- 🚀 [Quickstart Guide](./docs/QUICKSTART.md) - Detailed setup guide
- 🌐 [Environment Setup](./docs/ENV_SETUP.md) - Environment configuration
- 📱 [Platform Testing](./docs/PLATFORM_TESTING.md) - Platform-specific testing
- 🏗️ [Architecture](./docs/COMPONENT_ARCHITECTURE.md) - System architecture
- 🔒 [Security Audit](./docs/SECURITY_AUDIT.md) - Security overview

## Tech Stack

- React Native Expo ~54.0.25
- viem 2.x, ethers.js 6.x
- Supabase Authentication
- ERC-4337 Account Abstraction
- NativeWind (Tailwind CSS)

## Development

```bash
# Run on Android
npx expo run:android

# Run on iOS  
npx expo run:ios

# Clear cache
npx expo start -c
```

## Testing

```bash
# Start local blockchain & bundler
cd Bundler
docker compose up -d

# Run tests in app
npx expo start
# Navigate to: Wallet → AA Test
```

## Project Structure

```
src/
├── core/           # Blockchain & AA core
├── features/       # Feature modules
├── shared/         # Shared components
└── theme/          # Theme system

Bundler/            # Docker testing setup
docs/               # Documentation
scripts/            # Utility scripts
```

## Contributing

1. Branch from `adeel`
2. Make changes
3. Test thoroughly
4. Create PR to `main`

## License

Private - All rights reserved
