import React, { useMemo, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { getBundlerUrl, getPaymasterUrl } from "@/src/core/network/chain";
import { DEFAULT_CHAIN_ID } from "@/src/integration/chains";
import {
  buildCreateAccountUserOp,
  getDeployment,
  sendUserOp,
  type PasskeyInit,
} from "@/src/integration/viem";
import PasskeyService from "@/src/features/wallet/services/PasskeyService";
import { useUserStore } from "@store/useUserStore";
import { sha256, toBytes } from "viem";
import type { SupportedChainId } from "@/src/integration/chains";
import type { UserOperation } from "viem/account-abstraction";
import type { Hex } from "viem";

// Debug: Log what was imported
console.log('[CreateAccountDevCard] buildCreateAccountUserOp type:', typeof buildCreateAccountUserOp);
console.log('[CreateAccountDevCard] getDeployment type:', typeof getDeployment);

type Props = {
  chainId?: SupportedChainId;
};

const randomHex = (bytes: number): Hex => {
  const arr = new Uint8Array(bytes);
  // global crypto is available via react-native-get-random-values polyfill
  globalThis.crypto.getRandomValues(arr);
  return ("0x" + Buffer.from(arr).toString("hex")) as Hex;
};

export const CreateAccountDevCard: React.FC<Props> = ({ chainId = DEFAULT_CHAIN_ID }) => {
  const [salt, setSalt] = useState<Hex>(() => randomHex(32));
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
  const validator = deployment?.passkeyValidator as Hex | undefined;
  const authUser = useUserStore((state) => state.user);
  const userId = useMemo(() => authUser?.id ?? null, [authUser?.id]);

  const fetchPasskeyInit = async (): Promise<PasskeyInit> => {
    if (!userId) throw new Error("No authenticated user found. Please sign in first.");
    const passkey = await PasskeyService.getPasskey(userId);
    if (!passkey) {
      throw new Error("No passkey found on this device. Create one first.");
    }

    // Recompute rpIdHash to avoid using corrupt stored values
    const rpIdHash = sha256(toBytes(passkey.rpId));

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
      rpIdHash: rpIdHash as Hex,
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
      
      console.log('[CreateAccountDevCard] PasskeyInit for account creation:', {
        idRaw: passkeyInit.idRaw,
        px: passkeyInit.px.toString(16),
        py: passkeyInit.py.toString(16),
        rpIdHash: passkeyInit.rpIdHash,
      });

      const { userOp, userOpHash, sender } = await buildCreateAccountUserOp({
        chainId,
        salt,
        validator,
        passkeyInit,
        bundlerUrl,
        paymasterUrl,
        usePaymaster,
      });

      // Prompt biometric to sign the userOp hash with the stored passkey
      const signed = await PasskeyService.signWithPasskey(userId, userOpHash);
      
      console.log('[CreateAccountDevCard] Signature passkeyId:', signed.passkeyId);
      console.log('[CreateAccountDevCard] Match?', signed.passkeyId === passkeyInit.idRaw);
      console.log("Signed userOpHash:", signed);
      console.log('[CreateAccountDevCard] Signature details:', {
        authenticatorData: signed.authenticatorData.slice(0, 80) + '...',
        authenticatorDataLength: signed.authenticatorData.length,
        clientDataJSON: signed.clientDataJSON,
        challengeIndex: signed.challengeIndex,
        typeIndex: signed.typeIndex,
        r: signed.r.slice(0, 20) + '...',
        s: signed.s.slice(0, 20) + '...',
      });
      
      const encodedSig = PasskeyService.encodeSignatureForContract(signed) as Hex;

      const signedUserOp = { ...userOp, signature: encodedSig };

      setUserOp(userOp);
      setSignature(encodedSig);
      setUserOpHash(userOpHash as Hex);
      setSender(sender as Hex);
      // store signed version to send
      setUserOp(signedUserOp);
      setStatus("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to build/sign userOp");
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
      // Try to decode DelegateAndRevert(bool,bytes) to surface the inner revert
      console.log("[CreateAccountDevCard] sendUserOp error object:", e);
      const rawCandidates = [
        (e as any)?.data,
        (e as any)?.cause?.data,
        (e as any)?.cause?.error?.data,
        (e as any)?.error?.data,
      ].filter((v) => typeof v === "string" && v.startsWith("0x")) as string[];
      for (const raw of rawCandidates) {
        try {
          const [ok, inner] = decodeAbiParameters(
            [{ type: "bool" }, { type: "bytes" }],
            raw as `0x${string}`,
          );
          console.log("[CreateAccountDevCard] delegateAndRevert ok:", ok);
          console.log("[CreateAccountDevCard] inner revert data:", inner);
          break;
        } catch (decodeErr) {
          console.warn("[CreateAccountDevCard] Failed to decode inner revert:", decodeErr, "raw:", raw);
        }
      }
      setError(e instanceof Error ? e.message : "Failed to send userOp");
      setStatus("error");
    }
  };

  const reset = () => {
    setSalt(randomHex(32));
    setStatus("idle");
    setError(null);
    setUserOp(null);
    setUserOpHash(null);
    setSender(null);
    setSignature("0x");
    setOpHash(null);
  };

  return (
    <View style={styles.card}>
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
      <Text style={styles.label}>Salt</Text>
      <Text style={styles.value}>{salt}</Text>
      <TouchableOpacity onPress={reset} style={styles.secondaryButton}>
        <Text style={styles.buttonText}>Regenerate Salt / Reset</Text>
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
          style={[styles.secondaryButton, usePaymaster && { borderColor: "#22c55e", borderWidth: 1 }]}
        >
          <Text style={styles.buttonText}>
            {usePaymaster ? "✅ Using paymaster" : "Use paymaster"}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={handleBuild} style={styles.primaryButton} disabled={status === "building"}>
        <Text style={styles.buttonText}>
          {status === "building" ? "Building..." : "Build UserOp & Predict Address"}
        </Text>
      </TouchableOpacity>

      <Text>
        Just For Filling
        Lorem ipsum dolor sit amet consectetur, adipisicing elit. Minima, nesciunt facilis dolorum commodi consequatur quam eveniet quos, libero voluptatem sunt accusantium ipsa necessitatibus numquam odio doloremque omnis tempore laudantium reiciendis.
      </Text>

      {sender && (
        <>
          <Text style={styles.sectionTitle}>Predicted Account</Text>
          <Text style={styles.value}>{sender}</Text>
        </>
      )}

      {userOpHash && (
        <>
          <Text style={styles.sectionTitle}>UserOp Hash to Sign</Text>
          <Text style={styles.value}>{userOpHash}</Text>
          {signature !== "0x" && (
            <>
              <Text style={styles.sectionTitle}>Passkey Signature</Text>
              <Text style={styles.value}>{signature}</Text>
            </>
          )}
        </>
      )}

      {userOp && (
        <TouchableOpacity onPress={handleSend} style={styles.primaryButton} disabled={status === "sending"}>
          <Text style={styles.buttonText}>{status === "sending" ? "Sending..." : "Send to Bundler"}</Text>
        </TouchableOpacity>
      )}

      {opHash && (
        <>
          <Text style={styles.sectionTitle}>Bundler Operation Hash</Text>
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
  subtitle: {
    color: "#cbd5e1",
    marginBottom: 8,
  },
  sectionTitle: {
    color: "#38bdf8",
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
    backgroundColor: "#22c55e",
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
