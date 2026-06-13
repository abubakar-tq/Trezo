/**
 * RESCUE TOOL: rewrite the local AsyncStorage passkey metadata to point at
 * the credential currently registered on-chain for this user's smart account.
 *
 * Use case: an aborted recovery flow generated a brand-new WebAuthn
 * credential locally, overwriting the metadata pointer; the on-chain
 * validator still only knows the OLD credential. Signing fails until the
 * pointer is moved back.
 *
 * This does NOT re-create the WebAuthn private key — it relies on the
 * OLD credential still being present in the device's keystore (which is
 * the default; WebAuthn doesn't delete sibling credentials).
 */

import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { useWalletStore } from "@/src/features/wallet/store/useWalletStore";
import { useUserStore } from "@store/useUserStore";
import PasskeyService from "@/src/features/wallet/services/PasskeyService";
import { getPublicClient } from "@/src/integration/viem/clients";
import { getDeployment } from "@/src/integration/viem/deployments";
import { DEFAULT_CHAIN_ID, type SupportedChainId } from "@/src/integration/chains";
import { useAppTheme } from "@theme";
import Constants from "expo-constants";

const VALIDATOR_ABI = [
  {
    name: "passkeyCount",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "passkeyAt",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "index", type: "uint256" },
    ],
    outputs: [{ type: "bytes32" }],
  },
  {
    name: "getPasskeyRecord",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "passkeyId", type: "bytes32" },
    ],
    outputs: [
      { type: "uint256", name: "px" },
      { type: "uint256", name: "py" },
      { type: "uint32" },
      { type: "bool" },
    ],
  },
] as const;

type OnChainEntry = {
  credentialIdRaw: `0x${string}`;
  publicKeyX: string;
  publicKeyY: string;
};

