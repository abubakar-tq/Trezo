import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { checkPasskeyOnChain } from "@/src/integration/viem/account";
import { getDeployment } from "@/src/integration/viem/deployments";
import { getPublicClient } from "@/src/integration/viem/clients";
import { ABIS } from "@/src/integration/viem/abis";
import PasskeyService from "@/src/features/wallet/services/PasskeyService";
import { useUserStore } from "@store/useUserStore";
import { DEFAULT_CHAIN_ID, type SupportedChainId } from "@/src/integration/chains";
import type { Hex, Address } from "viem";

type VerifyResult = {
  localPasskeyId: string;
  onChainExists: boolean;
  pxMatch: boolean;
  pyMatch: boolean;
  signCounter: number;
  counterInitialized: boolean;
  passkeyCount: number;
};

const shortHex = (value: string, head = 10, tail = 6) =>
  value.length > head + tail ? `${value.slice(0, head)}...${value.slice(-tail)}` : value;

export const PasskeyVerifyCard: React.FC = () => {
  const userId = useUserStore((state) => state.user?.id ?? null);
  const smartAccountAddress = useUserStore((state) => state.smartAccountAddress);
  const [status, setStatus] = useState<"idle" | "checking" | "done" | "error">("idle");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const chainId = DEFAULT_CHAIN_ID as SupportedChainId;
  const deployment = getDeployment(chainId);
  const validator = deployment?.passkeyValidator as Hex | undefined;

  const handleCheck = async () => {
    if (!userId) {
      setError("Not signed in");
      setStatus("error");
      return;
    }
    if (!smartAccountAddress) {
      setError("No smart account address. Deploy an account first.");
      setStatus("error");
      return;
    }
    if (!validator) {
      setError("No validator address in deployment config");
      setStatus("error");
      return;
    }

    setError(null);
    setStatus("checking");

    try {
      const localPasskey = await PasskeyService.getPasskey(userId);
      if (!localPasskey) {
        setError("No local passkey found on this device");
        setStatus("error");
        return;
      }

      const passkeyId = localPasskey.credentialIdRaw as Hex;

      const [onChainRecord, countResult] = await Promise.all([
        checkPasskeyOnChain({
          chainId,
          smartAccountAddress: smartAccountAddress as Address,
          passkeyId,
          validatorAddress: validator as Address,
        }),
        getPublicClient(chainId).readContract({
          address: validator as Address,
          abi: ABIS.passkeyValidator,
          functionName: "passkeyCount",
          args: [smartAccountAddress as Address],
        }) as Promise<bigint>,
      ]);

      const localPx = BigInt(localPasskey.publicKeyX.startsWith("0x") ? localPasskey.publicKeyX : `0x${localPasskey.publicKeyX}`);
      const localPy = BigInt(localPasskey.publicKeyY.startsWith("0x") ? localPasskey.publicKeyY : `0x${localPasskey.publicKeyY}`);

      const pxMatch = onChainRecord.exists && onChainRecord.px === localPx;
      const pyMatch = onChainRecord.exists && onChainRecord.py === localPy;

      setResult({
        localPasskeyId: passkeyId,
        onChainExists: onChainRecord.exists,
        pxMatch,
        pyMatch,
        signCounter: onChainRecord.signCounter,
        counterInitialized: onChainRecord.counterInitialized,
        passkeyCount: Number(countResult),
      });
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to check passkey on-chain");
      setStatus("error");
    }
  };

  const overallMatch = result?.onChainExists && result?.pxMatch && result?.pyMatch;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Passkey On-Chain Verify</Text>
      <Text style={styles.description}>
        Check if your local device passkey matches the passkey installed on the smart account contract.
      </Text>
      <Text style={styles.label}>Smart Account</Text>
      <Text style={styles.value}>{smartAccountAddress ? shortHex(smartAccountAddress, 8, 6) : "Not deployed"}</Text>
      <Text style={styles.label}>Validator</Text>
      <Text style={styles.value}>{validator ? shortHex(validator, 8, 6) : "N/A"}</Text>

      <TouchableOpacity onPress={handleCheck} style={styles.primaryButton} disabled={status === "checking"}>
        <Text style={styles.buttonText}>
          {status === "checking" ? "Checking..." : "Verify Passkey On-Chain"}
        </Text>
      </TouchableOpacity>

      {result && (
        <View style={styles.resultSection}>
          <Text style={styles.sectionTitle}>Verification Result</Text>
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Passkey ID</Text>
            <Text style={styles.resultValue}>{shortHex(result.localPasskeyId, 10, 6)}</Text>
          </View>
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>On-Chain</Text>
            <Text style={[styles.resultValue, result.onChainExists ? styles.matchText : styles.mismatchText]}>
              {result.onChainExists ? "YES" : "NO"}
            </Text>
          </View>
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Public Key X</Text>
            <Text style={[styles.resultValue, result.pxMatch ? styles.matchText : styles.mismatchText]}>
              {result.pxMatch ? "MATCH" : "MISMATCH"}
            </Text>
          </View>
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Public Key Y</Text>
            <Text style={[styles.resultValue, result.pyMatch ? styles.matchText : styles.mismatchText]}>
              {result.pyMatch ? "MATCH" : "MISMATCH"}
            </Text>
          </View>
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Sign Counter</Text>
            <Text style={styles.resultValue}>{result.signCounter} (init: {result.counterInitialized ? "yes" : "no"})</Text>
          </View>
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Total Passkeys</Text>
            <Text style={styles.resultValue}>{result.passkeyCount}</Text>
          </View>
          <View style={[styles.overallBadge, overallMatch ? styles.matchBadge : styles.mismatchBadge]}>
            <Text style={styles.overallBadgeText}>
              {overallMatch ? "PASSKEY CONTROLS WALLET" : "PASSKEY DOES NOT CONTROL WALLET"}
            </Text>
          </View>
        </View>
      )}

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 16,
    marginVertical: 12,
    gap: 6,
  },
  title: {
    color: "#e2e8f0",
    fontSize: 18,
    fontWeight: "700",
  },
  description: {
    color: "#94a3b8",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  label: {
    color: "#94a3b8",
    fontSize: 12,
    marginTop: 4,
  },
  value: {
    color: "#e2e8f0",
    fontSize: 13,
  },
  primaryButton: {
    backgroundColor: "#38bdf8",
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: {
    color: "#0b1224",
    fontWeight: "700",
  },
  resultSection: {
    marginTop: 12,
    gap: 2,
  },
  sectionTitle: {
    color: "#38bdf8",
    fontWeight: "700",
    marginBottom: 6,
  },
  resultRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  resultLabel: {
    color: "#94a3b8",
    fontSize: 13,
  },
  resultValue: {
    color: "#e2e8f0",
    fontSize: 13,
    fontWeight: "600",
  },
  matchText: {
    color: "#22c55e",
  },
  mismatchText: {
    color: "#ef4444",
  },
  overallBadge: {
    marginTop: 10,
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
  },
  matchBadge: {
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    borderWidth: 1,
    borderColor: "#22c55e",
  },
  mismatchBadge: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderColor: "#ef4444",
  },
  overallBadgeText: {
    color: "#e2e8f0",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  errorBox: {
    backgroundColor: "#7f1d1d",
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
  },
  errorText: {
    color: "#fecdd3",
    fontSize: 13,
  },
});

export default PasskeyVerifyCard;
