/**
 * pm-rpc — ERC-4337 paymaster JSON-RPC endpoint (pm_sponsorUserOperation)
 *
 * Implements VerifyingPaymaster off-chain signing for Base mainnet.
 * Sponsorship policy: only first wallet deployments (factory != null).
 *
 * Required Supabase secrets:
 *   PAYMASTER_ADDRESS            — deployed VerifyingPaymaster contract address
 *   PAYMASTER_SIGNER_PRIVATE_KEY — private key of the verifyingSigner EOA
 *   CHAIN_ID                     — 8453 for Base mainnet
 *
 * The mobile app calls pm_sponsorUserOperation; this function signs and returns
 * paymasterData in ERC-7677 v0.7 format (separate fields, not packed paymasterAndData).
 */

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  encodeAbiParameters,
  encodePacked,
  keccak256,
} from "npm:viem";
import { privateKeyToAccount } from "npm:viem/accounts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });

const rpcError = (id: unknown, code: number, message: string) =>
  json({ jsonrpc: "2.0", id, error: { code, message } });

// ERC-4337 v0.7 PaymasterAndData layout constants (bytes):
//   [0 :20] paymaster address
//   [20:36] paymasterVerificationGasLimit (uint128)
//   [36:52] paymasterPostOpGasLimit       (uint128)
//   [52:  ] paymasterData  ← what we put in the separate "paymasterData" field
//
// VerifyingPaymaster paymasterData layout:
//   [0 :32] abi.encode(validUntil uint48)  — padded to 32 bytes
//   [32:64] abi.encode(validAfter uint48)  — padded to 32 bytes
//   [64:  ] ECDSA signature (65 bytes)     → total 129 bytes
//
// SIGNATURE_OFFSET in the contract = PAYMASTER_DATA_OFFSET + 64 = 52 + 64 = 116
// (but relative to paymasterData field, it's just offset 64)