export function RestoreOnChainPasskeyCard() {
  const { theme } = useAppTheme();
  const colors = theme.colors;

  const user = useUserStore((s) => s?.user);
  const aaAccount = useWalletStore((s) => s?.aaAccount);
  const activeAccount = useWalletStore((s) => s?.activeAccount);

  const storedAddress = useMemo<`0x${string}` | undefined>(() => {
    const candidate = aaAccount?.predictedAddress ?? activeAccount?.address;
    return candidate && /^0x[0-9a-fA-F]{40}$/.test(candidate)
      ? (candidate as `0x${string}`)
      : undefined;
  }, [aaAccount?.predictedAddress, activeAccount?.address]);

  // Manual override so the rescue works even when the wallet store didn't
  // hydrate the AA account (common when the user is locked out and can't
  // complete the normal bootstrap).
  const [manualAddress, setManualAddress] = useState("");
  const smartAccountAddress = useMemo<`0x${string}` | undefined>(() => {
    const trimmed = manualAddress.trim();
    if (/^0x[0-9a-fA-F]{40}$/.test(trimmed)) return trimmed as `0x${string}`;
    return storedAddress;
  }, [manualAddress, storedAddress]);

  const chainId = (aaAccount?.chainId ?? DEFAULT_CHAIN_ID) as SupportedChainId;

  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<OnChainEntry[]>([]);

  const rpId =
    (Constants.expoConfig?.extra as { passkeyRpId?: string })?.passkeyRpId
    ?? "trezo.app";

  const fetchOnChain = async () => {
    if (!smartAccountAddress) {
      Alert.alert("No smart account", "No smart account address on this device's wallet store.");
      return;
    }
    const deployment = getDeployment(chainId);
    const validatorAddr = deployment?.passkeyValidator as `0x${string}` | undefined;
    if (!validatorAddr) {
      Alert.alert("Missing validator", `No passkey validator wired for chain ${chainId}.`);
      return;
    }
    setLoading(true);
    try {
      const publicClient = getPublicClient(chainId);
      const count = (await publicClient.readContract({
        address: validatorAddr,
        abi: VALIDATOR_ABI,
        functionName: "passkeyCount",
        args: [smartAccountAddress],
      })) as bigint;

      const items: OnChainEntry[] = [];
      for (let i = 0n; i < count; i += 1n) {
        const credentialIdRaw = (await publicClient.readContract({
          address: validatorAddr,
          abi: VALIDATOR_ABI,
          functionName: "passkeyAt",
          args: [smartAccountAddress, i],
        })) as `0x${string}`;

        const rec = (await publicClient.readContract({
          address: validatorAddr,
          abi: VALIDATOR_ABI,
          functionName: "getPasskeyRecord",
          args: [smartAccountAddress, credentialIdRaw],
        })) as readonly [bigint, bigint, number, boolean];
        const [px, py] = rec;
        items.push({
          credentialIdRaw,
          publicKeyX: `0x${px.toString(16).padStart(64, "0")}`,
          publicKeyY: `0x${py.toString(16).padStart(64, "0")}`,
        });
      }
      setEntries(items);
      if (items.length === 0) {
        Alert.alert("No passkeys", "The validator has no passkeys registered for this account.");
      }
    } catch (err) {
      Alert.alert(
        "Read failed",
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      setLoading(false);
    }
  };

  const restore = async (entry: OnChainEntry) => {
    if (!user?.id) {
      Alert.alert("Not signed in", "No userId in user store; sign in to Supabase first.");
      return;
    }
    setLoading(true);
    try {
      const restored = await PasskeyService.restorePasskeyFromOnChainValues({
        userId: user.id,
        credentialIdRaw: entry.credentialIdRaw,
        publicKeyX: entry.publicKeyX,
        publicKeyY: entry.publicKeyY,
        rpId,
      });
      Alert.alert(
        "Passkey Restored",
        `Local AsyncStorage now points at credentialId ${restored.credentialIdRaw.slice(0, 18)}…\n\nNext sign attempt will ask WebAuthn for this credential. The biometric prompt should succeed if the original private key is still in your device's keystore.`,
      );
    } catch (err) {
      Alert.alert(
        "Restore failed",
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      setLoading(false);
    }
  };

  const styles = makeStyles(colors);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Restore passkey from on-chain</Text>
      <Text style={styles.body}>
        Rewrites local passkey metadata to a credential registered on the
        PasskeyValidator for this smart account. Use if an aborted recovery
        left this device pointing at a sibling credential the contract
        doesn&apos;t know about.
      </Text>
      <Text style={styles.meta}>
        chainId: {String(chainId)}{"\n"}
        store.aaAccount: {aaAccount?.predictedAddress ?? "null"}{"\n"}
        store.activeAccount: {activeAccount?.address ?? "null"}{"\n"}
        resolved: {smartAccountAddress ?? "none — paste below"}{"\n"}
        rpId: {rpId}{"\n"}
        userId: {user?.id ? `${user.id.slice(0, 8)}…` : "(not signed in)"}
      </Text>

      <Text style={styles.body}>
        If both store fields are null, the wallet store didn&apos;t hydrate.
        Paste your smart account address below to override.
      </Text>
      <TextInput
        style={styles.addressInput}
        value={manualAddress}
        onChangeText={setManualAddress}
        placeholder="0x… (smart account address)"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        editable={!loading}
      />

      <TouchableOpacity
        style={[styles.fetchBtn, (!smartAccountAddress || loading) && styles.fetchBtnDisabled]}
        onPress={() => void fetchOnChain()}
        disabled={loading || !smartAccountAddress}
        activeOpacity={0.85}
      >
        {loading && entries.length === 0 ? (
          <ActivityIndicator size="small" color={colors.textOnAccent} />
        ) : (
          <Text style={styles.btnText}>1. Read registered passkeys</Text>
        )}
      </TouchableOpacity>

      {entries.map((entry, idx) => (
        <View key={entry.credentialIdRaw} style={styles.entryRow}>
          <Text style={styles.entryText} numberOfLines={1} ellipsizeMode="middle">
            #{idx}: {entry.credentialIdRaw}
          </Text>
          <TouchableOpacity
            style={styles.restoreBtn}
            onPress={() => void restore(entry)}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.textOnAccent} />
            ) : (
              <Text style={styles.btnText}>2. Restore #{idx}</Text>
            )}
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useAppTheme>["theme"]["colors"]) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surfaceCard,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 10,
    },
    title: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    body: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    meta: {
      fontSize: 12,
      color: colors.textMuted,
      fontFamily: "monospace",
      lineHeight: 16,
    },
    fetchBtn: {
      backgroundColor: colors.accentAlt,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: "center",
    },
    fetchBtnDisabled: {
      opacity: 0.5,
    },
    addressInput: {
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.textPrimary,
      fontFamily: "monospace",
      fontSize: 13,
    },
    restoreBtn: {
      backgroundColor: colors.warning,
      borderRadius: 10,
      paddingVertical: 8,
      paddingHorizontal: 10,
      alignItems: "center",
    },
    entryRow: {
      gap: 6,
      backgroundColor: colors.surfaceMuted,
      borderRadius: 10,
      padding: 10,
    },
    entryText: {
      fontSize: 11,
      color: colors.textPrimary,
      fontFamily: "monospace",
    },
    btnText: {
      color: colors.textOnAccent,
      fontWeight: "600",
      fontSize: 14,
    },
  });

export default RestoreOnChainPasskeyCard;
