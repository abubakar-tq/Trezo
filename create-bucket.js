const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createStorageBucket() {
  console.log("Creating storage bucket...");

  try {
    // Create the bucket
    const { data, error } = await supabase.storage.createBucket("profiles", {
      public: true,
      allowedMimeTypes: [
        "image/png",
        "image/jpg",
        "image/jpeg",
        "image/gif",
        "image/webp",
      ],
      fileSizeLimit: 2097152, // 2MB
    });

    if (error) {
      console.error("Error creating bucket:", error);
      return;
    }

    console.log('✅ Storage bucket "profiles" created successfully!');
    console.log("Bucket details:", data);
  } catch (error) {
    console.error("Unexpected error:", error);
  }
}

createStorageBucket();