const PAYMASTER_VALIDATION_GAS = 200_000n; // uint128 — enough for ECDSA verify
const PAYMASTER_POSTOP_GAS = 0n; // no postOp hook

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const PAYMASTER_ADDRESS = Deno.env.get("PAYMASTER_ADDRESS") as `0x${string}` | undefined;
  const SIGNER_KEY = Deno.env.get("PAYMASTER_SIGNER_PRIVATE_KEY") as `0x${string}` | undefined;
  const CHAIN_ID = BigInt(Deno.env.get("CHAIN_ID") ?? "8453");

  if (!PAYMASTER_ADDRESS || !SIGNER_KEY) {
    console.error("[pm-rpc] Missing PAYMASTER_ADDRESS or PAYMASTER_SIGNER_PRIVATE_KEY secret");
    return json({ error: "Paymaster not configured" }, 503);
  }

  let body: { jsonrpc?: string; id?: unknown; method?: string; params?: unknown[] };
  try {
    body = await req.json();
  } catch {
    return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400);
  }

  const { id, method, params } = body;

  if (method !== "pm_sponsorUserOperation") {
    return rpcError(id, -32601, `Method not found: ${method}`);
  }

  if (!Array.isArray(params) || params.length < 1) {
    return rpcError(id, -32602, "Invalid params");
  }

  // ERC-4337 v0.7 unpacked UserOperation from the bundler client
  const userOp = params[0] as Record<string, string | null>;

  // Policy: only sponsor first wallet deployments
  const factory = userOp.factory;
  const isDeployment = factory !== null && factory !== undefined && factory !== "0x" && factory.length > 2;
  if (!isDeployment) {
    return rpcError(id, -32000, "Sponsorship policy: only first wallet deployments are sponsored on mainnet");
  }

  try {
    // ── Build the on-chain initCode (factory ++ factoryData) ──────────────────
    const factoryData = (userOp.factoryData ?? "0x") as `0x${string}`;
    const initCode = encodePacked(
      ["address", "bytes"],
      [factory as `0x${string}`, factoryData],
    ) as `0x${string}`;

    // ── Pack accountGasLimits: [verificationGasLimit(16) | callGasLimit(16)] ──
    const verGas = BigInt(userOp.verificationGasLimit ?? "0x0");
    const callGas = BigInt(userOp.callGasLimit ?? "0x0");
    const accountGasLimits = encodePacked(
      ["uint128", "uint128"],
      [verGas, callGas],
    ) as `0x${string}`;

    // ── Pack gasFees: [maxPriorityFeePerGas(16) | maxFeePerGas(16)] ──────────
    const maxPrio = BigInt(userOp.maxPriorityFeePerGas ?? "0x0");
    const maxFee = BigInt(userOp.maxFeePerGas ?? "0x0");
    const gasFees = encodePacked(
      ["uint128", "uint128"],
      [maxPrio, maxFee],
    ) as `0x${string}`;

    // ── Paymaster gas limits as uint256 (bytes32 → uint256 in getHash) ───────
    // This is what the contract reads from paymasterAndData[20:52].
    const gasLimitsPacked = encodePacked(
      ["uint128", "uint128"],
      [PAYMASTER_VALIDATION_GAS, PAYMASTER_POSTOP_GAS],
    ) as `0x${string}`;
    const gasLimitsUint256 = BigInt(gasLimitsPacked);

    // ── Validity window (5 min) ───────────────────────────────────────────────
    const validUntil = BigInt(Math.floor(Date.now() / 1000) + 300);
    const validAfter = 0n;

    // ── Reproduce VerifyingPaymaster.getHash() ────────────────────────────────
    const hash = keccak256(
      encodeAbiParameters(
        [
          { type: "address" }, // sender
          { type: "uint256" }, // nonce
          { type: "bytes32" }, // keccak256(initCode)
          { type: "bytes32" }, // keccak256(callData)
          { type: "bytes32" }, // accountGasLimits
          { type: "uint256" }, // paymasterGasLimits packed as uint256
          { type: "uint256" }, // preVerificationGas
          { type: "bytes32" }, // gasFees
          { type: "uint256" }, // chainId
          { type: "address" }, // paymaster (this)
          { type: "uint48" },  // validUntil
          { type: "uint48" },  // validAfter
        ],
        [
          userOp.sender as `0x${string}`,
          BigInt(userOp.nonce ?? "0x0"),
          keccak256(initCode),
          keccak256((userOp.callData ?? "0x") as `0x${string}`),
          accountGasLimits as `0x${string}`,
          gasLimitsUint256,
          BigInt(userOp.preVerificationGas ?? "0x0"),
          gasFees as `0x${string}`,
          CHAIN_ID,
          PAYMASTER_ADDRESS,
          validUntil,
          validAfter,
        ],
      ),
    );

    // ── Sign with personal_sign (ETH prefix) — matches toEthSignedMessageHash ─
    const account = privateKeyToAccount(SIGNER_KEY);
    const signature = await account.signMessage({ message: { raw: hash } });

    // ── paymasterData = abi.encode(validUntil, validAfter) ++ signature ───────
    // Contract reads: abi.decode(paymasterData[0:], (uint48, uint48)) → timestamps
    //                 paymasterData[64:] → signature
    const paymasterData = (
      encodeAbiParameters(
        [{ type: "uint48" }, { type: "uint48" }],
        [validUntil, validAfter],
      ) + signature.slice(2) // strip leading 0x from sig before concatenating
    ) as `0x${string}`;

    console.log(`[pm-rpc] Sponsored deployment for ${userOp.sender} on chain ${CHAIN_ID}`);

    return json({
      jsonrpc: "2.0",
      id,
      result: {
        paymaster: PAYMASTER_ADDRESS,
        paymasterData,
        paymasterVerificationGasLimit: `0x${PAYMASTER_VALIDATION_GAS.toString(16)}`,
        paymasterPostOpGasLimit: `0x${PAYMASTER_POSTOP_GAS.toString(16)}`,
      },
    });
  } catch (err) {
    console.error("[pm-rpc] Error sponsoring op:", err);
    return rpcError(id, -32603, err instanceof Error ? err.message : "Internal error");
  }
});
