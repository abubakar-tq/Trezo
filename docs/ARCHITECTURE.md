# 🏗️ Trezo Wallet — Architecture Graph

> **Passkey-first ERC-4337 smart contract wallet** — React Native Expo · Foundry · Supabase · Local AA Stack

---

## 1. System Overview

```mermaid
graph TB
    subgraph MONOREPO["📦 trezo-workspace"]
        direction TB
        
        subgraph MOBILE["📱 apps/mobile"]
            direction TB
            EXPO["Expo SDK 54 / RN 0.81"]
            APP_NAV["Navigation Layer"]
            FEATURES["Feature Modules"]
            INTEGRATION["Integration Layer"]
            STORES["Zustand Stores"]
            CORE["Core Services"]
            LIB["Lib / Supabase"]
        end
        
        subgraph BACKEND["⚙️ apps/backend"]
            BUNDLER["Alto Bundler + Anvil\n(Docker Compose)"]
            SUPABASE["Supabase\n(Auth · DB · RLS)"]
        end
        
        subgraph CONTRACTS["🔐 contracts (Foundry)"]
            SRC["Smart Contracts"]
            SCRIPTS["Deploy Scripts"]
            TESTS["Test Suite"]
            DEPLOY_JSON["Deployment Artifacts"]
        end
    end
    
    EXPO --> APP_NAV
    APP_NAV --> FEATURES
    FEATURES --> INTEGRATION
    FEATURES --> STORES
    FEATURES --> CORE
    FEATURES --> LIB
    INTEGRATION --> BUNDLER
    LIB --> SUPABASE
    SCRIPTS --> SRC
    TESTS --> SRC
    INTEGRATION -->|"reads ABIs +\ndeployment JSON"| DEPLOY_JSON
    SCRIPTS -->|"outputs"| DEPLOY_JSON

    style MONOREPO fill:#0d1117,stroke:#58a6ff,stroke-width:2px,color:#c9d1d9
    style MOBILE fill:#161b22,stroke:#7ee787,stroke-width:2px,color:#c9d1d9
    style BACKEND fill:#161b22,stroke:#d2a8ff,stroke-width:2px,color:#c9d1d9
    style CONTRACTS fill:#161b22,stroke:#ffa657,stroke-width:2px,color:#c9d1d9
```

---

## 2. Smart Contract Architecture

```mermaid
graph TD
    subgraph ENTRYPOINT["ERC-4337 EntryPoint (external)"]
        EP["EntryPoint v0.7"]
    end

    subgraph ACCOUNT_LAYER["Account Layer"]
        SA["SmartAccount.sol"]
        AS["AccountStorage.sol"]
        MM["ModuleManager.sol"]
    end

    subgraph FACTORY_LAYER["Factory Layer"]
        AF["AccountFactory.sol"]
        MPF["MinimalProxyFactory.sol"]
    end

    subgraph MODULE_LAYER["Modules (ERC-7579 style)"]
        PV["PasskeyValidator.sol\n🔑 WebAuthn / RIP-7212"]
        SR["SocialRecovery.sol\n👥 Guardian Signatures"]
        ER["EmailRecovery.sol\n📧 zk-Email Proofs"]
    end

    subgraph UTILS["Utilities & Vendor"]
        PC["PasskeyCred.sol"]
        WH["WebAuthnHelper.sol"]
        TY["Types.sol"]
        SU["solidity-stringutils"]
    end

    subgraph INTERFACES["Interfaces"]
        IA["IAccount.sol"]
        IMPF["IMinimalProxyFactory.sol"]
        IPV["IPasskeyValidator (in passkey/interfaces/)"]
        ISR["ISocialRecovery (in SocialRecovery/interfaces/)"]
        IER["IEmailRecovery (in EmailRecovery/interfaces/)"]
    end

    EP -->|"validateUserOp"| SA
    SA --> MM
    SA --> AS
    MM -->|"validator"| PV
    MM -->|"executor"| SR
    MM -->|"executor"| ER
    AF -->|"CREATE2"| SA
    MPF -->|"minimal proxy"| SA
    PV --> PC
    PV --> WH
    SA -.->|"implements"| IA
    MPF -.->|"implements"| IMPF

    style ENTRYPOINT fill:#1a1b26,stroke:#7aa2f7,stroke-width:2px,color:#c0caf5
    style ACCOUNT_LAYER fill:#1a1b26,stroke:#9ece6a,stroke-width:2px,color:#c0caf5
    style FACTORY_LAYER fill:#1a1b26,stroke:#e0af68,stroke-width:2px,color:#c0caf5
    style MODULE_LAYER fill:#1a1b26,stroke:#f7768e,stroke-width:2px,color:#c0caf5
    style UTILS fill:#1a1b26,stroke:#bb9af7,stroke-width:2px,color:#c0caf5
    style INTERFACES fill:#1a1b26,stroke:#565f89,stroke-width:1px,color:#737aa2
```

