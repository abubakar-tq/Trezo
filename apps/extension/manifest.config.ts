import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "Trezo",
  version: "0.0.1",
  description: "Trezo smart-account wallet for dApps.",
  icons: {
    "16": "icons/icon128.png",
    "32": "icons/icon128.png",
    "48": "icons/icon128.png",
    "128": "icons/icon128.png",
  },
  action: {
    default_popup: "index.html",
    default_title: "Trezo",
    default_icon: {
      "16": "icons/icon128.png",
      "32": "icons/icon128.png",
      "128": "icons/icon128.png",
    },
  },
  background: { service_worker: "src/background.ts", type: "module" },
  content_scripts: [
    // Relay runs in the ISOLATED world (has chrome.runtime).
    {
      matches: ["http://*/*", "https://*/*"],
      js: ["src/content.ts"],
      run_at: "document_start",
      all_frames: false,
    },
    // Provider runs in the page's MAIN world so it can define window.ethereum
    // and dispatch EIP-6963. Declared as a native MV3 MAIN-world content script
    // (crxjs bundles it as a proper .js chunk) — avoids the .ts MIME error that
    // manual web_accessible_resource injection caused.
    {
      matches: ["http://*/*", "https://*/*"],
      js: ["src/inpage.ts"],
      run_at: "document_start",
      all_frames: false,
      world: "MAIN",
    },
  ],
  // host_permissions includes the WebAuthn RP domain (Chrome >=122 lets the
  // extension assert this domain as RP ID) plus dApp origins for RPC.
  host_permissions: ["https://abubakar-tq.github.io/*", "http://*/*", "https://*/*"],
  permissions: ["storage", "tabs", "identity"],
});
