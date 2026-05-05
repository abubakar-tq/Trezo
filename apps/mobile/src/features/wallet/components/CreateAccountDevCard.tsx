import React, { useMemo, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { useAppTheme } from "@theme";
import { getBundlerUrl, getPaymasterUrl } from "@/src/core/network/chain";
import { DEFAULT_CHAIN_ID, isPortableChain } from "@/src/integration/chains";
import {
  buildCreateAccountUserOp,
  getDeployment,
  sendUserOp,
  predictAccountAddress,
  type PasskeyInit,
} from "@/src/integration/viem";
import { fundEntryPointDeposit } from "@/src/integration/viem/account";
import PasskeyService from "@/src/features/wallet/services/PasskeyService";
import { useUserStore } from "@store/useUserStore";
import type { SupportedChainId } from "@/src/integration/chains";
import type { UserOperation } from "viem/account-abstraction";
import type { Hex, Address } from "viem";

type Props = {
  chainId?: SupportedChainId;
};

const randomHex = (bytes: number): Hex => {
  const arr = new Uint8Array(bytes);
  // global crypto is available via react-native-get-random-values polyfill
  globalThis.crypto.getRandomValues(arr);
  return (`0x${Array.from(arr, (byte) => byte.toString(16).padStart(2, "0")).join("")}`) as Hex;
};

const shortHex = (value: Hex, head = 18, tail = 8) =>
  value.length > head + tail ? `${value.slice(0, head)}...${value.slice(-tail)}` : value;

const debugLog = (...args: unknown[]) => {
  if (__DEV__) console.log(...args);
};

export const CreateAccountDevCard: React.FC<Props> = ({ chainId = DEFAULT_CHAIN_ID }) => {
  const { theme } = useAppTheme();
  const { colors } = theme;
  const [walletId, setWalletId] = useState<Hex>(() => randomHex(32));
  const [status, setStatus] = useState<"idle" | "building" | "ready" | "sending" | "error" | "sent">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [userOpHash, setUserOpHash] = useState<Hex | null>(null);
  const [sender, setSender] = useState<Hex | null>(null);
  const [opHash, setOpHash] = useState<Hex | null>(null);
  const [userOp, setUserOp] = useState<UserOperation<"0.7"> | null>(null);

  const deployment = getDeployment(chainId);
  const [bundlerUrl, setBundlerUrl] = useState<string>(() => getBundlerUrl());
  const [paymasterUrl, setPaymasterUrl] = useState<string>(() => getPaymasterUrl());
  const [usePaymaster, setUsePaymaster] = useState<boolean>(false);
  const [signature, setSignature] = useState<Hex>("0x");
  const [funding, setFunding] = useState<"idle" | "funding" | "funded">("idle");
  const [fundTxHash, setFundTxHash] = useState<Hex | null>(null);
  const [autoFund, setAutoFund] = useState<boolean>(true);
  const validator = deployment?.passkeyValidator as Hex | undefined;
  const authUser = useUserStore((state) => state.user);
  const userId = useMemo(() => authUser?.id ?? null, [authUser?.id]);

  const fetchPasskeyInit = async (): Promise<PasskeyInit> => {
    if (!userId) throw new Error("No authenticated user found. Please sign in first.");
    const passkey = await PasskeyService.getPasskey(userId);
    if (!passkey) {
      throw new Error("No passkey found on this device. Create one first.");
    }

    // Ensure coordinates are 32 bytes; if not, throw so user can recreate passkey
    const pxHex = passkey.publicKeyX.startsWith("0x") ? passkey.publicKeyX : (`0x${passkey.publicKeyX}` as Hex);
    const pyHex = passkey.publicKeyY.startsWith("0x") ? passkey.publicKeyY : (`0x${passkey.publicKeyY}` as Hex);
    if (pxHex.length !== 66 || pyHex.length !== 66) {
      throw new Error("Stored passkey public key is invalid. Please delete and recreate your passkey.");
    }

    return {
      idRaw: passkey.credentialIdRaw as Hex,
      px: BigInt(pxHex),
      py: BigInt(pyHex),
    };
  };

  const handleBuild = async () => {
    setError(null);
    setStatus("building");
    try {
      if (!userId) throw new Error("No authenticated user found. Please sign in first.");
      if (!deployment) throw new Error(`No deployment config for chain ${chainId}`);
      if (!validator) throw new Error("Validator address missing from deployment config");

      const passkeyInit = await fetchPasskeyInit();
      
      debugLog('[CreateAccountDevCard] PasskeyInit for account creation:', {
        idRaw: shortHex(passkeyInit.idRaw),
        hasPublicKey: Boolean(passkeyInit.px && passkeyInit.py),
      });

      const walletIndex = 0n;
      const mode = isPortableChain(chainId) ? "portable" : "chain-specific";

      // Predict first so we can optionally prefund before bundler simulation (avoids AA21)
      const predictedSender = await predictAccountAddress(
        chainId,
        walletId,
        validator as Address,
        passkeyInit,
        walletIndex,
        mode,
      );
      setSender(predictedSender as Hex);

      if (!usePaymaster && autoFund) {
        setFunding("funding");
        try {
          const { hash } = await fundEntryPointDeposit({
            chainId,
            account: predictedSender as Address,
            amountEth: 0.05,
          });
          setFundTxHash(hash as Hex);
          setFunding("funded");
        } catch (fundErr) {
          setFunding("idle");
          throw fundErr;
        }
      }

      const { userOp, userOpHash, sender } = await buildCreateAccountUserOp({
        chainId,
        walletId,
        walletIndex,
        mode,
        validator,
        passkeyInit,
        bundlerUrl,
        paymasterUrl,
        usePaymaster,
      });

      // Prompt biometric to sign the userOp hash with the stored passkey
      const signed = await PasskeyService.signWithPasskey(userId, userOpHash);
      
      debugLog('[CreateAccountDevCard] Signature passkeyId:', shortHex(signed.passkeyId as Hex));
      debugLog('[CreateAccountDevCard] Match?', signed.passkeyId === passkeyInit.idRaw);
      debugLog('[CreateAccountDevCard] Signature details:', {
        authenticatorDataLength: signed.authenticatorData.length,
        clientDataJSONLength: signed.clientDataJSON.length,
        challengeIndex: signed.challengeIndex,
        typeIndex: signed.typeIndex,
        r: shortHex(signed.r as Hex),
        s: shortHex(signed.s as Hex),
      });
      
      const encodedSig = PasskeyService.encodeSignatureForContract(signed) as Hex;

      const signedUserOp = { ...userOp, signature: encodedSig };
      setSignature(encodedSig);
      setUserOpHash(userOpHash as Hex);
      setSender(sender as Hex);
      setUserOp(signedUserOp);
      setStatus("ready");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to build/sign userOp";
      const hint = msg.includes("AA21")
        ? "AA21: prefund required. Fund predicted address (auto-fund toggle) or enable a paymaster."
        : null;
      setError(hint ?? msg);
      setStatus("error");
    }
  };

  const handleSend = async () => {
    if (!userOp || !deployment) return;
    if (!userOp.signature || userOp.signature === "0x") {
      Alert.alert("Missing signature", "Build first to sign with your passkey.");
      return;
    }
    setError(null);
    setStatus("sending");
    try {
      const opHash = await sendUserOp(
        userOp,
        chainId,
        bundlerUrl,
        deployment.entryPoint,
      );
      setOpHash(opHash as Hex);
      setStatus("sent");
    } catch (e) {
      debugLog("[CreateAccountDevCard] sendUserOp error object:", e);
      setError(e instanceof Error ? e.message : "Failed to send userOp");
      setStatus("error");
    }
  };

  const handleFund = async () => {
    if (!sender) {
      Alert.alert("No predicted address", "Build first to predict the account address.");
      return;
    }
    setError(null);
    setFunding("funding");
    try {
      const { hash } = await fundEntryPointDeposit({
        chainId,
        account: sender as Address,
        amountEth: 0.05,
      });
      setFundTxHash(hash as Hex);
      setFunding("funded");
    } catch (e) {
      setFunding("idle");
      setError(e instanceof Error ? e.message : "Failed to fund predicted account");
    }
  };

  const reset = () => {
    setWalletId(randomHex(32));
    setStatus("idle");
    setError(null);
    setUserOp(null);
    setUserOpHash(null);
    setSender(null);
    setSignature("0x");
    setOpHash(null);
    setFunding("idle");
    setFundTxHash(null);
    setAutoFund(true);
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.surfaceCard }]}>
      <Text style={styles.title}>CreateAccount Dev Tester</Text>
      <Text style={styles.subtitle}>Chain: {chainId}</Text>
      <Text style={styles.label}>User</Text>
      <Text style={styles.value}>{userId ?? "Not signed in"}</Text>
      <Text style={styles.label}>Bundler</Text>
      <TextInput
        style={styles.input}
        value={bundlerUrl}
        onChangeText={setBundlerUrl}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="http://10.0.2.2:4337"
        placeholderTextColor="#64748b"
      />
      <Text style={styles.label}>Validator</Text>
      <Text style={styles.value}>{validator ?? "N/A"}</Text>
      <Text style={styles.label}>Wallet ID</Text>
      <Text style={styles.value}>{walletId}</Text>
      <TouchableOpacity onPress={reset} style={styles.secondaryButton}>
        <Text style={styles.buttonText}>Regenerate Wallet ID / Reset</Text>
      </TouchableOpacity>

      <View style={styles.paymasterSection}>
        <Text style={styles.label}>Paymaster (Pimlico)</Text>
        <TextInput
          style={styles.input}
          value={paymasterUrl}
          onChangeText={setPaymasterUrl}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="http://10.0.2.2:3000"
          placeholderTextColor="#64748b"
        />
        <TouchableOpacity
          onPress={() => setUsePaymaster((v) => !v)}
          style={[styles.secondaryButton, usePaymaster && { borderColor: colors.success, borderWidth: 1 }]}
        >
          <Text style={styles.buttonText}>
            {usePaymaster ? "✅ Using paymaster" : "Use paymaster"}
          </Text>
        </TouchableOpacity>
        {!usePaymaster && (
          <TouchableOpacity
            onPress={() => setAutoFund((v) => !v)}
            style={[styles.secondaryButton, autoFund && { borderColor: colors.accentSoft, borderWidth: 1 }]}
          >
            <Text style={styles.buttonText}>
              {autoFund ? "✅ Auto-fund 0.05 ETH deposit" : "Auto-fund disabled"}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity onPress={handleBuild} style={[styles.primaryButton, { backgroundColor: colors.success }]} disabled={status === "building"}>
        <Text style={styles.buttonText}>
          {status === "building" ? "Building..." : "Build UserOp & Predict Address"}
        </Text>
      </TouchableOpacity>

      {sender && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.accentSoft }]}>Predicted Account</Text>
          <Text style={styles.value}>{sender}</Text>
          <TouchableOpacity
            onPress={handleFund}
            style={styles.secondaryButton}
            disabled={funding === "funding"}
          >
            <Text style={styles.buttonText}>
              {funding === "funding" ? "Funding..." : "Fund EntryPoint deposit (0.05 ETH)"}
            </Text>
          </TouchableOpacity>
          {fundTxHash && (
            <>
              <Text style={styles.label}>Funding tx</Text>
              <Text style={styles.value}>{fundTxHash}</Text>
            </>
          )}
        </>
      )}

      {userOpHash && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.accentSoft }]}>UserOp Hash to Sign</Text>
          <Text style={styles.value}>{userOpHash}</Text>
          {signature !== "0x" && (
            <>
              <Text style={[styles.sectionTitle, { color: colors.accentSoft }]}>Passkey Signature</Text>
              <Text style={styles.value}>{shortHex(signature, 22, 10)}</Text>
            </>
          )}
        </>
      )}

      {userOp && (
        <TouchableOpacity onPress={handleSend} style={[styles.primaryButton, { backgroundColor: colors.success }]} disabled={status === "sending"}>
          <Text style={styles.buttonText}>{status === "sending" ? "Sending..." : "Send to Bundler"}</Text>
        </TouchableOpacity>
      )}

      {opHash && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.accentSoft }]}>Bundler Operation Hash</Text>
          <Text style={styles.value}>{opHash}</Text>
        </>
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
  subtitle: {
    color: "#cbd5e1",
    marginBottom: 8,
  },
  sectionTitle: {
    fontWeight: "700",
    marginTop: 10,
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
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
    marginTop: 8,
  },
  secondaryButton: {
    backgroundColor: "#1e293b",
    borderRadius: 8,
    padding: 8,
    alignItems: "center",
    marginVertical: 6,
  },
  input: {
    backgroundColor: "#1e293b",
    color: "#e2e8f0",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: "#334155",
    fontSize: 13,
  },
  buttonText: {
    color: "#0b1224",
    fontWeight: "700",
  },
  errorBox: {
    backgroundColor: "#7f1d1d",
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
  },
  errorText: {
    color: "#fecdd3",
  },
  paymasterSection: {
    marginTop: 8,
  },
});

export default CreateAccountDevCard;