---

## 3. Mobile App Architecture

```mermaid
graph TD
    subgraph NAV["🧭 Navigation"]
        ROOT["RootNavigation.tsx"]
        AUTH_NAV["AuthNavigation.tsx"]
        APP_NAVI["AppNavigation.tsx"]
        TAB["TabNavigation/"]
    end

    subgraph FEAT["🧩 Feature Modules"]
        F_AUTH["auth/"]
        F_HOME["home/"]
        F_WALLET["wallet/"]
        F_PROFILE["profile/"]
        F_PORTFOLIO["portfolio/"]
        F_BROWSER["browser/"]
        F_DEX["dex/"]
        F_CONTACTS["contacts/"]
    end

    subgraph WALLET_DETAIL["💰 wallet/ (deep view)"]
        W_SCR["Screens"]
        W_SVC["Services"]
        W_CMP["Components"]
        W_HK["Hooks"]
    end

    subgraph SERVICES["🔧 Wallet Services"]
        AAWS["AAWalletService"]
        ADS["AccountDeploymentService"]
        ERS["EmailRecoveryService"]
        PAS["PasskeyAccountService"]
        PS["PasskeyService"]
        SRS["SocialRecoveryService"]
        SWS["SupabaseWalletService"]
        WS["WalletService"]
    end

    subgraph SCREENS["📺 Wallet Screens"]
        AATS["AATestScreen"]
        AWDS["AAWalletDebugScreen"]
        DAS["DeployAccountScreen"]
        DCAS["DevCreateAccountScreen"]
        WDSH["WalletDashboard"]
    end

    subgraph STORE["🗄️ Zustand Stores"]
        S_LOCK["useAppLockStore"]
        S_APPEAR["useAppearanceStore"]
        S_AUTH["useAuthFlowStore"]
        S_BROWSER["useBrowserStore"]
        S_MARKET["useMarketStore"]
        S_RECOVERY["useRecoveryStatusStore"]
        S_USER["useUserStore"]
    end

    ROOT --> AUTH_NAV
    ROOT --> APP_NAVI
    APP_NAVI --> TAB
    
    TAB --> F_HOME
    TAB --> F_WALLET
    TAB --> F_PORTFOLIO
    TAB --> F_BROWSER
    TAB --> F_DEX
    TAB --> F_CONTACTS
    ROOT --> F_PROFILE
    AUTH_NAV --> F_AUTH

    F_WALLET --> WALLET_DETAIL
    WALLET_DETAIL --> W_SCR
    WALLET_DETAIL --> W_SVC
    WALLET_DETAIL --> W_CMP
    WALLET_DETAIL --> W_HK
    W_SCR --> SCREENS
    W_SVC --> SERVICES

    SERVICES --> STORE
    SCREENS --> STORE

    style NAV fill:#1e1e2e,stroke:#89b4fa,stroke-width:2px,color:#cdd6f4
    style FEAT fill:#1e1e2e,stroke:#a6e3a1,stroke-width:2px,color:#cdd6f4
    style WALLET_DETAIL fill:#1e1e2e,stroke:#f9e2af,stroke-width:2px,color:#cdd6f4
    style SERVICES fill:#1e1e2e,stroke:#fab387,stroke-width:2px,color:#cdd6f4
    style SCREENS fill:#1e1e2e,stroke:#cba6f7,stroke-width:2px,color:#cdd6f4
    style STORE fill:#1e1e2e,stroke:#f38ba8,stroke-width:2px,color:#cdd6f4
```

---

## 4. Integration Layer — Contract Bridge

