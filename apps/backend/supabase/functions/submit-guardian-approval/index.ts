import { createClient } from "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { recoverAddress, type Hex } from "npm:viem@2.41.2";

type SigKind = "EOA_ECDSA" | "ERC1271" | "APPROVE_HASH";

type ApprovalRequest = {
  requestId: string;
  guardianAddress: string;
  guardianIndex: number;
  sigKind: SigKind;
  signature: string;
  chainId?: number;
  approvalTxHash?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "content-type": "application/json", ...(init.headers || {}) },
    ...init,
  });

const normalizeAddress = (value: string) => value.trim().toLowerCase();

const normalizeHex = (value: string): Hex => {
  const trimmed = value.trim();
  const prefixed = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  return prefixed.toLowerCase() as Hex;
};

const isHexString = (value: string) => /^0x([0-9a-fA-F]{2})*$/.test(value.trim());

const getSupabaseAdmin = () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase service credentials are missing.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    let body: ApprovalRequest;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!body.requestId || !body.guardianAddress || !body.signature || !body.sigKind) {
      return json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: request, error: requestError } = await supabase
      .from("recovery_requests")
      .select("id, guardian_addresses, threshold, deadline, status, user_id, digest")
      .eq("id", body.requestId)
      .maybeSingle();

    if (requestError) {
      return json({ error: requestError.message }, { status: 500 });
    }

    if (!request) {
      return json({ error: "Recovery request not found" }, { status: 404 });
    }

    const guardianAddresses = (request.guardian_addresses ?? []).map((address: string) =>
      normalizeAddress(address),
    );
    const guardianAddress = normalizeAddress(body.guardianAddress);
    const guardianIndex = Number(body.guardianIndex);

    if (!guardianAddresses.includes(guardianAddress)) {
      return json({ error: "Guardian address is not authorized for this request" }, { status: 403 });
    }

    if (guardianAddresses[guardianIndex] !== guardianAddress) {
      return json({ error: "Guardian index does not match guardian address" }, { status: 400 });
    }

    if (!request.status || !["collecting_approvals", "threshold_reached"].includes(request.status)) {
      return json({ error: "Recovery request is not accepting approvals" }, { status: 409 });
    }

    if (new Date(request.deadline).getTime() < Date.now()) {
      return json({ error: "Recovery request has expired" }, { status: 409 });
    }

    if (!isHexString(body.signature)) {
      return json({ error: "Signature must be a hex string." }, { status: 400 });
    }

    const normalizedSignature = normalizeHex(body.signature);

    let verificationStatus: "valid" | "invalid" = "valid";
    let verificationError: string | null = null;

    if (body.sigKind === "EOA_ECDSA") {
      try {
        const digest = normalizeHex(request.digest as string);
        const recovered = await recoverAddress({
          hash: digest,
          signature: normalizedSignature,
        });

        if (normalizeAddress(recovered) !== guardianAddress) {
          verificationStatus = "invalid";
          verificationError = "Signature does not match guardian address.";
        }
      } catch (error) {
        verificationStatus = "invalid";
        verificationError = error instanceof Error ? error.message : "Failed to verify EOA signature.";
      }
    }

    const { data: existingApproval } = await supabase
      .from("recovery_approvals")
      .select("id, signature, verification_status")
      .eq("request_id", body.requestId)
      .eq("guardian_address", guardianAddress)
      .maybeSingle();

    const alreadyApproved = Boolean(
      existingApproval &&
      existingApproval.verification_status === "valid" &&
      normalizeHex(existingApproval.signature as string) === normalizedSignature,
    );

    const { data: approval, error: approvalError } = await supabase
      .from("recovery_approvals")
      .upsert(
        {
          request_id: body.requestId,
          guardian_address: guardianAddress,
          guardian_index: guardianIndex,
          sig_kind: body.sigKind,
          signature: normalizedSignature,
          chain_id: body.chainId ?? null,
          approval_tx_hash: body.approvalTxHash ?? null,
          verification_status: verificationStatus,
          verification_error: verificationError,
        },
        { onConflict: "request_id,guardian_address" },
      )
      .select("id")
      .single();

    if (approvalError) {
      return json({ error: approvalError.message }, { status: 500 });
    }

    const { count, error: countError } = await supabase
      .from("recovery_approvals")
      .select("*", { count: "exact", head: true })
      .eq("request_id", body.requestId)
      .eq("verification_status", "valid");

    if (countError) {
      return json({ error: countError.message }, { status: 500 });
    }

    const approvalCount = count ?? 0;
    const thresholdReached = approvalCount >= Number(request.threshold);

    if (verificationStatus !== "valid") {
      return json(
        {
          error: verificationError ?? "Guardian signature verification failed.",
          success: false,
          approvalId: approval.id,
          approvalCount,
          thresholdReached,
          verificationStatus,
        },
        { status: 400 },
      );
    }

    if (thresholdReached && request.status === "collecting_approvals") {
      await supabase
        .from("recovery_requests")
        .update({ status: "threshold_reached", updated_at: new Date().toISOString() })
        .eq("id", body.requestId);
    }

    return json({
      success: true,
      approvalId: approval.id,
      approvalCount,
      thresholdReached,
      alreadyApproved,
    });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Unknown error in guardian approval" },
      { status: 500 },
    );
  }
});
