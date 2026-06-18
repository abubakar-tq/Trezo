import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = await req.json();

    // The webhook payload from a Postgres AFTER DELETE trigger has an `old_record` property
    const deletedUserId = payload.old_record?.id || payload.record?.id;

    if (!deletedUserId) {
      return new Response(JSON.stringify({ error: 'No deleted user ID provided in the webhook payload' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Initialize Supabase Admin Client (Service Role required to bypass RLS and delete storage files)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    console.log(`🧹 [cleanup-user-storage] Scrubbing S3 storage for deleted user: ${deletedUserId}`);

    // The mobile app strictly uploads avatars to 'avatars/{userId}'
    const filePath = `avatars/${deletedUserId}`;

    const { data, error } = await supabaseAdmin
      .storage
      .from('profiles')
      .remove([filePath]);

    if (error) {
      console.error('❌ [cleanup-user-storage] Error deleting avatar:', error);
      return new Response(JSON.stringify({ error: error.message }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    console.log(`✅ [cleanup-user-storage] Successfully wiped storage file: ${filePath}`);
    
    return new Response(JSON.stringify({ success: true, deleted: data }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
    
  } catch (err: any) {
    console.error('❌ [cleanup-user-storage] Edge Function execution failed:', err);
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