```mermaid
graph LR
    subgraph MOBILE_INT["📱 src/integration/"]
        ABIS["abi/\n6 JSON ABIs"]
        CHAINS["chains.ts"]
        CONTRACTS["contracts/\ndeployment.31337.json"]
        VIEM["viem/"]
    end

    subgraph VIEM_DETAIL["viem/ modules"]
        V_ABIS["abis.ts"]
        V_ACCOUNT["account.ts"]
        V_CLIENTS["clients.ts"]
        V_DEPLOY["deployments.ts"]
        V_INDEX["index.ts"]
        V_POLY["polyfills.ts"]
        V_USEROP["userOps.ts (40KB)"]
    end

    subgraph CORE_NET["🌐 core/network/"]
        C_CHAIN["chain.ts"]
        C_CONTRACTS["contracts.ts"]
    end

    VIEM --> VIEM_DETAIL
    V_ABIS -->|"loads"| ABIS
    V_DEPLOY -->|"reads"| CONTRACTS
    V_CLIENTS -->|"config"| CHAINS
    V_USEROP -->|"assembles\nUserOps"| V_CLIENTS
    V_USEROP -->|"encodes"| V_ABIS
    C_CHAIN -->|"RPC / bundler\nendpoints"| V_CLIENTS
    C_CONTRACTS -->|"address\nresolution"| V_DEPLOY

    style MOBILE_INT fill:#1a1b26,stroke:#7dcfff,stroke-width:2px,color:#c0caf5
    style VIEM_DETAIL fill:#1a1b26,stroke:#ff9e64,stroke-width:2px,color:#c0caf5
    style CORE_NET fill:#1a1b26,stroke:#9ece6a,stroke-width:2px,color:#c0caf5
```

---

## 5. Auth & Recovery Flows

```mermaid
graph TD
    subgraph AUTH_SCREENS["🔐 Auth Flow"]
        SPLASH["SplashScreen"]
        INTRO["IntroductionScreen"]
        WELCOME["WelcomeScreen"]
        LOGIN["LoginScreen"]
        REGISTER["RegisterScreen"]
        VERIFY["VerifyEmailScreen"]
        FORGOT["ForgotPasswordScreen"]
        RESET["ResetPasswordScreen"]
        DEVICE["DeviceVerificationScreen"]
        PASSKEY_REG["PasskeyRegistrationScreen"]
        AUTH_RESULT["AuthResultScreen"]
    end

    subgraph RECOVERY_SCREENS["🔄 Recovery Flow"]
        BACKUP["BackupRecoveryScreen"]
        EMAIL_REC["EmailRecoveryScreen"]
        GUARDIAN_REC["GuardianRecoveryScreen"]
        REC_KIT["RecoveryKitExportScreen"]
    end

    subgraph RECOVERY_CONTRACTS["⛓️ Onchain Recovery"]
        SR_C["SocialRecovery.sol\n👥 Guardian ECDSA sigs\n+ timelock"]
        ER_C["EmailRecovery.sol\n📧 zk-Email proofs\n+ EmailAuth"]
    end

    subgraph EXTERNAL["🌍 External (out of scope)"]
        RELAYER["Email Relayer / Prover"]
    end

    SPLASH --> INTRO
    INTRO --> WELCOME
    WELCOME --> LOGIN
    WELCOME --> REGISTER
    REGISTER --> VERIFY
    LOGIN --> DEVICE
    DEVICE --> PASSKEY_REG
    PASSKEY_REG --> AUTH_RESULT

    BACKUP --> EMAIL_REC
    BACKUP --> GUARDIAN_REC
    EMAIL_REC -->|"installs module"| ER_C
    GUARDIAN_REC -->|"installs module"| SR_C
    ER_C <-->|"handleAcceptance\nhandleRecovery\ncompleteRecovery"| RELAYER

    style AUTH_SCREENS fill:#0d1117,stroke:#58a6ff,stroke-width:2px,color:#c9d1d9
    style RECOVERY_SCREENS fill:#0d1117,stroke:#f0883e,stroke-width:2px,color:#c9d1d9
    style RECOVERY_CONTRACTS fill:#0d1117,stroke:#da3633,stroke-width:2px,color:#c9d1d9
    style EXTERNAL fill:#0d1117,stroke:#8b949e,stroke-width:1px,stroke-dasharray:5 5,color:#8b949e
```

---

## 6. Local AA Development Stack

