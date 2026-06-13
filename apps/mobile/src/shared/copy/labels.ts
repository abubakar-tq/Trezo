// User-facing strings governed by docs/CONTEXT.md.
// Adding a new label here is preferable to inlining a literal.

export const LABELS = {
  // Devices / pairing
  linkedDevices: "Linked Devices",
  linkADevice: "Link a new device",
  devicePairing: "Device pairing",
  pairingLink: "Pairing link",

  // Account states
  activateOnChain: (chainName: string) => `Activate your account on ${chainName}`,
  setUpYourWallet: "Set up your wallet",
  passkeyConfirmation: "Confirm with your passkey.",

  // Discover
  discoverTab: "Discover",
  connectedDApps: "Connected dApps",
  disconnectDApp: "Disconnect",

  // Compromise
  compromiseRowTitle: "My wallet is compromised",
} as const;
