import { Feather } from "@expo/vector-icons";
import { NavigationProp, useNavigation } from "@react-navigation/native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import {
  EmailRecoveryService,
  type EmailRecoverySecurityMode,
  type LoadedEmailRecoveryMetadata,
} from "@/src/features/wallet/services/EmailRecoveryService";
import { EmailRecoveryGroupService } from "@/src/features/wallet/services/EmailRecoveryGroupService";
import LocalSignerService from "@/src/features/wallet/services/LocalSignerService";
import PasskeyService from "@/src/features/wallet/services/PasskeyService";
import { useWalletStore } from "@/src/features/wallet/store/useWalletStore";
import {
  DEFAULT_CHAIN_ID,
  type SupportedChainId,
} from "@/src/integration/chains";
import { getDefaultNetworkForChain } from "@/src/integration/networks";
import { ABIS, buildSmartAccountExecutionUserOp, getDeployment } from "@/src/integration/viem";
import { getBundlerUrl } from "@/src/core/network/chain";
import { RootStackParamList } from "@/src/types/navigation";
import { useUserStore } from "@store/useUserStore";
import type { ThemeColors } from "@theme";
import { useAppTheme } from "@theme";

import * as Clipboard from "expo-clipboard";
import { isValidEmail } from "@utils/validation";
import { type Address, type Hex } from "viem";
import type { UserOperation } from "viem/account-abstraction";

import EmailRecoverySetup from "./EmailRecoverySetup";
import EmailRecoveryManage from "./EmailRecoveryManage";

const EmailRecoveryScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { theme } = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(colors), [colors]);

  const user = useUserStore((state) => state.user);
  const storedSmartAccountAddress = useUserStore(
    (state) => state.smartAccountAddress,
  );
  const smartAccountDeployed = useUserStore(
    (state) => state.smartAccountDeployed,
  );
  const aaAccount = useWalletStore((state) => state.aaAccount);
  const activeChainId = useWalletStore((state) => state.activeChainId);

  const smartAccountAddress = useMemo(() => {
    const address =
      aaAccount?.predictedAddress ?? storedSmartAccountAddress ?? undefined;
    return address ? (address as Address) : undefined;
  }, [aaAccount?.predictedAddress, storedSmartAccountAddress]);
  const isAccountDeployed = Boolean(
    aaAccount?.isDeployed ?? smartAccountDeployed ?? false,
  );
  const resolvedChainId = useMemo<SupportedChainId>(
    () =>
      (aaAccount?.chainId ??
        activeChainId ??
        DEFAULT_CHAIN_ID) as SupportedChainId,
    [aaAccount?.chainId, activeChainId],
  );
  const smartAccountReady = Boolean(smartAccountAddress && isAccountDeployed);

  const defaultGuardianCount = 3;
  const [guardianCountValue, setGuardianCountValue] = useState("3");
  const [thresholdValue, setThresholdValue] = useState("2");
  const [guardianEmails, setGuardianEmails] = useState<string[]>(() =>
    Array(defaultGuardianCount).fill(""),
  );
  const [guardianWeights, setGuardianWeights] = useState<string[]>(() =>
    Array(defaultGuardianCount).fill("1"),
  );
  // Safety delay — exposed as tappable DELAY_CHOICES in Setup; converted to
  // minutes for on-chain calls via Math.round(selectedDelaySeconds / 60).
  const [selectedDelaySeconds, setSelectedDelaySeconds] = useState(172800);
  // EmailRecoveryManager enforces expiry - delay >= MINIMUM_RECOVERY_WINDOW
  // (= 2 days = 2880 minutes). Defaults give a 49-hour window above the floor.
  const [expiryMinutes, setExpiryMinutes] = useState("2940");
  const [securityMode, setSecurityMode] =
    useState<EmailRecoverySecurityMode>("none");
  // Force "none" — extra-security UI has been removed from the surface.
  const effectiveSecurityMode: EmailRecoverySecurityMode = "none";
  const [overflowVisible, setOverflowVisible] = useState(false);
  const [vaultKeyInput, setVaultKeyInput] = useState("");
  const [hasVaultKey, setHasVaultKey] = useState(false);
  const [recoveryKitAcked, setRecoveryKitAcked] = useState<boolean | null>(null);

  const [checkingModule, setCheckingModule] = useState(false);
  const [moduleInstalledState, setModuleInstalledState] = useState<
    boolean | null
  >(null);
  const [moduleError, setModuleError] = useState<string | null>(null);
  const [moduleStatusNonce, setModuleStatusNonce] = useState(0);
  const [installingModule, setInstallingModule] = useState(false);
  const [lastUserOpHash, setLastUserOpHash] = useState<Hex | null>(null);
  const [lastOperationHash, setLastOperationHash] = useState<Hex | null>(null);
  const [lastInstallPayload, setLastInstallPayload] =
    useState<UserOperation<"0.7"> | null>(null);
  const [derivedGuardians, setDerivedGuardians] = useState<
    { email: string; guardianAddress: Address }[]
  >([]);
  const [loadingStoredMetadata, setLoadingStoredMetadata] = useState(false);
  const [storedMetadata, setStoredMetadata] =
    useState<LoadedEmailRecoveryMetadata | null>(null);
  const [metadataWarning, setMetadataWarning] = useState<string | null>(null);
  const [checkingLocalSigner, setCheckingLocalSigner] = useState(true);
  const [canSignForWallet, setCanSignForWallet] = useState(false);

  // delayMinutes derived from selectedDelaySeconds for on-chain use
  const parsedDelayMinutes = useMemo(
    () => Math.round(selectedDelaySeconds / 60),
    [selectedDelaySeconds],
  );

  const expectedGuardians = useMemo(
    () => Math.max(parseInt(guardianCountValue, 10) || 0, 0),
    [guardianCountValue],
  );
  const visibleGuardianEmails = useMemo(
    () => guardianEmails.slice(0, expectedGuardians),
    [expectedGuardians, guardianEmails],
  );
  const visibleGuardianWeights = useMemo(
    () => guardianWeights.slice(0, expectedGuardians),
    [expectedGuardians, guardianWeights],
  );
  const trimmedGuardians = useMemo(
    () =>
      visibleGuardianEmails
        .map((email) => EmailRecoveryService.normalizeGuardianEmail(email))
        .filter(Boolean),
    [visibleGuardianEmails],
  );
  const normalizedGuardianWeights = useMemo(
    () =>
      visibleGuardianWeights.map((weight) => Math.max(parseInt(weight, 10) || 0, 0)),
    [visibleGuardianWeights],
  );
  const totalGuardianWeight = useMemo(
    () => normalizedGuardianWeights.reduce((sum, weight) => sum + weight, 0),
    [normalizedGuardianWeights],
  );
  const parsedThreshold = useMemo(
    () => Math.max(parseInt(thresholdValue, 10) || 0, 0),
    [thresholdValue],
  );
  const parsedExpiryMinutes = useMemo(
    () => Math.max(parseInt(expiryMinutes, 10) || 0, 0),
    [expiryMinutes],
  );
  const hasDuplicateGuardians = useMemo(() => {
    const normalized = trimmedGuardians.map((email) => email.toLowerCase());
    return new Set(normalized).size !== normalized.length;
  }, [trimmedGuardians]);
  const guardiansReady =
    expectedGuardians > 0 && trimmedGuardians.length === expectedGuardians;
  const invalidGuardian = useMemo(
    () => trimmedGuardians.find((email) => !isValidEmail(email)) ?? null,
    [trimmedGuardians],
  );
  const invalidWeightIndex = useMemo(
    () => normalizedGuardianWeights.findIndex((weight) => weight <= 0),
    [normalizedGuardianWeights],
  );
  const guardianValidationError = useMemo(() => {
    if (expectedGuardians < 1) {
      return "Add at least one guardian.";
    }
    if (visibleGuardianEmails.length !== expectedGuardians) {
      return "Guardian slots are still syncing. Try again.";
    }
    if (trimmedGuardians.length !== expectedGuardians) {
      return "Fill in every guardian email before continuing.";
    }
    if (invalidGuardian) {
      return `${invalidGuardian} is not a valid email address.`;
    }
    if (hasDuplicateGuardians) {
      return "Duplicate guardian emails are not allowed.";
    }
    if (parsedThreshold < 1) {
      return "Threshold must be at least 1.";
    }
    if (parsedThreshold > expectedGuardians) {
      return "Threshold cannot exceed the guardian count.";
    }
    if (parsedThreshold > totalGuardianWeight) {
      return "Threshold cannot exceed the total guardian weight.";
    }
    if (invalidWeightIndex >= 0) {
      return `Guardian weight at slot ${invalidWeightIndex + 1} must be greater than zero.`;
    }
    if (parsedDelayMinutes < 1 || parsedExpiryMinutes < 1) {
      return "Delay and expiry must both be at least 1 minute.";
    }
    if (parsedExpiryMinutes < parsedDelayMinutes) {
      return "Expiry must be greater than or equal to the delay.";
    }
    // EmailRecoveryManager.configureRecovery requires
    //   expiry - delay >= MINIMUM_RECOVERY_WINDOW (2 days = 2880 minutes).
    // Catch this client-side instead of failing the UserOp at simulation time.
    const MIN_RECOVERY_WINDOW_MINUTES = 2880;
    if (parsedExpiryMinutes - parsedDelayMinutes < MIN_RECOVERY_WINDOW_MINUTES) {
      return `Expiry must be at least ${MIN_RECOVERY_WINDOW_MINUTES} minutes (48 hours) greater than delay. Current window: ${parsedExpiryMinutes - parsedDelayMinutes} min.`;
    }
    return null;
  }, [
    expectedGuardians,
    hasDuplicateGuardians,
    invalidGuardian,
    invalidWeightIndex,
    parsedDelayMinutes,
    parsedExpiryMinutes,
    parsedThreshold,
    totalGuardianWeight,
    trimmedGuardians.length,
    visibleGuardianEmails.length,
  ]);
  const canSubmitGuardianConfig =
    smartAccountReady &&
    guardiansReady &&
    !guardianValidationError &&
    !installingModule;

  useEffect(() => {
    let cancelled = false;

    const loadSignerStatus = async () => {
      if (!user?.id) {
        if (!cancelled) {
          setCanSignForWallet(false);
          setCheckingLocalSigner(false);
        }
        return;
      }

      const signerStatus = await LocalSignerService.getWalletSignerStatus({
        userId: user.id,
        smartAccountAddress: smartAccountAddress ?? null,
        chainId: resolvedChainId,
        expectedPasskeyId: aaAccount?.ownerAddress ?? null,
      });

      if (!cancelled) {
        setCanSignForWallet(signerStatus.canSignForWallet);
        setCheckingLocalSigner(false);
      }
    };

    setCheckingLocalSigner(true);
    void loadSignerStatus();

    return () => {
      cancelled = true;
    };
  }, [aaAccount?.ownerAddress, resolvedChainId, smartAccountAddress, user?.id]);

  useEffect(() => {
    if (!smartAccountReady || !smartAccountAddress) {
      setModuleInstalledState(null);
      setModuleError(null);
      setCheckingModule(false);
      return;
    }
    let cancelled = false;
    setCheckingModule(true);
    EmailRecoveryService.isModuleInstalled(smartAccountAddress, resolvedChainId)
      .then((installed) => {
        if (!cancelled) {
          setModuleInstalledState(installed);
          setModuleError(null);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setModuleError("We couldn't check your setup — please try again.");
          setModuleInstalledState(false);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCheckingModule(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    smartAccountReady,
    smartAccountAddress,
    resolvedChainId,
    moduleStatusNonce,
  ]);

  useEffect(() => {
    if (!user?.id || !smartAccountAddress) {
      setStoredMetadata(null);
      setLoadingStoredMetadata(false);
      return;
    }

    let cancelled = false;
    setLoadingStoredMetadata(true);
    EmailRecoveryService.loadMetadata({
      smartAccountAddress,
    })
      .then((metadata) => {
        if (cancelled) return;
        setStoredMetadata(metadata);
        if (!metadata) return;

        const guardianCount = Math.max(metadata.guardians.length, 1);
        setGuardianCountValue(String(guardianCount));
        setThresholdValue(String(metadata.config.threshold));
        // Restore selected delay from stored metadata
        const storedDelaySeconds = metadata.config.delaySeconds;
        if (storedDelaySeconds > 0) {
          setSelectedDelaySeconds(storedDelaySeconds);
        }
        setExpiryMinutes(
          String(
            Math.max(Math.floor(metadata.config.expirySeconds / 60), 1),
          ),
        );
        setSecurityMode(metadata.config.securityMode ?? "none");
        setGuardianEmails(
          metadata.guardians.map((guardian) => {
            if (guardian.resolvedEmail) return guardian.resolvedEmail;
            if (metadata.config.securityMode === "none")
              return guardian.maskedEmail;
            return "";
          }),
        );
        setGuardianWeights(
          metadata.guardians.map((guardian) =>
            String(Math.max(guardian.weight, 1)),
          ),
        );

        EmailRecoveryService.hasVaultKey(smartAccountAddress)
          .then(setHasVaultKey)
          .catch(() => setHasVaultKey(false));

        EmailRecoveryService.isRecoveryKitAcknowledged(smartAccountAddress)
          .then(setRecoveryKitAcked)
          .catch(() => setRecoveryKitAcked(false));
      })
      .catch((error) => {
        if (cancelled) return;
        console.warn("[EmailRecovery] loadMetadata failed", error);
        setMetadataWarning("We couldn't load your recovery info — please try again.");
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingStoredMetadata(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [smartAccountAddress, user?.id]);

  // Periodically poll for guardian acceptance once the module is installed
  // and at least one guardian is still pending. Stops polling when all
  // guardians are accepted or after the screen unmounts.
  useEffect(() => {
    if (!storedMetadata?.config?.id || !smartAccountAddress) return;
    const hasPending = storedMetadata.guardians.some(
      (g) => g.acceptanceStatus === "pending" || g.acceptanceStatus === "acceptance_email_sent",
    );
    if (!hasPending || !moduleInstalledState) return;

    const configId = storedMetadata.config.id;
    let cancelled = false;
    const poll = async () => {
      try {
        const adapter = EmailRecoveryGroupService.createRelayer();
        await EmailRecoveryService.pollGuardianAcceptanceStatuses({
          smartAccountAddress,
          configId,
          adapter,
          chainId: resolvedChainId,
        });
        if (cancelled) return;
        const next = await EmailRecoveryService.loadMetadata({ smartAccountAddress });
        if (!cancelled) setStoredMetadata(next);
      } catch (err) {
        console.warn("[EmailRecovery] poll acceptance failed", err);
      }
    };

    void poll();
    const handle = setInterval(() => void poll(), 12_000);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [
    storedMetadata?.config?.id,
    storedMetadata?.guardians,
    smartAccountAddress,
    moduleInstalledState,
    resolvedChainId,
  ]);

  useEffect(() => {
    if (
      !storedMetadata ||
      moduleInstalledState === null ||
      !smartAccountAddress
    ) {
      return;
    }

    const currentInstall = storedMetadata.installations.find(
      (i) => i.chainId === Number(resolvedChainId),
    );
    const backendStatus = currentInstall?.installStatus ?? "not_installed";

    if (backendStatus === "installed" && !moduleInstalledState) {
      console.warn("[EmailRecovery] backend says installed but on-chain disagrees — user prompted to verify");
      setMetadataWarning("We couldn't confirm your setup — try again.");
      return;
    }
    if (backendStatus !== "installed" && moduleInstalledState) {
      console.log("[EmailRecovery] on-chain active, syncing backend status");
      setMetadataWarning(null);
      EmailRecoveryService.syncCurrentChainInstallStatus({
        configId: storedMetadata.config.id,
        chainId: resolvedChainId,
        installStatus: "installed",
      })
        .then(() => {
          setStoredMetadata((current) => {
            if (!current) return current;
            const updated: LoadedEmailRecoveryMetadata["installations"] =
              current.installations.map((i) =>
                i.chainId === Number(resolvedChainId)
                  ? { ...i, installStatus: "installed" as const }
                  : i,
              );
            if (!updated.find((i) => i.chainId === Number(resolvedChainId))) {
              updated.push({
                chainId: Number(resolvedChainId),
                installStatus: "installed" as const,
                installUserOpHash: null,
                installedAt: new Date().toISOString(),
                lastCheckedAt: new Date().toISOString(),
              });
            }
            return { ...current, installations: updated };
          });
          setMetadataWarning(null);
        })
        .catch(() => {
          // Keep warning visible if backend sync fails.
        });
      return;
    }

    setMetadataWarning(null);
  }, [
    moduleInstalledState,
    resolvedChainId,
    smartAccountAddress,
    storedMetadata,
  ]);

  const handleGuardianCountChange = useCallback((value: string) => {
    const parsed = parseInt(value, 10) || 0;
    setGuardianCountValue(value);
    setDerivedGuardians([]);
    setGuardianEmails((current) => {
      if (parsed > current.length) {
        return [...current, ...Array(parsed - current.length).fill("")];
      }
      return current.slice(0, parsed);
    });
    setGuardianWeights((current) => {
      if (parsed > current.length) {
        return [...current, ...Array(parsed - current.length).fill("1")];
      }
      return current.slice(0, parsed);
    });
  }, []);

  const handleDeleteGuardian = useCallback((index: number) => {
    setGuardianEmails((prev) => prev.filter((_, i) => i !== index));
    setGuardianWeights((prev) => prev.filter((_, i) => i !== index));

    setGuardianCountValue((prev) => {
      const currentVal = parseInt(prev, 10) || 0;
      return String(Math.max(0, currentVal - 1));
    });
    setDerivedGuardians([]);
  }, []);

  const [removingGuardianId, setRemovingGuardianId] = useState<string | null>(null);
  const [resendingGuardianId, setResendingGuardianId] = useState<string | null>(null);
  const [addingPostInstallGuardian, setAddingPostInstallGuardian] = useState(false);
  const [newPostInstallEmail, setNewPostInstallEmail] = useState("");
  const [newPostInstallWeight, setNewPostInstallWeight] = useState("1");

  /**
   * Adds a guardian to an already-installed Email Recovery module via an
   * on-chain addGuardian UserOp, persists the row in Supabase, and fires the
   * acceptance email. Used to escape the "removeGuardian blocked by threshold"
   * lockout when totalWeight=threshold=1.
   */
  const handleAddPostInstallGuardian = useCallback(async () => {
    if (!user?.id || !smartAccountAddress || !storedMetadata?.config?.id) return;
    const email = newPostInstallEmail.trim();
    if (!isValidEmail(email)) {
      Alert.alert("Invalid Email", "Enter a valid guardian email address.");
      return;
    }
    const weight = Math.max(parseInt(newPostInstallWeight, 10) || 0, 1);
    const alreadyConfigured = storedMetadata.guardians.some(
      (g) => (g.resolvedEmail ?? g.maskedEmail).toLowerCase() === email.toLowerCase(),
    );
    if (alreadyConfigured) {
      Alert.alert(
        "Already Configured",
        "This email is already a guardian on this wallet. Use a different email.",
      );
      return;
    }
    const passkey = await PasskeyService.getPasskey(user.id);
    if (!passkey) {
      Alert.alert("Passkey Required", "Cannot find a passkey on this device.");
      return;
    }

    setAddingPostInstallGuardian(true);
    setModuleError(null);
    try {
      const adapter = EmailRecoveryGroupService.createRelayer();

      // 1. Derive on-chain guardian address (mints + persists accountCode).
      const [derived] = await EmailRecoveryService.deriveGuardianAddresses(
        smartAccountAddress,
        [email],
        resolvedChainId,
        adapter,
      );
      if (!derived?.guardianAddress) {
        console.warn("[EmailRecovery] could not derive guardian address — accountCode may be lost");
        throw new Error("We couldn't add this guardian — try removing and re-adding them.");
      }

      // 2. Build + sign + submit addGuardian UserOp.
      const { userOp, userOpHash } = await EmailRecoveryService.buildAddGuardianUserOp({
        smartAccountAddress,
        guardianAddress: derived.guardianAddress,
        weight: BigInt(weight),
        passkeyId: passkey.credentialIdRaw as Hex,
        chainId: resolvedChainId,
        usePaymaster: true,
      });
      const signature = await PasskeyService.signWithPasskey(user.id, userOpHash);
      const encodedSignature = PasskeyService.encodeSignatureForContract(signature) as Hex;
      const signedUserOp = { ...userOp, signature: encodedSignature };
      await EmailRecoveryService.submitInstallModuleUserOp({
        signedUserOp,
        chainId: resolvedChainId,
      });

      // 3. Persist Supabase row so loadMetadata + polling pick it up.
      const { rowId } = await EmailRecoveryService.persistAddedGuardian({
        smartAccountAddress,
        configId: storedMetadata.config.id,
        guardianEmail: email,
        weight,
        securityMode: effectiveSecurityMode,
      });

      // 4. Fire the acceptance invite for this one guardian.
      const result = await EmailRecoveryService.sendGuardianAcceptanceEmails({
        smartAccountAddress,
        configId: storedMetadata.config.id,
        adapter,
      });

      // 5. Refresh metadata + clear inputs.
      const next = await EmailRecoveryService.loadMetadata({ smartAccountAddress });
      setStoredMetadata(next);
      setNewPostInstallEmail("");
      setNewPostInstallWeight("1");

      if (result.sent > 0) {
        Alert.alert(
          "Guardian Added",
          `${email} was added to your recovery setup. They'll receive an invitation — ask them to check their inbox (and spam).`,
        );
      } else {
        console.warn("[EmailRecovery] guardian added but invite failed", result.errors[0]);
        Alert.alert(
          "Guardian Added",
          `${email} was added, but the invitation didn't send.\n\nUse the ↻ button to try again.`,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not add guardian.";
      console.warn("[EmailRecovery] addPostInstallGuardian failed", err);
      setModuleError("Couldn't add this guardian — please try again.");
      Alert.alert("Couldn't Add Guardian", msg);
    } finally {
      setAddingPostInstallGuardian(false);
    }
  }, [
    user?.id,
    smartAccountAddress,
    storedMetadata?.config?.id,
    storedMetadata?.guardians,
    newPostInstallEmail,
    newPostInstallWeight,
    resolvedChainId,
    securityMode,
  ]);

  /**
   * Resets a guardian's acceptance row to pending and re-fires the invite
   * through the relayer. Used when the original acceptance request got stuck
   * (e.g. prove.email's prover 502'd or queue dropped the job).
   */
  const handleResendGuardianInvite = useCallback(
    async (guardianRowId: string, maskedEmail: string) => {
      if (!smartAccountAddress || !storedMetadata?.config?.id) return;
      setResendingGuardianId(guardianRowId);
      setModuleError(null);
      try {
        const adapter = EmailRecoveryGroupService.createRelayer();
        const result = await EmailRecoveryService.resendGuardianAcceptanceInvite({
          smartAccountAddress,
          configId: storedMetadata.config.id,
          guardianRowId,
          adapter,
        });
        const next = await EmailRecoveryService.loadMetadata({ smartAccountAddress });
        setStoredMetadata(next);
        if (result.sent > 0) {
          Alert.alert(
            "Invitation Re-sent",
            `A new invitation was sent to ${maskedEmail}. Ask them to check their inbox (and spam).`,
          );
        } else {
          const relayerMsg = result.errors[0] ?? "";
          console.warn("[EmailRecovery] resend invite failed", relayerMsg);
          const isAccountCodeDupe = /account code already used/i.test(relayerMsg);
          const hint = isAccountCodeDupe
            ? "\n\nTap the trash icon to remove this guardian, then add them back to start a fresh invitation."
            : "";
          Alert.alert("Invitation Not Sent", `We couldn't send the invitation.${hint}`);
        }
      } catch (err) {
        console.warn("[EmailRecovery] resendGuardianInvite failed", err);
        setModuleError("Couldn't resend the invitation — please try again.");
        Alert.alert("Invitation Not Sent", "We couldn't resend the invitation. Please try again.");
      } finally {
        setResendingGuardianId(null);
      }
    },
    [smartAccountAddress, storedMetadata?.config?.id],
  );

  /**
   * Builds + signs + submits an on-chain removeGuardian UserOp via the
   * SmartAccount, then deletes the Supabase row and clears the local
   * accountCode. Used by the "Remove" button next to an accepted guardian.
   *
   * Note: this REDUCES the guardian set. If `acceptedWeight` was at the
   * threshold, removal can drop the wallet below recoverable state — the
   * confirmation dialog warns the user explicitly.
   */
  const handleRemoveInstalledGuardian = useCallback(
    async (guardianRowId: string, guardianMaskedEmail: string, encryptedEmail: string) => {
      if (!user?.id || !smartAccountAddress || !storedMetadata?.config?.id) return;

      const passkey = await PasskeyService.getPasskey(user.id);
      if (!passkey) {
        Alert.alert("Passkey required", "Cannot find a passkey on this device.");
        return;
      }

      const email = await EmailRecoveryService.decryptEmail(
        encryptedEmail,
        smartAccountAddress,
      );
      if (!email) {
        Alert.alert(
          "Locked",
          "This guardian's email is locked on this device. Import your Recovery Kit before removing.",
        );
        return;
      }

      setRemovingGuardianId(guardianRowId);
      setModuleError(null);
      try {
        const adapter = EmailRecoveryGroupService.createRelayer();
        const derived = await EmailRecoveryService.deriveGuardianAddresses(
          smartAccountAddress,
          [email],
          resolvedChainId,
          adapter,
        );
        const guardianAddress = derived[0]?.guardianAddress;
        if (!guardianAddress) {
          throw new Error("Could not derive guardian address — accountCode may have been lost.");
        }

        const { userOp, userOpHash } = await EmailRecoveryService.buildRemoveGuardianUserOp({
          smartAccountAddress,
          guardianAddress,
          passkeyId: passkey.credentialIdRaw as Hex,
          chainId: resolvedChainId,
          usePaymaster: true,
        });

        const signature = await PasskeyService.signWithPasskey(user.id, userOpHash);
        const encodedSignature = PasskeyService.encodeSignatureForContract(signature) as Hex;
        const signedUserOp = { ...userOp, signature: encodedSignature };

        await EmailRecoveryService.submitInstallModuleUserOp({
          signedUserOp,
          chainId: resolvedChainId,
        });

        await EmailRecoveryService.cleanupRemovedGuardian({
          smartAccountAddress,
          guardianRowId,
          guardianEmail: email,
        });

        const refreshed = await EmailRecoveryService.loadMetadata({ smartAccountAddress });
        setStoredMetadata(refreshed);
        Alert.alert("Guardian Removed", `${guardianMaskedEmail} has been removed.`);
      } catch (err) {
        console.warn("[EmailRecovery] removeInstalledGuardian failed", err);
        setModuleError("Couldn't remove this guardian — please try again.");
        Alert.alert("Couldn't Remove Guardian", "We couldn't remove this guardian. Please try again.");
      } finally {
        setRemovingGuardianId(null);
      }
    },
    [user?.id, smartAccountAddress, storedMetadata?.config?.id, resolvedChainId],
  );

  const confirmRemoveInstalledGuardian = useCallback(
    (guardianRowId: string, guardianMaskedEmail: string, encryptedEmail: string) => {
      const acceptedCount = storedMetadata?.guardians.filter(
        (g) => g.acceptanceStatus === "accepted",
      ).length ?? 0;
      const threshold = storedMetadata?.config.threshold ?? 0;
      const willDropBelowThreshold = acceptedCount <= threshold;

      Alert.alert(
        "Remove Guardian?",
        willDropBelowThreshold
          ? `${guardianMaskedEmail} is needed to meet your threshold of ${threshold}. Removing them means you won't be able to recover this wallet until you add another guardian. Continue?`
          : `Remove ${guardianMaskedEmail} from your recovery setup?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: () =>
              void handleRemoveInstalledGuardian(guardianRowId, guardianMaskedEmail, encryptedEmail),
          },
        ],
      );
    },
    [storedMetadata, handleRemoveInstalledGuardian],
  );

  const handleGuardianEmailChange = useCallback(
    (index: number, value: string) => {
      setDerivedGuardians([]);
      setGuardianEmails((prev) => {
        const updated = [...prev];
        updated[index] = value;
        return updated;
      });
    },
    [],
  );

  const handleWeightChange = useCallback((index: number, value: string) => {
    setDerivedGuardians([]);
    setGuardianWeights((prev) => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  }, []);

  const handleRefreshModuleStatus = useCallback(() => {
    if (!smartAccountReady) return;
    setModuleStatusNonce((nonce) => nonce + 1);
  }, [smartAccountReady]);

  /**
   * Builds + signs + submits an `uninstallModule` UserOp on the SmartAccount,
   * then marks the backend install record as "not_installed" and resets local
   * UI state to show the Setup view. Called from the "Turn off Email Recovery"
   * danger button in EmailRecoveryManage.
   */
  const handleTurnOffEmailRecovery = useCallback(() => {
    Alert.alert(
      "Turn off Email Recovery?",
      "This will remove the email recovery module from your wallet. Your guardians won't be able to help you recover access. You can turn it back on at any time.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Turn Off",
          style: "destructive",
          onPress: async () => {
            if (!user?.id || !smartAccountAddress || !storedMetadata?.config?.id) return;
            const passkey = await PasskeyService.getPasskey(user.id);
            if (!passkey) {
              Alert.alert("Passkey Required", "Cannot find a passkey on this device.");
              return;
            }
            setInstallingModule(true);
            setModuleError(null);
            try {
              const { encodeFunctionData } = await import("viem");
              const deployment = getDeployment(resolvedChainId);
              if (!deployment?.emailRecovery) {
                throw new Error(`No Email Recovery module configured for chain ${resolvedChainId}`);
              }
              // ERC-7579 executor module type = 2
              const uninstallCalldata = encodeFunctionData({
                abi: ABIS.smartAccount,
                functionName: "uninstallModule",
                args: [2n, deployment.emailRecovery as Address, "0x"],
              });
              const bundlerUrl = getBundlerUrl(resolvedChainId);
              const { userOp, userOpHash } = await buildSmartAccountExecutionUserOp({
                smartAccountAddress,
                target: smartAccountAddress,
                value: 0n,
                data: uninstallCalldata,
                passkeyId: passkey.credentialIdRaw as Hex,
                chainId: resolvedChainId,
                bundlerUrl,
                usePaymaster: true,
              });
              const signature = await PasskeyService.signWithPasskey(user.id, userOpHash);
              const encodedSignature = PasskeyService.encodeSignatureForContract(signature) as Hex;
              const signedUserOp = { ...userOp, signature: encodedSignature };
              await EmailRecoveryService.submitInstallModuleUserOp({
                signedUserOp,
                chainId: resolvedChainId,
              });
              await EmailRecoveryService.syncCurrentChainInstallStatus({
                configId: storedMetadata.config.id,
                chainId: resolvedChainId,
                installStatus: "not_installed",
              });
              setModuleInstalledState(false);
              setStoredMetadata(null);
              Alert.alert(
                "Email Recovery Turned Off",
                "The email recovery module has been removed from your wallet.",
              );
            } catch (err) {
              const msg = err instanceof Error ? err.message : "Could not turn off email recovery.";
              console.warn("[EmailRecovery] uninstall failed", err);
              setModuleError("Couldn't turn off email recovery — please try again.");
              Alert.alert("Turn Off Failed", msg);
            } finally {
              setInstallingModule(false);
            }
          },
        },
      ],
    );
  }, [user?.id, smartAccountAddress, storedMetadata?.config?.id, resolvedChainId]);

  const parseGuardianWeights = useCallback((): bigint[] => {
    return visibleGuardianWeights.map((weight, index) => {
      const parsed = parseInt(weight, 10) || 0;
      if (parsed <= 0) {
        throw new Error(
          `Guardian weight at index ${index + 1} must be greater than zero.`,
        );
      }
      return BigInt(parsed);
    });
  }, [visibleGuardianWeights]);

  const handleSaveToCloud = useCallback(async () => {
    if (!smartAccountReady || !smartAccountAddress) {
      Alert.alert(
        "Smart Account Required",
        "Deploy your smart account before syncing.",
      );
      return;
    }
    if (!user?.id) {
      Alert.alert("Authentication Required", "Please sign in to sync.");
      return;
    }
    if (guardianValidationError) {
      Alert.alert("Check Guardian Setup", guardianValidationError);
      return;
    }

    let parsedWeights: bigint[];
    try {
      parsedWeights = parseGuardianWeights();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Guardian weights must be greater than zero.";
      Alert.alert("Invalid Weights", message);
      return;
    }

    setInstallingModule(true);
    try {
      await EmailRecoveryService.persistMetadata({
        userId: user.id,
        smartAccountAddress,
        chainId: resolvedChainId,
        guardianEmails: trimmedGuardians,
        guardianWeights: parsedWeights,
        threshold: BigInt(parsedThreshold),
        delaySeconds: BigInt(parsedDelayMinutes) * 60n,
        expirySeconds: BigInt(parsedExpiryMinutes) * 60n,
        securityMode: effectiveSecurityMode,
        installStatus: moduleInstalledState ? "installed" : "pending",
        installUserOpHash:
          "0x0000000000000000000000000000000000000000000000000000000000000000",
      });

      const refreshedMetadata = await EmailRecoveryService.loadMetadata({
        smartAccountAddress,
      });
      setStoredMetadata(refreshedMetadata);
      Alert.alert(
        "Sync Complete",
        "Configuration synced to the cloud successfully.",
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to sync metadata.";
      Alert.alert("Sync Failed", message);
    } finally {
      setInstallingModule(false);
    }
  }, [
    smartAccountReady,
    smartAccountAddress,
    user?.id,
    trimmedGuardians,
    resolvedChainId,
    guardianValidationError,
    parseGuardianWeights,
    parsedDelayMinutes,
    parsedExpiryMinutes,
    parsedThreshold,
    securityMode,
    moduleInstalledState,
  ]);

  const handleInstallModule = useCallback(async () => {
    // ADR-0006: email recovery UI is gated to chains where the ZK Email
    // hosted relayer runs. Block immediately on tap so the user isn't
    // surprised after filling in guardian emails.
    const networkConfig = getDefaultNetworkForChain(resolvedChainId);
    if (!networkConfig?.emailRecoverySupported) {
      const chainName = networkConfig?.name ?? `chain ${resolvedChainId}`;
      Alert.alert(
        "Not available on this chain",
        `Email recovery is only available on Base Sepolia right now. Switch chains and try again.\n\nYou're currently on ${chainName}.`,
      );
      return;
    }

    if (!smartAccountReady || !smartAccountAddress) {
      Alert.alert(
        "Wallet Required",
        "Set up your wallet before enabling email recovery.",
      );
      return;
    }
    if (!user?.id) {
      Alert.alert(
        "Sign In Required",
        "Please sign in to continue.",
      );
      return;
    }
    if (guardianValidationError) {
      Alert.alert("Check Guardian Setup", guardianValidationError);
      return;
    }

    let parsedWeights: bigint[];
    try {
      parsedWeights = parseGuardianWeights();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Guardian weights must be greater than zero.";
      Alert.alert("Invalid Weights", message);
      return;
    }

    setInstallingModule(true);
    setModuleError(null);
    setLastUserOpHash(null);
    setLastOperationHash(null);

    try {
      const passkey = await PasskeyService.getPasskey(user.id);
      if (!passkey) {
        throw new Error(
          "No passkey found on this device. Create a passkey first.",
        );
      }

      const relayerAdapter = EmailRecoveryGroupService.createRelayer();
      const derivedGuardians =
        await EmailRecoveryService.deriveGuardianAddresses(
          smartAccountAddress,
          trimmedGuardians,
          resolvedChainId,
          relayerAdapter,
        );
      setDerivedGuardians(
        derivedGuardians.map(({ email, guardianAddress }) => ({
          email,
          guardianAddress,
        })),
      );

      const { userOp, userOpHash } =
        await EmailRecoveryService.buildInstallModuleUserOp({
          smartAccountAddress,
          guardians: derivedGuardians.map(
            ({ guardianAddress }) => guardianAddress,
          ),
          weights: parsedWeights,
          threshold: BigInt(parsedThreshold),
          delay: BigInt(parsedDelayMinutes) * 60n,
          expiry: BigInt(parsedExpiryMinutes) * 60n,
          passkeyId: passkey.credentialIdRaw as Hex,
          chainId: resolvedChainId,
          usePaymaster: true,
        });

      setLastUserOpHash(userOpHash);

      const signature = await PasskeyService.signWithPasskey(
        user.id,
        userOpHash,
      );
      const encodedSignature = PasskeyService.encodeSignatureForContract(
        signature,
      ) as Hex;
      const signedUserOp = { ...userOp, signature: encodedSignature };

      const operationHash =
        await EmailRecoveryService.submitInstallModuleUserOp({
          signedUserOp,
          chainId: resolvedChainId,
        });

      await EmailRecoveryService.persistMetadata({
        userId: user.id,
        smartAccountAddress,
        chainId: resolvedChainId,
        guardianEmails: trimmedGuardians,
        guardianWeights: parsedWeights,
        threshold: BigInt(parsedThreshold),
        delaySeconds: BigInt(parsedDelayMinutes) * 60n,
        expirySeconds: BigInt(parsedExpiryMinutes) * 60n,
        securityMode: effectiveSecurityMode,
        installStatus: "pending",
        installUserOpHash: operationHash,
      });

      const refreshedMetadata = await EmailRecoveryService.loadMetadata({
        smartAccountAddress,
      });
      setStoredMetadata(refreshedMetadata);

      setLastOperationHash(operationHash);
      setLastInstallPayload(signedUserOp);
      setModuleInstalledState(true);

      // Fire-and-forget acceptance emails. Guardians whose addresses are now
      // registered on-chain (post bundler confirmation) will receive an email
      // with a one-tap accept link from the ZK Email relayer. If the install
      // UserOp hasn't landed yet when the guardian replies, `handleAcceptance`
      // reverts and the relayer surfaces the failure via requestStatus — we
      // can retry from the per-guardian UI later.
      if (refreshedMetadata?.config?.id) {
        const configIdForInvites = refreshedMetadata.config.id;
        void (async () => {
          try {
            const inviteAdapter = EmailRecoveryGroupService.createRelayer();
            const result = await EmailRecoveryService.sendGuardianAcceptanceEmails({
              smartAccountAddress,
              configId: configIdForInvites,
              adapter: inviteAdapter,
            });
            if (result.sent > 0) {
              // Refresh metadata so per-guardian acceptance_status renders.
              const next = await EmailRecoveryService.loadMetadata({
                smartAccountAddress,
              });
              setStoredMetadata(next);
            }
          } catch (err) {
            console.warn("[EmailRecovery] acceptance email send failed", err);
          }
        })();
      }

      Alert.alert(
        "Email Recovery Activated",
        "Your guardians will receive an invitation — they need to reply to confirm before recovery is active.",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to set up email recovery.";
      console.warn("[EmailRecovery] install failed", error);
      setModuleError("We couldn't complete setup — please try again.");
      Alert.alert("Setup Failed", "We couldn't complete setup. Please try again.");
    } finally {
      setInstallingModule(false);
    }
  }, [
    guardianValidationError,
    parseGuardianWeights,
    parsedDelayMinutes,
    parsedExpiryMinutes,
    parsedThreshold,
    resolvedChainId,
    smartAccountAddress,
    smartAccountReady,
    trimmedGuardians,
    user?.id,
    effectiveSecurityMode,
    // networkConfig is derived from resolvedChainId; no need to list separately
  ]);

  const handleAcknowledgeRecoveryKit = useCallback(async () => {
    if (!smartAccountAddress) return;
    Alert.alert(
      "Confirm Backup",
      "Have you saved your Recovery Kit somewhere secure (password manager, encrypted note)? Without it, after a guardian recovery to a new device, guardian emails will appear locked.",
      [
        { text: "Not yet", style: "cancel" },
        {
          text: "Yes, I've backed it up",
          onPress: async () => {
            await EmailRecoveryService.markRecoveryKitAcknowledged(smartAccountAddress);
            setRecoveryKitAcked(true);
          },
        },
      ],
    );
  }, [smartAccountAddress]);

  const handleExportRecoveryKit = useCallback(async () => {
    if (!smartAccountAddress) {
      Alert.alert(
        "Smart Account Required",
        "Create or load your smart account first.",
      );
      return;
    }

    try {
      const vaultKey =
        await EmailRecoveryService.getVaultKeyBase64(smartAccountAddress);
      if (!vaultKey) {
        Alert.alert(
          "No Vault Key Found",
          "Enable Extra Security and save/install recovery once to generate a vault key.",
        );
        return;
      }
      navigation.navigate("RecoveryKitExport", {
        vaultKey,
        smartAccountAddress,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load vault key.";
      Alert.alert("Export Failed", message);
    }
  }, [navigation, smartAccountAddress]);

  const handleImportVaultKey = useCallback(async () => {
    if (!smartAccountAddress) {
      Alert.alert(
        "Smart Account Required",
        "Create or load your smart account first.",
      );
      return;
    }
    if (!vaultKeyInput.trim()) {
      Alert.alert(
        "Vault Key Required",
        "Paste your Base64 vault key to import.",
      );
      return;
    }

    try {
      await EmailRecoveryService.importVaultKeyBase64(
        smartAccountAddress,
        vaultKeyInput.trim(),
      );
      setVaultKeyInput("");
      setHasVaultKey(true);

      const refreshedMetadata = await EmailRecoveryService.loadMetadata({
        smartAccountAddress,
      });
      setStoredMetadata(refreshedMetadata);

      Alert.alert(
        "Vault Key Imported",
        "Guardians are now unlocked on this device.",
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to import vault key.";
      Alert.alert("Import Failed", message);
    }
  }, [smartAccountAddress, vaultKeyInput]);

  if (checkingLocalSigner || !canSignForWallet) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Feather name="arrow-left" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Email Recovery</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            {checkingLocalSigner ? (
              <>
                <Text style={styles.cardTitle}>Checking local signer access...</Text>
                <ActivityIndicator size="small" color={colors.accentAlt} />
                <Text style={styles.cardDesc}>
                  Trezo is verifying whether this device has a wallet passkey that is active for
                  this account.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.cardTitle}>This device cannot manage email recovery yet</Text>
                <Text style={styles.cardDesc}>
                  Email recovery setup is wallet-authorized. This device may know the wallet and its
                  saved metadata, but it cannot change or install recovery until a passkey on this
                  device is active for the wallet.
                </Text>
                <TouchableOpacity
                  style={styles.installButton}
                  onPress={() => navigation.navigate("RecoveryEntry")}
                  activeOpacity={0.85}
                >
                  <Text style={styles.installButtonText}>Open recovery options</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => navigation.navigate("BackupRecovery")}
                  activeOpacity={0.85}
                >
                  <Text style={styles.secondaryButtonText}>Back to backup & recovery</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Email Recovery</Text>
        <TouchableOpacity
          onPress={() => {
            const info = storedMetadata
              ? [
                  `Account: ${smartAccountAddress ?? "unknown"}`,
                  `Chain: ${resolvedChainId}`,
                  `Threshold: ${storedMetadata.config.threshold}`,
                  `Delay: ${Math.floor(storedMetadata.config.delaySeconds / 60)}m`,
                  `Expiry: ${Math.floor(storedMetadata.config.expirySeconds / 60)}m`,
                  `Guardians: ${storedMetadata.guardians.length}`,
                  `Status: ${storedMetadata.installations.find(i => i.chainId === Number(resolvedChainId))?.installStatus ?? "not_installed"}`,
                ].join("\n")
              : `Account: ${smartAccountAddress ?? "unknown"}\nChain: ${resolvedChainId}\nNo metadata loaded`;
            void Clipboard.setStringAsync(info);
            Alert.alert("Copied", "Debug info copied to clipboard.");
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="more-horizontal" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {moduleInstalledState === null ? (
          /* Checking module install status */
          <View style={styles.card}>
            <ActivityIndicator size="small" color={colors.accentAlt} />
            <Text style={styles.cardDesc}>Checking your recovery setup…</Text>
          </View>
        ) : moduleInstalledState ? (
          <EmailRecoveryManage
            storedMetadata={storedMetadata}
            loadingStoredMetadata={loadingStoredMetadata}
            moduleError={moduleError}
            resendingGuardianId={resendingGuardianId}
            removingGuardianId={removingGuardianId}
            onResendInvite={handleResendGuardianInvite}
            onConfirmRemoveGuardian={confirmRemoveInstalledGuardian}
            newPostInstallEmail={newPostInstallEmail}
            onNewPostInstallEmailChange={setNewPostInstallEmail}
            addingPostInstallGuardian={addingPostInstallGuardian}
            onAddPostInstallGuardian={handleAddPostInstallGuardian}
            visibleGuardianWeights={visibleGuardianWeights}
            onWeightChange={handleWeightChange}
            onTurnOff={handleTurnOffEmailRecovery}
          />
        ) : (
          <EmailRecoverySetup
            guardianCountValue={guardianCountValue}
            thresholdValue={thresholdValue}
            visibleGuardianEmails={visibleGuardianEmails}
            hasDuplicateGuardians={hasDuplicateGuardians}
            guardianValidationError={guardianValidationError}
            onGuardianCountChange={handleGuardianCountChange}
            onThresholdChange={setThresholdValue}
            onGuardianEmailChange={handleGuardianEmailChange}
            onDeleteGuardian={handleDeleteGuardian}
            selectedDelaySeconds={selectedDelaySeconds}
            onDelaySecondsChange={setSelectedDelaySeconds}
            smartAccountReady={smartAccountReady}
            canSubmitGuardianConfig={canSubmitGuardianConfig}
            installingModule={installingModule}
            moduleError={moduleError}
            checkingModule={checkingModule}
            onInstall={handleInstallModule}
          />
        )}
      </ScrollView>
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingTop: 60,
      paddingBottom: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderMuted,
    },
    headerTitle: {
      color: colors.textPrimary,
      fontSize: 17,
      fontWeight: "600",
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 20,
      paddingBottom: 48,
      gap: 12,
    },
    card: {
      backgroundColor: colors.surfaceCard,
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: 18,
      gap: 14,
    },
    cardTitle: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "600",
    },
    cardDesc: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 18,
    },
    installButton: {
      backgroundColor: colors.accentAlt,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: "center",
    },
    installButtonText: {
      color: colors.textOnAccent,
      fontSize: 15,
      fontWeight: "600",
    },
    secondaryButton: {
      borderWidth: 1,
      borderColor: `${colors.accentAlt}4D`,
      borderRadius: 14,
      paddingVertical: 12,
      alignItems: "center",
      backgroundColor: `${colors.accentAlt}1A`,
    },
    secondaryButtonText: {
      color: colors.accentAlt,
      fontSize: 14,
      fontWeight: "700",
    },
  });

export default EmailRecoveryScreen;