```mermaid
graph LR
    subgraph DOCKER["🐳 Docker Compose (apps/backend/bundler/)"]
        ANVIL["Anvil\n(Local Chain)"]
        ALTO["Pimlico Alto\n(Bundler)"]
        PAYMASTER["Mock Paymaster"]
        DEPLOYER["Contract Deployer"]
    end

    subgraph FOUNDRY["⚒️ Foundry Scripts"]
        DI["DeployInfra.s.sol"]
        DER["DeployEmailRecovery.s.sol"]
        HC["HelperConfig.s.sol"]
        PI["PredictInfra.s.sol"]
        PW["PredictWallet.s.sol"]
        CCS["CheckChainSupport.s.sol"]
        SUO["SendPackedUserOp.s.sol"]
        VI["VerifyInfra.s.sol"]
    end

    subgraph ARTIFACTS["📄 Deployment Outputs"]
        D_LOCAL["deployments/31337.json"]
        D_SEP["deployments/11155111.json"]
        BROADCAST["broadcast/"]
    end

    DEPLOYER -->|"forge script"| DI
    DEPLOYER -->|"forge script"| DER
    DI --> D_LOCAL
    DER --> D_LOCAL
    DI --> BROADCAST
    ALTO -->|"eth_sendUserOperation"| ANVIL
    PAYMASTER -->|"sponsors gas"| ALTO
    HC -->|"chain config"| DI
    HC -->|"chain config"| DER

    style DOCKER fill:#1a1b26,stroke:#7dcfff,stroke-width:2px,color:#c0caf5
    style FOUNDRY fill:#1a1b26,stroke:#e0af68,stroke-width:2px,color:#c0caf5
    style ARTIFACTS fill:#1a1b26,stroke:#9ece6a,stroke-width:2px,color:#c0caf5
```

---

## 7. Supabase Backend

```mermaid
graph TD
    subgraph SUPA["☁️ Supabase (apps/backend/supabase/)"]
        CONFIG["config.toml"]
        SEED["seed.sql"]
        
        subgraph MIGRATIONS["Migrations"]
            M1["init_schema_consolidated"]
            M2["add_avatar_removed"]
            M3["add_deterministic_wallet_identity"]
        end

        RLS["CONSOLIDATED_RLS_POLICIES.sql"]
    end

    subgraph MOBILE_LIB["📱 Mobile Supabase Lib"]
        SB_CLIENT["supabase.ts"]
        OAUTH["oauth.ts"]
        API["lib/api/"]
    end

    subgraph MOBILE_SVC["📱 Mobile Services"]
        SWS2["SupabaseWalletService"]
        GSS["GuardianSyncService"]
        PSS["ProfileSyncService"]
    end

    M1 --> M2 --> M3
    SB_CLIENT -->|"client init"| CONFIG
    SWS2 --> SB_CLIENT
    GSS --> SB_CLIENT
    PSS --> SB_CLIENT
    OAUTH --> SB_CLIENT
    RLS -->|"secures"| M1

    style SUPA fill:#1e1e2e,stroke:#a6e3a1,stroke-width:2px,color:#cdd6f4
    style MOBILE_LIB fill:#1e1e2e,stroke:#89b4fa,stroke-width:2px,color:#cdd6f4
    style MOBILE_SVC fill:#1e1e2e,stroke:#fab387,stroke-width:2px,color:#cdd6f4
```

---

## 8. Test Coverage Map

```mermaid
graph TD
    subgraph UNIT_TESTS["🧪 Unit Tests"]
        T_ACS["AccountStorage.t.sol"]
        T_DWA["DebugWebAuthn.t.sol"]
        T_DES["DeployEmailRecoveryScript.t.sol"]
        T_DS["DeploymentScripts.t.sol"]
        T_DAM["DeterministicAddressModel.t.sol"]
        T_MIN["MinimalTest.t.sol"]
        T_MM["ModuleManager.t.sol"]
        T_UO["UserOperation.t.sol"]
    end

    subgraph MODULE_TESTS["🔬 Module Tests"]
        T_ER["EmailRecovery.t.sol"]
        T_PV["PasskeyValidator.t.sol"]
        T_SR["SocialRecovery.t.sol"]
    end

    subgraph INTEGRATION_TESTS["🔗 Integration Tests"]
        T_ERI["EmailRecoveryIntegration.t.sol"]
        T_SRI["SocialRecoveryIntegration.t.sol"]
    end

    T_ACS -->|"tests"| AS2["AccountStorage"]
    T_MM -->|"tests"| MM2["ModuleManager"]
    T_PV -->|"tests"| PV2["PasskeyValidator"]
    T_SR -->|"tests"| SR2["SocialRecovery"]
    T_ER -->|"tests"| ER2["EmailRecovery"]
    T_ERI -->|"e2e"| ER2
    T_SRI -->|"e2e"| SR2

    style UNIT_TESTS fill:#0d1117,stroke:#3fb950,stroke-width:2px,color:#c9d1d9
    style MODULE_TESTS fill:#0d1117,stroke:#d29922,stroke-width:2px,color:#c9d1d9
    style INTEGRATION_TESTS fill:#0d1117,stroke:#f85149,stroke-width:2px,color:#c9d1d9
```

