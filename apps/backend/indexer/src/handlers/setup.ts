import { ponder } from "ponder:registry";
import { rememberAccount } from "../lib/knownAccounts.js";
import { supabase } from "../lib/supabase.js";

// Pre-seed the in-memory known-accounts registry from Supabase aa_wallets.
// This handles wallets deployed before the indexer's startBlock — those wallets
// never emitted an AccountCreated event in the indexed range, so the factory
// handler never calls rememberAccount for them. Without this, ERC-20 transfers
// to those wallets are silently dropped by the isKnownAccount guard.
ponder.on("setup", async () => {
  try {
    let page = 0;
    const PAGE_SIZE = 1000;

    while (true) {
      const { data, error } = await supabase
        .from("aa_wallets")
        .select("chain_id, predicted_address")
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (error) {
        console.error("[indexer:setup] failed to seed knownAccounts from Supabase:", error.message);
        break;
      }

      if (!data || data.length === 0) break;

      for (const row of data) {
        if (row.chain_id && row.predicted_address) {
          rememberAccount(BigInt(row.chain_id), row.predicted_address);
        }
      }

      if (data.length < PAGE_SIZE) break;
      page++;
    }

    console.log("[indexer:setup] knownAccounts registry seeded from Supabase ✅");
  } catch (err) {
    console.error("[indexer:setup] unexpected error seeding knownAccounts:", err);
  }
});
