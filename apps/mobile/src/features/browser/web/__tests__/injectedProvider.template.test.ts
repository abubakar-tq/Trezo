import {
  INJECTED_PROVIDER_SCRIPT,
  TREZO_PROVIDER_NAME,
  TREZO_PROVIDER_RDNS,
} from "../injectedProvider.template";
import { TREZO_PROVIDER_ICON } from "../trezoProviderIcon";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`assert failed: ${msg}`);
}

function run(): void {
  // Provider identity
  assert(TREZO_PROVIDER_NAME === "Trezo", "name is Trezo");
  assert(TREZO_PROVIDER_RDNS === "com.trezo.wallet", "rdns matches app bundle id");
  assert(TREZO_PROVIDER_ICON.startsWith("data:image/"), "icon is a data URI");

  // EIP-6963 wiring present in the injected script
  assert(INJECTED_PROVIDER_SCRIPT.includes("eip6963:announceProvider"), "announces via eip6963");
  assert(INJECTED_PROVIDER_SCRIPT.includes("eip6963:requestProvider"), "listens for requestProvider");
  assert(INJECTED_PROVIDER_SCRIPT.includes("Object.freeze(info)"), "info is frozen per EIP-6963");
  assert(INJECTED_PROVIDER_SCRIPT.includes("uuid:"), "info has uuid field");
  assert(INJECTED_PROVIDER_SCRIPT.includes('name: "Trezo"'), "interpolates name");
  assert(INJECTED_PROVIDER_SCRIPT.includes('rdns: "com.trezo.wallet"'), "interpolates rdns");
  assert(INJECTED_PROVIDER_SCRIPT.includes('icon: "data:image/'), "interpolates icon data URI");

  // Legacy provider kept, but the old early-bail is gone
  assert(INJECTED_PROVIDER_SCRIPT.includes("isTrezo: true"), "keeps isTrezo flag");
  assert(!INJECTED_PROVIDER_SCRIPT.includes("if (window.ethereum) return;"), "early-bail removed");

  console.log("OK injectedProvider.template");
}

run();