---

## 9. Full File Tree

```
trezo/
├── 📄 package.json              (workspace root)
├── 📄 README.md
├── 📄 plan.md                   (roadmap + security addendum)
│
├── 📱 apps/
│   ├── mobile/                  (Expo SDK 54 / RN 0.81)
│   │   ├── App.tsx              (entry point)
│   │   ├── index.js
│   │   ├── app.config.ts
│   │   ├── package.json
│   │   └── src/
│   │       ├── app/
│   │       │   ├── components/
│   │       │   ├── hooks/
│   │       │   ├── navigation/
│   │       │   │   ├── RootNavigation.tsx
│   │       │   │   ├── AuthNavigation.tsx
│   │       │   │   ├── AppNavigation.tsx
│   │       │   │   ├── TabNavigation/
│   │       │   │   └── navigationRef.ts
│   │       │   └── wallet/
│   │       ├── core/
│   │       │   ├── auth/
│   │       │   │   ├── biometrics.ts
│   │       │   │   └── passkeys.ts       ⚠️ legacy mock
│   │       │   └── network/
│   │       │       ├── chain.ts
│   │       │       └── contracts.ts
│   │       ├── features/
│   │       │   ├── auth/   (11 screens)
│   │       │   ├── home/   (HomeScreen — 64KB)
│   │       │   ├── wallet/
│   │       │   │   ├── screens/  (5 screens)
│   │       │   │   ├── services/ (9 services)
│   │       │   │   ├── components/ (4 cards)
│   │       │   │   ├── hooks/  (useWallet)
│   │       │   │   ├── store/
│   │       │   │   └── types/
│   │       │   ├── profile/
│   │       │   │   ├── screens/ (7 screens)
│   │       │   │   ├── services/ (2 sync services)
│   │       │   │   └── types/
│   │       │   ├── portfolio/ (PortfolioScreen)
│   │       │   ├── browser/  (BrowserScreen)
│   │       │   ├── dex/      (DexScreen)
│   │       │   └── contacts/ (ContactsScreen)
│   │       ├── integration/
│   │       │   ├── abi/       (6 contract ABIs)
│   │       │   ├── chains.ts
│   │       │   ├── contracts/ (deployment JSON)
│   │       │   └── viem/
│   │       │       ├── abis.ts
│   │       │       ├── account.ts
│   │       │       ├── clients.ts
│   │       │       ├── deployments.ts
│   │       │       ├── polyfills.ts
│   │       │       └── userOps.ts  (40KB — UserOp assembly)
│   │       ├── lib/
│   │       │   ├── supabase.ts
│   │       │   ├── oauth.ts
│   │       │   └── api/
│   │       ├── store/         (7 Zustand stores)
│   │       ├── hooks/
│   │       ├── shared/components/
│   │       ├── theme/
│   │       ├── types/
│   │       └── utils/
│   │
│   └── backend/
│       ├── bundler/
│       │   ├── docker-compose.yml
│       │   ├── alto-config.json
│       │   ├── save-state.sh
│       │   └── restore-state.sh
│       └── supabase/
│           ├── config.toml
│           ├── seed.sql
│           ├── CONSOLIDATED_RLS_POLICIES.sql
│           └── migrations/ (3 SQL files)
│
└── 🔐 contracts/                (Foundry project)
    ├── foundry.toml
    ├── Makefile                  (deploy targets)
    ├── DEPLOYMENTS.md
    ├── context.md
    ├── remappings.txt
    ├── src/
    │   ├── account/
    │   │   ├── SmartAccount.sol       (14KB)
    │   │   ├── AccountStorage.sol
    │   │   └── managers/
    │   │       └── ModuleManager.sol  (11KB)
    │   ├── factory/
    │   │   └── AccountFactory.sol
    │   ├── proxy/
    │   │   └── MinimalProxyFactory.sol
    │   ├── modules/
    │   │   ├── passkey/
    │   │   │   ├── PasskeyValidator.sol  (17KB)
    │   │   │   └── interfaces/
    │   │   ├── SocialRecovery/
    │   │   │   ├── SocialRecovery.sol    (20KB)
    │   │   │   └── interfaces/
    │   │   └── EmailRecovery/
    │   │       ├── EmailRecovery.sol     (5KB)
    │   │       └── interfaces/
    │   ├── common/Types.sol
    │   ├── utils/
    │   │   ├── PasskeyCred.sol
    │   │   └── WebAuthnHelper.sol
    │   ├── interfaces/
    │   │   ├── IAccount.sol
    │   │   └── IMinimalProxyFactory.sol
    │   └── vendor/solidity-stringutils/
    ├── script/
    │   ├── DeployInfra.s.sol
    │   ├── DeployEmailRecovery.s.sol   (15KB)
    │   ├── HelperConfig.s.sol
    │   ├── PredictInfra.s.sol
    │   ├── PredictWallet.s.sol
    │   ├── SendPackedUserOp.s.sol      (11KB)
    │   ├── CheckChainSupport.s.sol
    │   ├── CheckRootFactory.s.sol
    │   ├── P256Signer.s.sol
    │   ├── VerifyInfra.s.sol
    │   ├── WebAuthnTools.s.sol
    │   └── common/
    ├── test/
    │   ├── AccountStorage.t.sol
    │   ├── DebugWebAuthn.t.sol
    │   ├── DeployEmailRecoveryScript.t.sol
    │   ├── DeploymentScripts.t.sol
    │   ├── DeterministicAddressModel.t.sol
    │   ├── MinimalTest.t.sol
    │   ├── ModuleManager.t.sol
    │   ├── UserOperation.t.sol
    │   ├── helpers/
    │   ├── modules/
    │   │   ├── EmailRecovery.t.sol
    │   │   ├── PasskeyValidator.t.sol
    │   │   └── SocialRecovery.t.sol
    │   └── integration/
    │       ├── EmailRecoveryIntegration.t.sol
    │       └── SocialRecoveryIntegration.t.sol
    └── deployments/
        ├── 31337.json        (local Anvil)
        ├── 11155111.json     (Sepolia)
        ├── chains/
        ├── local/
        ├── releases/
        ├── test/
        └── test-release/
```

