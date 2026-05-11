# `eth_sendTransaction` returns a UserOp hash, not an Ethereum tx hash

**Context.** EIP-1193's `eth_sendTransaction` is specified to return a transaction hash. Trezo is an ERC-4337 smart-contract wallet — every "transaction" is actually a UserOperation submitted to a bundler. The bundler eventually packages the UserOp into a regular Ethereum transaction, but that on-chain tx hash isn't knowable at submission time. Returning it would require waiting for the bundler to land the bundle (seconds to a minute on testnets).

**Decision.** Return the `userOpHash` immediately after `eth_sendUserOperation` accepts the operation. ERC-4337-aware dApps treat the return as an opaque identifier and resolve confirmation via `eth_getUserOperationReceipt` on the bundler, which exposes the actual on-chain `transactionHash`. Modern dApps (Uniswap, Aave, OpenSea, anything built with viem's `account-abstraction` module or Safe) handle this correctly.

**Consequence.** dApps that pass the return into a vanilla `eth_getTransactionReceipt` on a non-AA RPC will get `null` until the UserOp lands. That's a dApp-side limitation, not Trezo's. If we ever need to paper over it, we'd have to block the `eth_sendTransaction` response on receipt polling — slow, hostile to UX, and a worse default than the current shape.
