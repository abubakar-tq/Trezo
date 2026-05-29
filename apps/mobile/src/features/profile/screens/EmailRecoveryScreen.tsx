import { Feather } from "@expo/vector-icons";
import { NavigationProp, useNavigation } from "@react-navigation/native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
import { RootStackParamList } from "@/src/types/navigation";
import { useUserStore } from "@store/useUserStore";
import type { ThemeColors } from "@theme";
import { useAppTheme } from "@theme";

import { isValidEmail } from "@utils/validation";
import { type Address, type Hex } from "viem";
import type { UserOperation } from "viem/account-abstraction";
import { CardSkeleton, EmptyState, Skeleton, TextLineSkeleton } from "@shared/components/ui";

const shortenHex = (value: string | null | undefined, chars = 6) => {
  if (!value) return "-";
  if (value.length <= chars * 2 + 2) return value;
  return `${value.slice(0, chars + 2)}...${value.slice(-chars)}`;
};

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
  // EmailRecoveryManager enforces expiry - delay >= MINIMUM_RECOVERY_WINDOW
  // (= 2 days = 2880 minutes). Defaults give a 49-hour window above the floor.
  const [delayMinutes, setDelayMinutes] = useState("60");
  const [expiryMinutes, setExpiryMinutes] = useState("2940");
  const [securityMode, setSecurityMode] =
    useState<EmailRecoverySecurityMode>("none");
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
  const parsedDelayMinutes = useMemo(
    () => Math.max(parseInt(delayMinutes, 10) || 0, 0),
    [delayMinutes],
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
          setModuleError(
            error instanceof Error
              ? error.message
              : "Failed to read module status",
          );
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
        setDelayMinutes(
          String(Math.max(Math.floor(metadata.config.delaySeconds / 60), 1)),
        );
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
        setMetadataWarning(
          error instanceof Error
            ? error.message
            : "Failed to load recovery metadata from backend.",
        );
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
      setMetadataWarning(
        "Backend says installed, but on-chain check says not installed. Verify again.",
      );
      return;
    }
    if (backendStatus !== "installed" && moduleInstalledState) {
      setMetadataWarning(
        "On-chain module is active but backend status needs sync.",
      );
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
        throw new Error("Could not derive the new guardian's on-chain address.");
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
        securityMode,
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
          `${email} added on-chain. Acceptance invite sent — they should check their inbox (and spam).`,
        );
      } else {
        Alert.alert(
          "Guardian Added (invite send failed)",
          `${email} is registered on-chain (row ${rowId.slice(0, 8)}…), but the acceptance email did not queue:\n${result.errors[0] ?? "unknown error"}\n\nUse the ↻ button on the row to retry.`,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not add guardian.";
      setModuleError(msg);
      Alert.alert("Add Failed", msg);
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
            "Invite Re-sent",
            `New acceptance email queued for ${maskedEmail}. Check your inbox (and spam).`,
          );
        } else {
          const relayerMsg = result.errors[0] ?? "(no upstream error returned)";
          const isAccountCodeDupe = /account code already used/i.test(relayerMsg);
          const hint = isAccountCodeDupe
            ? "\n\nprove.email already has a request open with this guardian's accountCode. To force a new one, tap the trash icon to remove the guardian, then add them back — that mints a fresh accountCode and starts a clean invite."
            : "";
          Alert.alert(
            "Resend Failed",
            `Relayer error:\n${relayerMsg}${hint}`,
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Could not resend invite.";
        setModuleError(msg);
        Alert.alert("Resend Failed", msg);
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
        const msg = err instanceof Error ? err.message : "Failed to remove guardian.";
        setModuleError(msg);
        Alert.alert("Remove Failed", msg);
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
          ? `${guardianMaskedEmail} is needed to meet your threshold of ${threshold}. Removing them means you cannot trigger an email recovery until you add another guardian. Continue?`
          : `Remove ${guardianMaskedEmail} from your guardian set? This submits an on-chain transaction.`,
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
        securityMode,
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
    if (!smartAccountReady || !smartAccountAddress) {
      Alert.alert(
        "Smart Account Required",
        "Deploy your smart account before installing email recovery.",
      );
      return;
    }
    if (!user?.id) {
      Alert.alert(
        "Authentication Required",
        "Please sign in to install the email recovery module.",
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
        securityMode,
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

      // Nudge the user to back up their Recovery Kit when extra-security mode
      // is on. After a guardian recovery to a new device, the new device's
      // SecureStore will not have the vault key — without the printed/saved
      // Recovery Kit, guardian emails (and accountCodes) appear locked. See
      // CONTEXT.md guidance on Email Recovery + vault key UX.
      if (securityMode === "extra") {
        Alert.alert(
          "Email Recovery Activated",
          "Acceptance emails will be sent to your guardians. Before continuing, back up your Recovery Kit — without it, after a guardian recovery you'd have to re-enter guardian emails manually.",
          [
            {
              text: "Back up later",
              style: "cancel",
            },
            {
              text: "Open Recovery Kit",
              onPress: () => void handleExportRecoveryKit(),
            },
          ],
        );
      } else {
        Alert.alert(
          "Email Recovery Activated",
          "The module is installing on-chain. Acceptance emails will be sent to your guardians shortly — they need to reply to confirm.",
        );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to install the email recovery module.";
      setModuleError(message);
      Alert.alert("Installation Failed", message);
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
    securityMode,
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
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Saved Recovery Metadata</Text>
          <Text style={styles.cardDesc}>
            Offchain metadata is persisted per wallet. Chain behavior remains
            unchanged.
          </Text>
          {loadingStoredMetadata ? (
            <View style={{ gap: 12 }}>
              <Skeleton width="100%" height={60} borderRadius={16} />
              <Skeleton width="100%" height={60} borderRadius={16} />
              <Skeleton width="100%" height={60} borderRadius={16} />
            </View>
          ) : storedMetadata ? (
            <>
              <View style={styles.payloadRow}>
                <Text style={styles.payloadLabel}>Threshold</Text>
                <Text style={styles.payloadValue}>
                  {storedMetadata.config.threshold}
                </Text>
              </View>
              <View style={styles.payloadRow}>
                <Text style={styles.payloadLabel}>Delay / Expiry (min)</Text>
                <Text style={styles.payloadValue}>
                  {Math.floor(storedMetadata.config.delaySeconds / 60)} /{" "}
                  {Math.floor(storedMetadata.config.expirySeconds / 60)}
                </Text>
              </View>
              <View style={styles.payloadRow}>
                <Text style={styles.payloadLabel}>Security mode</Text>
                <Text style={styles.payloadValue}>
                  {storedMetadata.config.securityMode === "extra"
                    ? "Extra (encrypted)"
                    : "Standard"}
                </Text>
              </View>
              <Text style={styles.payloadSubLabel}>Masked Guardian Emails</Text>
              {storedMetadata.guardians.map((guardian) => (
                <View key={guardian.emailHash} style={styles.payloadRow}>
                  <Text style={styles.payloadLabel}>
                    {guardian.resolvedEmail ?? guardian.maskedEmail}
                    {guardian.isLocked ? " (locked)" : ""}
                  </Text>
                  <Text style={styles.payloadValue}>
                    weight {guardian.weight}
                  </Text>
                </View>
              ))}
              <Text style={styles.payloadSubLabel}>
                Current Chain Install Status
              </Text>
              <Text style={styles.payloadValue}>
                {storedMetadata.installations.find(
                  (i) => i.chainId === Number(resolvedChainId),
                )?.installStatus ?? "not_installed"}
              </Text>
              {storedMetadata.installations.find(
                (i) => i.chainId === Number(resolvedChainId),
              )?.installStatus !== "installed" && (
                <Text style={styles.moduleHint}>
                  Recovery not active on this chain. Install the module to
                  activate it.
                </Text>
              )}
            </>
          ) : (
            <EmptyState
              icon="shield"
              title="No Guardians Found"
              description="Your wallet is currently unprotected by social recovery. Adding guardians ensures you can recover access if you lose your device."
              actionLabel="Add your first guardian"
              onAction={() => {
                // Focus the guardian email input
                setGuardianCountValue("1");
              }}
              style={{ marginTop: 10 }}
            />
          )}
          {metadataWarning ? (
            <Text style={styles.moduleError}>{metadataWarning}</Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Privacy & Recovery Kit</Text>
          <Text style={styles.cardDesc}>
            Standard mode stores masked guardian emails for easier recovery.
            Extra mode encrypts guardian emails and requires your vault key on
            each device.
          </Text>

          <View style={styles.inputRow}>
            <TouchableOpacity
              style={[
                styles.modeButton,
                securityMode === "none" ? styles.modeButtonActive : undefined,
              ]}
              onPress={() => setSecurityMode("none")}
              activeOpacity={0.85}
            >
              <Text style={styles.modeButtonText}>Standard</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modeButton,
                securityMode === "extra" ? styles.modeButtonActive : undefined,
              ]}
              onPress={() => setSecurityMode("extra")}
              activeOpacity={0.85}
            >
              <Text style={styles.modeButtonText}>Extra Security</Text>
            </TouchableOpacity>
          </View>

          {securityMode === "extra" ? (
            <>
              <Text style={styles.moduleHint}>
                Vault key on this device:{" "}
                {hasVaultKey ? "Available" : "Not imported"}
              </Text>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleExportRecoveryKit}
                activeOpacity={0.85}
                disabled={!smartAccountAddress}
              >
                <Text style={styles.secondaryButtonText}>
                  Export Recovery Kit (QR)
                </Text>
              </TouchableOpacity>

              <TextInput
                style={styles.textInput}
                value={vaultKeyInput}
                onChangeText={setVaultKeyInput}
                placeholder="Paste vault key (Base64)"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleImportVaultKey}
                activeOpacity={0.85}
                disabled={!smartAccountAddress}
              >
                <Text style={styles.secondaryButtonText}>Import Vault Key</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={styles.moduleHint}>
              Recovery key export/import is only required in Extra Security
              mode.
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Guardian Configuration</Text>
          <Text style={styles.cardDesc}>
            Enter guardian email addresses and weights. The app
            deterministically derives the on-chain EmailAuth guardian contracts
            from these emails before installing the module.
          </Text>

          <View style={styles.inputRow}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Total Guardians</Text>
              <TextInput
                style={styles.numberInput}
                value={guardianCountValue}
                onChangeText={handleGuardianCountChange}
                keyboardType="number-pad"
                placeholderTextColor={colors.textMuted}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Threshold</Text>
              <TextInput
                style={styles.numberInput}
                value={thresholdValue}
                onChangeText={setThresholdValue}
                keyboardType="number-pad"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryText}>
              Total weight: {totalGuardianWeight}
            </Text>
            {hasDuplicateGuardians && (
              <Text style={[styles.summaryText, styles.summaryWarning]}>
                Duplicate emails detected
              </Text>
            )}
          </View>
          {guardianValidationError ? (
            <View style={styles.validationBox}>
              <Text style={styles.validationText}>{guardianValidationError}</Text>
            </View>
          ) : null}

          {visibleGuardianEmails.map((email, index) => (
            <View key={`guardian-${index}`} style={styles.guardianRowContainer}>
              <View style={styles.guardianRow}>
                <View style={styles.guardianColumn}>
                  <Text style={styles.inputLabel}>
                    Guardian {index + 1} Email
                  </Text>
                  <TextInput
                    style={styles.textInput}
                    value={email}
                    onChangeText={(value) =>
                      handleGuardianEmailChange(index, value)
                    }
                    placeholder="guardian@example.com"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    keyboardType="email-address"
                    textContentType="emailAddress"
                  />
                </View>
                <View style={styles.weightColumn}>
                  <Text style={styles.inputLabel}>Weight</Text>
                  <TextInput
                    style={styles.numberInput}
                    value={visibleGuardianWeights[index] ?? "1"}
                    onChangeText={(value) => handleWeightChange(index, value)}
                    keyboardType="number-pad"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>

              {/* Optional Delete Button */}
              {visibleGuardianEmails.length > 1 && (
                <TouchableOpacity
                  style={styles.deleteGuardianButton}
                  onPress={() => handleDeleteGuardian(index)}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove guardian ${index + 1}`}
                >
                  <Feather
                    name="trash-2"
                    size={20}
                    color={theme.colors.danger}
                  />
                </TouchableOpacity>
              )}
            </View>
          ))}
          {derivedGuardians.length > 0 && (
            <View style={styles.payloadBox}>
              <Text style={styles.payloadTitle}>
                Derived Guardian Contracts
              </Text>
              {derivedGuardians.map(({ email, guardianAddress }) => (
                <View key={email} style={styles.payloadRow}>
                  <Text style={styles.payloadLabel}>{email}</Text>
                  <Text style={styles.payloadValue}>
                    {shortenHex(guardianAddress)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recovery Timing</Text>
          <Text style={styles.cardDesc}>
            Delay and expiry are expressed in minutes (testing mode). Recovery
            can be executed after the delay and before the expiry.
          </Text>
          <View style={styles.inputRow}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Delay (minutes)</Text>
              <TextInput
                style={styles.numberInput}
                value={delayMinutes}
                onChangeText={setDelayMinutes}
                keyboardType="number-pad"
                placeholderTextColor={colors.textMuted}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Expiry (minutes)</Text>
              <TextInput
                style={styles.numberInput}
                value={expiryMinutes}
                onChangeText={setExpiryMinutes}
                keyboardType="number-pad"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>
        </View>

        <View style={styles.moduleCard}>
          <View style={styles.moduleHeader}>
            <Text style={styles.cardTitle}>Email Recovery Module</Text>
            <TouchableOpacity
              onPress={handleRefreshModuleStatus}
              style={styles.refreshButton}
              disabled={!smartAccountReady || checkingModule}
            >
              {checkingModule ? (
                <ActivityIndicator size="small" color={colors.accentAlt} />
              ) : (
                <Feather
                  name="refresh-ccw"
                  size={16}
                  color={
                    smartAccountReady ? colors.accentAlt : colors.textMuted
                  }
                />
              )}
            </TouchableOpacity>
          </View>
          <Text style={styles.cardDesc}>
            Install the on-chain email recovery module so guardians can approve
            recovery emails.
          </Text>
          <View
            style={[
              styles.moduleStatusBadge,
              moduleInstalledState
                ? styles.moduleStatusInstalled
                : styles.moduleStatusIdle,
              !smartAccountReady && styles.moduleStatusWarning,
            ]}
          >
            <Feather
              name={
                !smartAccountReady
                  ? "alert-circle"
                  : moduleInstalledState
                    ? "check-circle"
                    : "shield-off"
              }
              size={16}
              color={
                !smartAccountReady
                  ? colors.warning
                  : moduleInstalledState
                    ? colors.success
                    : colors.accentAlt
              }
            />
            <Text style={styles.moduleStatusText}>
              {!smartAccountReady
                ? "Deploy smart account to enable recovery"
                : checkingModule
                  ? "Checking module status..."
                  : moduleInstalledState
                    ? "Module installed"
                    : "Module not installed"}
            </Text>
          </View>
          {moduleError && <Text style={styles.moduleError}>{moduleError}</Text>}
          {!smartAccountReady && (
            <Text style={styles.moduleHint}>
              Deploy your smart account first. Module installation requires an
              on-chain contract.
            </Text>
          )}
          {smartAccountReady && !guardiansReady && (
            <Text style={styles.moduleHint}>
              Add guardians and weights before installing.
            </Text>
          )}
          {guardianValidationError ? (
            <Text style={styles.moduleError}>{guardianValidationError}</Text>
          ) : null}
          {lastUserOpHash && (
            <View style={styles.hashRow}>
              <Text style={styles.hashLabel}>UserOp Hash</Text>
              <Text style={styles.hashValue}>{lastUserOpHash}</Text>
            </View>
          )}
          {lastOperationHash && (
            <View style={styles.hashRow}>
              <Text style={styles.hashLabel}>Bundler Operation Hash</Text>
              <Text style={styles.hashValue}>{lastOperationHash}</Text>
            </View>
          )}
          {lastInstallPayload && (
            <View style={styles.payloadBox}>
              <Text style={styles.payloadTitle}>Latest Module Payload</Text>
              <View style={styles.payloadRow}>
                <Text style={styles.payloadLabel}>Sender</Text>
                <Text style={styles.payloadValue}>
                  {shortenHex(lastInstallPayload.sender)}
                </Text>
              </View>
              <View style={styles.payloadRow}>
                <Text style={styles.payloadLabel}>Nonce</Text>
                <Text style={styles.payloadValue}>
                  {String(lastInstallPayload.nonce)}
                </Text>
              </View>
              <View style={styles.payloadRow}>
                <Text style={styles.payloadLabel}>Paymaster</Text>
                <Text style={styles.payloadValue}>
                  {lastInstallPayload.paymaster
                    ? shortenHex(lastInstallPayload.paymaster)
                    : "Not Sponsored"}
                </Text>
              </View>
              <Text style={styles.payloadSubLabel}>Call Data</Text>
              <Text style={styles.payloadCode}>
                {shortenHex(lastInstallPayload.callData, 16)}
              </Text>
              <Text style={styles.payloadSubLabel}>Signature</Text>
              <Text style={styles.payloadCode}>
                {shortenHex(lastInstallPayload.signature, 20)}
              </Text>
            </View>
          )}
          <TouchableOpacity
            style={[
              styles.installButton,
              (!smartAccountReady ||
                !canSubmitGuardianConfig ||
                moduleInstalledState ||
                installingModule) &&
                styles.installButtonDisabled,
            ]}
            disabled={
              !smartAccountReady ||
              !canSubmitGuardianConfig ||
              moduleInstalledState ||
              installingModule
            }
            onPress={handleInstallModule}
            activeOpacity={0.85}
          >
            {installingModule ? (
              <ActivityIndicator size="small" color={colors.textOnAccent} />
            ) : (
              <Text style={styles.installButtonText}>
                {moduleInstalledState
                  ? "Module Installed"
                  : "Install Email Recovery"}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.installButton,
              styles.syncButton,
              (!smartAccountReady || !canSubmitGuardianConfig || installingModule) &&
                styles.installButtonDisabled,
            ]}
            disabled={!smartAccountReady || !canSubmitGuardianConfig || installingModule}
            onPress={handleSaveToCloud}
            activeOpacity={0.85}
          >
            {installingModule ? (
              <ActivityIndicator size="small" color={colors.textOnAccent} />
            ) : (
              <Text style={styles.installButtonText}>
                Save / Sync Cloud Metadata
              </Text>
            )}
          </TouchableOpacity>

          {moduleInstalledState
            && smartAccountReady
            && securityMode === "extra"
            && recoveryKitAcked === false ? (
            <View style={styles.recoveryKitBanner}>
              <View style={styles.recoveryKitBannerHeader}>
                <Feather name="alert-triangle" size={20} color={colors.warning} />
                <Text style={styles.recoveryKitBannerTitle}>
                  Back up your Recovery Kit
                </Text>
              </View>
              <Text style={styles.recoveryKitBannerBody}>
                Email recovery is active on this device. If you ever recover to a new
                device, you'll need this kit to read your guardian emails — without it
                they appear locked.
              </Text>
              <View style={styles.recoveryKitBannerActions}>
                <TouchableOpacity
                  style={styles.recoveryKitBannerPrimary}
                  onPress={() => void handleExportRecoveryKit()}
                  activeOpacity={0.85}
                >
                  <Text style={styles.recoveryKitBannerPrimaryText}>Back Up Now</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.recoveryKitBannerSecondary}
                  onPress={() => void handleAcknowledgeRecoveryKit()}
                  activeOpacity={0.85}
                >
                  <Text style={styles.recoveryKitBannerSecondaryText}>
                    I've backed it up
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {moduleInstalledState && smartAccountReady && (
            <View style={styles.guardianAcceptanceSection}>
              <Text style={styles.cardTitle}>Guardian Approval Status</Text>
              <Text style={styles.cardDesc}>
                Each guardian must accept their role through the ZK Email verification flow before recovery is possible. On Anvil, run `make mock-accept-guardians-local` to simulate acceptance.
              </Text>
              {storedMetadata ? (
                <>
                  {storedMetadata.guardians.map((guardian) => (
                    <View key={guardian.emailHash} style={styles.guardianStatusRow}>
                      <View style={styles.guardianInfo}>
                        <Text style={styles.guardianEmailText}>
                          {guardian.resolvedEmail ?? guardian.maskedEmail}
                          {guardian.isLocked ? " (locked)" : ""}
                        </Text>
                        <Text style={styles.guardianWeightText}>weight {guardian.weight}</Text>
                      </View>
                      <View style={[
                        styles.acceptanceBadge,
                        guardian.acceptanceStatus === "accepted"
                          ? styles.acceptanceBadgeAccepted
                          : styles.acceptanceBadgePending,
                      ]}>
                        <Text style={[
                          styles.acceptanceBadgeText,
                          guardian.acceptanceStatus === "accepted"
                            ? styles.acceptanceBadgeTextAccepted
                            : styles.acceptanceBadgeTextPending,
                        ]}>
                          {guardian.acceptanceStatus === "accepted" ? "Accepted" : "Awaiting Approval"}
                        </Text>
                      </View>
                      {guardian.acceptanceStatus !== "accepted" && !guardian.isLocked && (
                        <TouchableOpacity
                          style={styles.removeGuardianButton}
                          onPress={() =>
                            void handleResendGuardianInvite(
                              guardian.id,
                              guardian.maskedEmail,
                            )
                          }
                          disabled={resendingGuardianId === guardian.id}
                          accessibilityLabel={`Resend invite to ${guardian.maskedEmail}`}
                        >
                          {resendingGuardianId === guardian.id ? (
                            <ActivityIndicator size="small" color={theme.colors.accentAlt} />
                          ) : (
                            <Feather name="refresh-cw" size={18} color={theme.colors.accentAlt} />
                          )}
                        </TouchableOpacity>
                      )}
                      {!guardian.isLocked && (
                        <TouchableOpacity
                          style={styles.removeGuardianButton}
                          onPress={() =>
                            confirmRemoveInstalledGuardian(
                              guardian.id,
                              guardian.maskedEmail,
                              guardian.normalizedEmailEncrypted,
                            )
                          }
                          disabled={removingGuardianId === guardian.id}
                          accessibilityLabel={`Remove guardian ${guardian.maskedEmail}`}
                        >
                          {removingGuardianId === guardian.id ? (
                            <ActivityIndicator size="small" color={theme.colors.danger} />
                          ) : (
                            <Feather name="trash-2" size={18} color={theme.colors.danger} />
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                  <View style={styles.acceptanceSummaryRow}>
                    <Text style={styles.acceptanceSummaryText}>
                      {storedMetadata.guardians.filter((g) => g.acceptanceStatus === "accepted").length}/{storedMetadata.guardians.length} accepted
                      ({storedMetadata.config.threshold} needed)
                    </Text>
                  </View>

                  <View style={styles.addPostInstallSection}>
                    <Text style={styles.addPostInstallTitle}>Add another guardian</Text>
                    <Text style={styles.cardDesc}>
                      Submits an on-chain addGuardian and fires a fresh acceptance invite.
                      Useful when threshold blocks removal of an existing guardian.
                    </Text>
                    <TextInput
                      style={styles.addPostInstallInput}
                      value={newPostInstallEmail}
                      onChangeText={setNewPostInstallEmail}
                      placeholder="guardian@example.com"
                      placeholderTextColor={theme.colors.textMuted}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!addingPostInstallGuardian}
                    />
                    <TextInput
                      style={styles.addPostInstallInput}
                      value={newPostInstallWeight}
                      onChangeText={setNewPostInstallWeight}
                      placeholder="weight (default 1)"
                      placeholderTextColor={theme.colors.textMuted}
                      keyboardType="number-pad"
                      editable={!addingPostInstallGuardian}
                    />
                    <TouchableOpacity
                      style={[styles.installButton, styles.startRecoveryButton]}
                      onPress={() => void handleAddPostInstallGuardian()}
                      disabled={addingPostInstallGuardian || !newPostInstallEmail.trim()}
                      activeOpacity={0.85}
                    >
                      {addingPostInstallGuardian ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.installButtonText}>Add Guardian</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <Text style={styles.cardDesc}>Loading guardian status...</Text>
              )}
              {/* ADR-0011: same-device "Start Email Recovery" is testing-only.
                  Production entry is from the new-device unauthenticated screen (v2). */}
              {__DEV__ && (
                <TouchableOpacity
                  style={[styles.installButton, styles.startRecoveryButton]}
                  onPress={() => navigation.navigate("EmailRecoveryStart")}
                  activeOpacity={0.85}
                >
                  <Text style={styles.installButtonText}>
                    Start Email Recovery
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
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
      paddingBottom: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderMuted,
    },
    headerTitle: {
      color: colors.textPrimary,
      fontSize: 20,
      fontWeight: "700",
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 20,
      paddingBottom: 40,
      gap: 16,
    },
    summaryRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    summaryText: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: "500",
    },
    summaryWarning: {
      color: colors.warning,
    },
    validationBox: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: `${colors.warning}47`,
      backgroundColor: `${colors.warning}1F`,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    validationText: {
      color: colors.warning,
      fontSize: 12,
      lineHeight: 18,
      fontWeight: "600",
    },
    card: {
      backgroundColor: colors.surfaceCard,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 20,
      gap: 16,
    },
    moduleCard: {
      backgroundColor: colors.surfaceCard,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 20,
      gap: 16,
    },
    cardTitle: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: "700",
    },
    cardDesc: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 18,
    },
    inputRow: {
      flexDirection: "row",
      gap: 16,
    },
    inputGroup: {
      flex: 1,
      gap: 8,
    },
    inputLabel: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: "600",
    },
    modeButton: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: "center",
      backgroundColor: `${colors.textPrimary}0A`,
    },
    modeButtonActive: {
      borderColor: colors.accentAlt,
      backgroundColor: `${colors.accentAlt}24`,
    },
    modeButtonText: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: "700",
    },
    numberInput: {
      backgroundColor: `${colors.textPrimary}0F`,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: "600",
      textAlign: "center",
    },
    textInput: {
      backgroundColor: `${colors.textPrimary}0F`,
      borderWidth: 1,
      borderColor: colors.borderMuted,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: colors.textPrimary,
      fontSize: 15,
    },
    guardianRowContainer: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 12,
    },
    guardianRow: {
      flex: 1,
      flexDirection: "row",
      gap: 12,
      alignItems: "flex-end",
    },
    deleteGuardianButton: {
      height: 52,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 8,
    },
    guardianColumn: {
      flex: 1,
      gap: 8,
    },
    weightColumn: {
      width: 100,
      gap: 8,
    },
    moduleHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    refreshButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: `${colors.accentAlt}1A`,
    },
    moduleStatusBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
    },
    moduleStatusIdle: {
      backgroundColor: `${colors.accentAlt}1A`,
      borderWidth: 1,
      borderColor: `${colors.accentAlt}33`,
    },
    moduleStatusInstalled: {
      backgroundColor: `${colors.success}1F`,
      borderWidth: 1,
      borderColor: `${colors.success}33`,
    },
    moduleStatusWarning: {
      backgroundColor: `${colors.warning}1F`,
      borderWidth: 1,
      borderColor: `${colors.warning}33`,
    },
    moduleStatusText: {
      color: colors.textSecondary,
      fontSize: 13,
      flex: 1,
    },
    moduleError: {
      color: colors.danger,
      fontSize: 12,
    },
    moduleHint: {
      color: colors.textMuted,
      fontSize: 12,
    },
    hashRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 12,
    },
    hashLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "600",
    },
    hashValue: {
      color: colors.textSecondary,
      fontSize: 12,
      flex: 1,
      textAlign: "right",
    },
    payloadBox: {
      backgroundColor: `${colors.textPrimary}0A`,
      borderRadius: 12,
      padding: 12,
      gap: 8,
    },
    payloadTitle: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "700",
    },
    payloadRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 8,
    },
    payloadLabel: {
      color: colors.textMuted,
      fontSize: 12,
    },
    payloadValue: {
      color: colors.textSecondary,
      fontSize: 12,
    },
    payloadSubLabel: {
      color: colors.textMuted,
      fontSize: 11,
      marginTop: 4,
    },
    payloadCode: {
      color: colors.textSecondary,
      fontSize: 11,
      fontFamily: "monospace",
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
    installButton: {
      backgroundColor: colors.accentAlt,
      borderRadius: 16,
      paddingVertical: 14,
      alignItems: "center",
    },
    installButtonDisabled: {
      opacity: 0.6,
    },
    installButtonText: {
      color: colors.textOnAccent,
      fontSize: 15,
      fontWeight: "700",
    },
    syncButton: {
      marginTop: 12,
    },
    startRecoveryButton: {
      marginTop: 12,
      backgroundColor: colors.success,
    },
    addPostInstallSection: {
      marginTop: 18,
      paddingTop: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderMuted,
      gap: 8,
    },
    addPostInstallTitle: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "600",
      marginBottom: 4,
    },
    addPostInstallInput: {
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.textPrimary,
      fontSize: 14,
    },
    guardianAcceptanceSection: {
      backgroundColor: colors.surfaceCard,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 20,
      gap: 12,
    },
    recoveryKitBanner: {
      backgroundColor: `${colors.warning}1A`,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: `${colors.warning}66`,
      padding: 16,
      gap: 10,
    },
    recoveryKitBannerHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    recoveryKitBannerTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    recoveryKitBannerBody: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.textSecondary,
    },
    recoveryKitBannerActions: {
      flexDirection: "row",
      gap: 10,
      marginTop: 4,
    },
    recoveryKitBannerPrimary: {
      flex: 1,
      backgroundColor: colors.warning,
      borderRadius: 12,
      paddingVertical: 10,
      alignItems: "center",
    },
    recoveryKitBannerPrimaryText: {
      color: colors.textOnAccent,
      fontWeight: "700",
      fontSize: 13,
    },
    recoveryKitBannerSecondary: {
      flex: 1,
      borderRadius: 12,
      paddingVertical: 10,
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    recoveryKitBannerSecondaryText: {
      color: colors.textPrimary,
      fontWeight: "600",
      fontSize: 13,
    },
    guardianStatusRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 8,
      gap: 12,
    },
    guardianInfo: {
      flex: 1,
    },
    guardianEmailText: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "600",
    },
    guardianWeightText: {
      color: colors.textMuted,
      fontSize: 12,
    },
    acceptanceBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
    },
    removeGuardianButton: {
      marginLeft: 8,
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 16,
      backgroundColor: `${colors.danger}12`,
    },
    acceptanceBadgeAccepted: {
      backgroundColor: `${colors.success}1F`,
    },
    acceptanceBadgePending: {
      backgroundColor: `${colors.warning}1F`,
    },
    acceptanceBadgeText: {
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    acceptanceBadgeTextAccepted: {
      color: colors.success,
    },
    acceptanceBadgeTextPending: {
      color: colors.warning,
    },
    acceptanceSummaryRow: {
      paddingTop: 4,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    acceptanceSummaryText: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: "600",
    },
  });

export default EmailRecoveryScreen;