---

## 10. Key Metrics

| Layer | Files | Largest File | Lines of Weight |
|-------|-------|-------------|-----------------|
| **Smart Contracts** (src/) | ~15 `.sol` | `SocialRecovery.sol` (20KB) | Core account + 3 modules |
| **Deploy Scripts** | 11 `.s.sol` | `DeployEmailRecovery.s.sol` (15KB) | Deterministic deploys |
| **Tests** | 13 `.t.sol` | `PasskeyValidator.t.sol` (20KB) | Unit + integration |
| **Mobile Screens** | ~25 `.tsx` | `HomeScreen.tsx` (64KB) | 8 feature modules |
| **Mobile Services** | 11 `.ts` | `userOps.ts` (40KB) | UserOp assembly engine |
| **Zustand Stores** | 7 stores | `useBrowserStore.ts` (10KB) | Global state mgmt |
| **Supabase** | 3 migrations | `init_schema` (38KB) | Auth + wallet data |
| **Docker/Bundler** | 5 files | `docker-compose.yml` | Local AA infra |

---

## 11. Technology Stack

```mermaid
mindmap
  root((Trezo))
    Mobile
      Expo SDK 54
      React Native 0.81
      NativeWind / Tailwind
      viem
      ethers
      Zustand
      Supabase JS
    Contracts
      Foundry / Forge
      Solidity 0.8.x
      OpenZeppelin
      modulekit
      WebAuthn-sol
      zk-email contracts
    Backend
      Docker Compose
      Anvil (local chain)
      Pimlico Alto (bundler)
      Mock Paymaster
      Supabase (Auth + DB)
    Standards
      ERC-4337 (Account Abstraction)
      ERC-7579 (Modular Accounts)
      ERC-1271 (Signature Validation)
      RIP-7212 (secp256r1 precompile)
      WebAuthn / FIDO2
```
