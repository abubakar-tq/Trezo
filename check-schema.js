const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

// Load environment variables
require("dotenv").config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env file");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function getSchemaInfo() {
  console.log("Fetching schema information from Supabase...\n");

  try {
    // Test basic connection
    const { data: testData, error: testError } = await supabase
      .from("profiles")
      .select("count")
      .limit(1);
    if (testError) {
      console.log(
        "Note: Cannot access system tables due to RLS. Testing actual tables...\n",
      );
    }

    // Check tables that should exist based on migrations
    const expectedTables = [
      "profiles",
      "wallets",
      "aa_wallets",
      "passkeys",
      "guardians",
      "contacts",
      "email_recovery_configs",
      "email_recovery_guardians",
      "email_recovery_chain_installs",
    ];

    console.log("=== CHECKING TABLES FROM MIGRATIONS ===");

    for (const tableName of expectedTables) {
      try {
        // Try to select count from each table
        const { data, error, count } = await supabase
          .from(tableName)
          .select("*", { count: "exact", head: true });

        if (error) {
          console.log(`❌ ${tableName}: Error - ${error.message}`);
        } else {
          console.log(`✅ ${tableName}: Exists (${count} records)`);
        }
      } catch (err) {
        console.log(`❌ ${tableName}: Error - ${err.message}`);
      }
    }

    // Try to get storage buckets (this should work)
    console.log("\n=== STORAGE BUCKETS ===");
    try {
      const { data: buckets, error: bucketsError } =
        await supabase.storage.listBuckets();

      if (bucketsError) {
        console.log(`❌ Storage buckets: Error - ${bucketsError.message}`);
      } else if (buckets.length === 0) {
        console.log("✅ Storage buckets: No buckets found");
      } else {
        buckets.forEach((bucket) => {
          console.log(
            `✅ Storage bucket: ${bucket.name} (public: ${bucket.public})`,
          );
        });
      }
    } catch (err) {
      console.log(`❌ Storage buckets: Error - ${err.message}`);
    }

    // Check auth users (limited info available)
    console.log("\n=== AUTH SYSTEM ===");
    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (error) {
        console.log(`❌ Auth check: ${error.message}`);
      } else {
        console.log(
          `✅ Auth system: Available${user ? ` (current user: ${user.email})` : ""}`,
        );
      }
    } catch (err) {
      console.log(`❌ Auth check: ${err.message}`);
    }
  } catch (error) {
    console.error("Unexpected error:", error);
  }
}

getSchemaInfo();
