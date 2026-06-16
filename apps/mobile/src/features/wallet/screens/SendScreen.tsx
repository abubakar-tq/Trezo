import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useAppTheme } from "@theme";

import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatUnits, parseEther, parseUnits, type Address } from "viem";

import { BalanceService } from "@/src/features/assets/services/BalanceService";
import { TokenRegistryService } from "@/src/features/assets/services/TokenRegistryService";
import type { TokenMetadata } from "@/src/features/assets/types/token";
import { ContactService, type Contact } from "@/src/features/contacts";
import { SendPreparationService } from "@/src/features/send/services/SendPreparationService";
import { SendValidationService } from "@/src/features/send/services/SendValidationService";
import { buildSendPreview } from "@/src/features/send/services/buildSendPreview";
import type { SendIntent } from "@/src/features/send/types/send";
import { TransactionHistoryService } from "@/src/features/transactions/services/TransactionHistoryService";
import { TransactionReceiptTracker } from "@/src/features/transactions/services/TransactionReceiptTracker";
import { TransactionConfirmSheet } from "@/src/features/transactions/components/TransactionConfirmSheet";
import { useTransactionConfirmation } from "@/src/features/transactions/hooks/useTransactionConfirmation";
import { SmartAccountExecutionService } from "@/src/features/wallet/services/SmartAccountExecutionService";
import WalletPersistenceService from "@/src/features/wallet/services/SupabaseWalletService";
import { devFundSmartAccount } from "@/src/features/wallet/services/devFunding";
import { useWalletStore } from "@/src/features/wallet/store/useWalletStore";
import {
  DEFAULT_CHAIN_ID,
  SUPPORTED_CHAIN_IDS,
  getChainConfig,
  type SupportedChainId,
} from "@/src/integration/chains";
import { getNetworkConfig, resolveNetworkKey } from "@/src/integration/networks";
import { useUserStore } from "@/src/store/useUserStore";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SendScreenProps {
  onCancel?: () => void;
}

type FlowStep =
  | "token"
  | "amount"
  | "recipient"
  | "submitting"
  | "result";

type FinalState = "confirmed" | "pending" | "failed" | "cancelled" | null;

type ContactCandidate = {
  id: string;
  name: string;
  address: string;
  label: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const shorten = (value?: string | null, head = 6, tail = 4): string => {
  if (!value) return "–";
  if (value.length <= head + tail) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
};

const resolveCandidate = (
  contact: Contact,
  chainId: SupportedChainId,
): ContactCandidate | null => {
  const exact = contact.addresses.find((a) => a.chain_id === chainId);
  const fallback = exact ?? contact.addresses[0];
  if (!fallback?.address) return null;
  return {
    id: contact.id,
    name: contact.name,
    address: fallback.address,
    label: fallback.label || `Chain ${fallback.chain_id}`,
  };
};

// Chain emoji/badge characters (simple fallback)
const CHAIN_EMOJI: Record<number, string> = {
  31337: "⬡",
  11155111: "Ξ",
  84532: "🔵",
  421614: "🔷",
  1: "Ξ",
  324: "⧫",
  300: "⧫",
};

// ─── Component ───────────────────────────────────────────────────────────────

export const SendScreen: React.FC<SendScreenProps> = ({ onCancel }) => {
  const { theme } = useAppTheme();
  const { colors } = theme;
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  // ── Wallet state ──────────────────────────────────────────────────────────
  const user = useUserStore((s) => s.user);
  const aaAccount = useWalletStore((s) => s.aaAccount);
  const activeChainId = useWalletStore((s) => s.activeChainId);

  const fallbackChainId = (
    aaAccount?.chainId ?? activeChainId ?? DEFAULT_CHAIN_ID
  ) as SupportedChainId;

  const [selectedChainId, setSelectedChainId] =
    useState<SupportedChainId>(fallbackChainId);
  const [selectedToken, setSelectedToken] = useState<TokenMetadata | null>(
    null,
  );
  const [amountDecimal, setAmountDecimal] = useState("");
  const [recipient, setRecipient] = useState("");

  const [walletId, setWalletId] = useState<string | null>(
    aaAccount?.id ?? null,
  );
  const [walletAddress, setWalletAddress] = useState<Address | null>(
    (aaAccount?.predictedAddress as Address | undefined) ?? null,
  );
  const [walletDeployed, setWalletDeployed] = useState<boolean>(
    Boolean(aaAccount?.isDeployed),
  );

  // ── Token balances ────────────────────────────────────────────────────────
  const [tokenBalances, setTokenBalances] = useState<Record<string, bigint>>(
    {},
  );
  const [balancesLoading, setBalancesLoading] = useState(false);

  // ── Contacts ──────────────────────────────────────────────────────────────
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [recipientSearch, setRecipientSearch] = useState("");

  // ── Flow ──────────────────────────────────────────────────────────────────
  const [step, setStep] = useState<FlowStep>("token");
  const [finalState, setFinalState] = useState<FinalState>(null);

  // ── Pickers ───────────────────────────────────────────────────────────────
  const [networkPickerOpen, setNetworkPickerOpen] = useState(false);

  // ── Tx data ───────────────────────────────────────────────────────────────
  const [userOpHash, setUserOpHash] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  // ── Messages ──────────────────────────────────────────────────────────────
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [autoFunding, setAutoFunding] = useState(false);

  // ── Services / Refs ───────────────────────────────────────────────────────
  const walletService = useMemo(() => new WalletPersistenceService(), []);
  const autoFundedRef = useRef<Set<string>>(new Set());

  // ── Confirm sheet (unified pre-broadcast review) ──────────────────────────
  const tc = useTransactionConfirmation();

  // ── Derived ───────────────────────────────────────────────────────────────
  const chainOptions = useMemo(
    () => SUPPORTED_CHAIN_IDS.map((id) => getChainConfig(id)),
    [],
  );
  const selectedChain = getChainConfig(selectedChainId);
  const networkConfig = useMemo(() => {
    try { return getNetworkConfig(resolveNetworkKey(selectedChainId)); } catch { return null; }
  }, [selectedChainId]);
  // Use the network-key-aware token list so builtin ERC20s registered via
  // BUILTIN_TOKENS_BY_NETWORK (e.g. Base Sepolia USDC/WETH/LINK) are included.
  // The legacy chain-id list only returns native + deployment-manifest tokens,
  // so on testnets whose manifest has no `usdc` (Base Sepolia) it collapsed to
  // ETH only. Mirrors TokenDiscoveryProvider's defaultTokenLister.
  const tokenOptions = useMemo(() => {
    try {
      return TokenRegistryService.listTokensForNetwork(
        resolveNetworkKey(selectedChainId),
      );
    } catch {
      return TokenRegistryService.listTokens(selectedChainId);
    }
  }, [selectedChainId]);

  const contactCandidates = useMemo(() => {
    const base = contacts
      .map((c) => resolveCandidate(c, selectedChainId))
      .filter((c): c is ContactCandidate => Boolean(c));
    const q = recipientSearch.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q),
    );
  }, [contacts, selectedChainId, recipientSearch]);

  const tokenKey =
    selectedToken?.address === "native"
      ? "native"
      : selectedToken?.address?.toLowerCase();
  const selectedTokenBalanceRaw = tokenKey
    ? (tokenBalances[tokenKey] ?? 0n)
    : 0n;
  const selectedTokenBalanceDisplay = selectedToken
    ? formatUnits(selectedTokenBalanceRaw, selectedToken.decimals)
    : "0";

  const selectedAmountRaw = useMemo(() => {
    if (!selectedToken || !amountDecimal.trim()) return 0n;
    try {
      return parseUnits(amountDecimal, selectedToken.decimals);
    } catch {
      return 0n;
    }
  }, [amountDecimal, selectedToken]);

  const canContinueAmount = Boolean(
    selectedAmountRaw > 0n && selectedAmountRaw <= selectedTokenBalanceRaw,
  );
  const canContinueRecipient = Boolean(recipient.trim().length > 0);

  // ── Effects ───────────────────────────────────────────────────────────────

  // Auto-select first token when chain changes
  useEffect(() => {
    if (!tokenOptions.length) {
      setSelectedToken(null);
      return;
    }
    if (
      !selectedToken ||
      !tokenOptions.some((t) => t.address === selectedToken.address)
    ) {
      setSelectedToken(tokenOptions[0]);
    }
  }, [selectedToken, tokenOptions]);

  // Load wallet for selected chain
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!user?.id) {
        setWalletId(null);
        setWalletAddress(null);
        setWalletDeployed(false);
        return;
      }
      try {
        const wallet = await walletService.getAAWalletForChain(
          user.id,
          selectedChainId,
        );
        if (cancelled) return;
        setWalletId(wallet?.id ?? null);
        setWalletAddress(
          (wallet?.predicted_address as Address | undefined) ?? null,
        );
        setWalletDeployed(Boolean(wallet?.is_deployed));
      } catch {
        // silently ignore
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [selectedChainId, user?.id, walletService]);

  // Load token balances
  const loadTokenBalances = useCallback(async () => {
    if (!walletAddress || tokenOptions.length === 0) {
      setTokenBalances({});
      return;
    }
    setBalancesLoading(true);
    try {
      const entries = await Promise.all(
        tokenOptions.map(async (token) => {
          const result = await BalanceService.getSpendableBalance({
            chainId: selectedChainId,
            walletAddress,
            token,
            feeMode: networkConfig?.defaultUsePaymaster ? "sponsored" : "wallet_paid",
          });
          const key =
            token.address === "native"
              ? "native"
              : token.address.toLowerCase();
          return [key, result.spendableRaw] as const;
        }),
      );
      setTokenBalances(Object.fromEntries(entries));
    } catch {
      setTokenBalances({});
    } finally {
      setBalancesLoading(false);
    }
  }, [selectedChainId, tokenOptions, walletAddress]);

  useEffect(() => {
    loadTokenBalances();
  }, [loadTokenBalances]);

  // Auto-fund on Anvil (local testing)
  useEffect(() => {
    let cancelled = false;
    const fund = async () => {
      if (selectedChainId !== 31337 || !walletAddress || !walletDeployed)
        return;
      const key = `${selectedChainId}:${walletAddress.toLowerCase()}`;
      if (autoFundedRef.current.has(key)) return;
      autoFundedRef.current.add(key);
      try {
        const bal = await BalanceService.getNativeBalance(31337, walletAddress);
        if (cancelled || bal >= parseEther("0.05")) return;
        setAutoFunding(true);
        await devFundSmartAccount({ address: walletAddress, chainId: 31337 });
        if (cancelled) return;
        await loadTokenBalances();
      } catch {
        // silent
      } finally {
        if (!cancelled) setAutoFunding(false);
      }
    };
    fund();
    return () => {
      cancelled = true;
    };
  }, [loadTokenBalances, selectedChainId, walletAddress, walletDeployed]);

  // Load contacts on mount
  useEffect(() => {
    const load = async () => {
      setContactsLoading(true);
      try {
        const rows = await ContactService.getContacts();
        setContacts(rows);
      } finally {
        setContactsLoading(false);
      }
    };
    load();
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────

  const selectChain = (chainId: SupportedChainId) => {
    setSelectedChainId(chainId);
    setNetworkPickerOpen(false);
    setStep("token");
    setFinalState(null);
    setAmountDecimal("");
    setRecipient("");
    setRecipientSearch("");
    setErrorMessage(null);
  };

  const handlePaste = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text) {
        setRecipient(text.trim());
        Haptics.selectionAsync();
      }
    } catch {
      // silent
    }
  };

  const handleNumpad = (key: string) => {
    Haptics.selectionAsync();
    if (key === "del") {
      setAmountDecimal((prev) => prev.slice(0, -1));
      return;
    }
    if (key === "." && amountDecimal.includes(".")) return;
    if (key === "." && amountDecimal === "") {
      setAmountDecimal("0.");
      return;
    }
    setAmountDecimal((prev) => prev + key);
  };

  const handleQuickPercent = (pct: number) => {
    if (!selectedToken || selectedTokenBalanceRaw === 0n) return;
    const raw = (selectedTokenBalanceRaw * BigInt(pct)) / 100n;
    setAmountDecimal(formatUnits(raw, selectedToken.decimals));
    Haptics.selectionAsync();
  };

  const composeIntent = (): SendIntent | null => {
    if (!user?.id || !walletId || !walletAddress || !selectedToken) return null;
    return {
      userId: user.id,
      aaWalletId: walletId,
      walletAddress,
      chainId: selectedChainId,
      token: selectedToken,
      recipient: recipient.trim(),
      amountDecimal: amountDecimal.trim(),
    };
  };

  const handleSendWithSheet = async () => {
    setErrorMessage(null);
    const intent = composeIntent();
    if (!intent || !user?.id) {
      setErrorMessage("Missing wallet or user session.");
      return;
    }

    // 1) Validate
    const validation = await SendValidationService.validate(intent, {
      feeMode: networkConfig?.defaultUsePaymaster ? "sponsored" : "wallet_paid",
    });
    if (!validation.isValid) {
      setErrorMessage(validation.errors[0]?.message ?? "Validation failed.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    // 2) Prepare the send (builds calldata / execution params)
    let preparedSend: ReturnType<typeof SendPreparationService.prepare>;
    try {
      preparedSend = SendPreparationService.prepare(intent, validation);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Preparation failed.");
      return;
    }

    // 3) Create history draft so we have a transactionId from the start
    const draft = await TransactionHistoryService.createDraft({
      userId: intent.userId,
      aaWalletId: intent.aaWalletId,
      walletAddress: intent.walletAddress,
      chainId: intent.chainId,
      type: intent.token.type === "native" ? "send_native" : "send_erc20",
      direction: "outgoing",
      tokenType: intent.token.type,
      tokenAddress: intent.token.type === "erc20" ? intent.token.address : null,
      tokenSymbol: intent.token.symbol,
      tokenDecimals: intent.token.decimals,
      fromAddress: intent.walletAddress,
      toAddress: intent.recipient as Address,
      amountDisplay: intent.amountDecimal,
      targetAddress: intent.recipient as Address,
      valueRaw: "0",
      calldata: "0x",
      metadata: intent.memo ? { memo: intent.memo } : {},
    });

    await TransactionHistoryService.markPrepared(draft.id, {
      type: intent.token.type === "native" ? "send_native" : "send_erc20",
      tokenType: intent.token.type,
      tokenAddress: intent.token.type === "erc20" ? intent.token.address : null,
      tokenSymbol: intent.token.symbol,
      tokenDecimals: intent.token.decimals,
      toAddress: preparedSend.validation.recipient,
      amountRaw: preparedSend.validation.amountRaw.toString(),
      amountDisplay: formatUnits(preparedSend.validation.amountRaw, preparedSend.intent.token.decimals),
      targetAddress: preparedSend.targetAddress,
      valueRaw: preparedSend.valueRaw.toString(),
      calldata: preparedSend.calldata,
      paymasterUsed: preparedSend.validation.feeMode === "sponsored",
      feeMode: preparedSend.validation.feeMode === "sponsored" ? "sponsored" : "wallet_native",
      metadata: preparedSend.intent.memo ? { memo: preparedSend.intent.memo } : {},
    });

    // 4) Build the preview and present the confirm sheet.
    //    The hook internally prepares the UserOp (unsigned) + simulates.
    const preview = buildSendPreview(preparedSend, selectedChain.name);
    let approved: boolean;
    let preparedUserOp: Awaited<ReturnType<typeof SmartAccountExecutionService.prepareUserOperation>> | undefined;
    try {
      const result = await tc.confirm({
        preview,
        execution: preparedSend.execution,
        userId: user.id,
        usePaymaster: preparedSend.validation.feeMode === "sponsored",
      });
      approved = result.approved;
      preparedUserOp = result.prepared;
    } catch (err) {
      await TransactionHistoryService.markFailed({
        id: draft.id,
        errorMessage: err instanceof Error ? err.message : "Confirmation failed.",
      });
      setErrorMessage(err instanceof Error ? err.message : "Transaction preparation failed.");
      return;
    }

    // 5) User rejected → cancel the draft and return quietly
    if (!approved || !preparedUserOp) {
      await TransactionHistoryService.markCancelled(draft.id, "user_rejected");
      return;
    }

    // 6) User approved → sign + submit + track receipt
    setStep("submitting");
    let didSubmit = false;
    let submittedHash: Address | undefined;

    try {
      await TransactionHistoryService.markSigning(draft.id);
      const signed = await SmartAccountExecutionService.signUserOperation(user.id, preparedUserOp);
      await TransactionHistoryService.markSigned(draft.id, {
        signatureBytes: signed.signature.length > 2 ? (signed.signature.length - 2) / 2 : 0,
        userOpHash: signed.userOpHash,
      });

      const submission = await SmartAccountExecutionService.submitUserOperation(signed);
      didSubmit = true;
      submittedHash = submission.submittedUserOpHash as Address;
      setUserOpHash(submittedHash);

      await TransactionHistoryService.markSubmitted({ id: draft.id, userOpHash: submission.submittedUserOpHash });
      await TransactionHistoryService.markPending(draft.id);

      // Track receipt (non-blocking timeout)
      const row = await TransactionHistoryService.getById(draft.id);
      if (!row) {
        setFinalState("pending");
        setStep("result");
        navigation.navigate("TransactionStatus", { transactionId: draft.id });
        return;
      }
      const tracked = await TransactionReceiptTracker.trackUserOperation({
        transactionId: row.id,
        timeoutMs: 45_000,
        pollIntervalMs: 2_000,
      });
      if (tracked.status === "confirmed") {
        setTxHash(tracked.transactionHash ?? null);
        setFinalState("confirmed");
        setStep("result");
        navigation.navigate("TransactionStatus", { transactionId: draft.id });
        return;
      }
      if (tracked.status === "failed") {
        setFinalState("failed");
        setErrorMessage(tracked.errorMessage ?? "Transaction failed after submission.");
        setStep("result");
        navigation.navigate("TransactionStatus", { transactionId: draft.id });
        return;
      }
      setFinalState("pending");
      setStep("result");
      navigation.navigate("TransactionStatus", { transactionId: draft.id });
    } catch (err) {
      const isCancel =
        err instanceof Error &&
        (err.message.toLowerCase().includes("cancel") ||
          err.message.toLowerCase().includes("aborted") ||
          err.message.toLowerCase().includes("notallowed") ||
          err.message.toLowerCase().includes("user denied"));

      if (isCancel && !didSubmit) {
        await TransactionHistoryService.markCancelled(draft.id, "passkey_prompt_cancelled");
        setFinalState("cancelled");
        setErrorMessage("Signing was cancelled.");
      } else {
        const msg = err instanceof Error ? err.message : "Transaction failed.";
        await TransactionHistoryService.markFailed({ id: draft.id, errorMessage: msg });
        setFinalState("failed");
        setErrorMessage(msg);
      }
      setUserOpHash(submittedHash ?? null);
      setStep("result");
      navigation.navigate("TransactionStatus", { transactionId: draft.id });
    }
  };

  const resetFlow = () => {
    setStep("token");
    setFinalState(null);
    setAmountDecimal("");
    setRecipient("");
    setRecipientSearch("");
    setTxHash(null);
    setUserOpHash(null);
    setErrorMessage(null);
  };

  const goBack = () => {
    if (step === "token") {
      if (onCancel) onCancel();
      else navigation.goBack();
    } else if (step === "amount") setStep("token");
    else if (step === "recipient") setStep("amount");
    else resetFlow();
  };

  const stepTitle = useMemo(() => {
    if (step === "token") return "Send";
    if (step === "amount") return "Send";
    if (step === "recipient") return "Send";
    if (step === "submitting") return "Sending…";
    return "Status";
  }, [step]);

  // ── Render ────────────────────────────────────────────────────────────────

  const accent = colors.accent;

  const numpadKeys = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    [".", "0", "del"],
  ];

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={[s.header, { paddingTop: Math.max(insets.top, 16) }]}>
        {step !== "submitting" && step !== "result" ? (
          <TouchableOpacity style={s.headerIcon} onPress={goBack}>
            <Feather name="arrow-left" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        ) : (
          <View style={s.headerIcon} />
        )}

        <Text style={[s.headerTitle, { color: colors.textPrimary }]}>
          {stepTitle}
        </Text>

        {step !== "submitting" && step !== "result" ? (
          <TouchableOpacity
            style={s.headerIcon}
            onPress={() => {
              if (onCancel) onCancel();
              else navigation.goBack();
            }}
          >
            <Feather name="x" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        ) : (
          <View style={s.headerIcon} />
        )}
      </View>

      {/* ── Network pill row (top of token/amount/recipient steps) ─────── */}
      {step !== "submitting" && step !== "result" && (
        <View style={s.networkRow}>
          <TouchableOpacity
            style={[
              s.networkPill,
              {
                backgroundColor: colors.surfaceCard,
                borderColor: colors.border,
              },
            ]}
            onPress={() => setNetworkPickerOpen((v) => !v)}
          >
            <Text style={[s.networkPillEmoji]}>
              {CHAIN_EMOJI[selectedChainId] ?? "⬡"}
            </Text>
            <Text style={[s.networkPillText, { color: colors.textPrimary }]}>
              {selectedChain.name}
            </Text>
            <Feather
              name={networkPickerOpen ? "chevron-up" : "chevron-down"}
              size={13}
              color={colors.textSecondary}
            />
          </TouchableOpacity>

          {autoFunding && (
            <View style={s.fundingPill}>
              <ActivityIndicator size="small" color={accent} />
              <Text style={[s.fundingText, { color: colors.textMuted }]}>
                Funding…
              </Text>
            </View>
          )}
        </View>
      )}

      {/* ── Network dropdown ───────────────────────────────────────────── */}
      {networkPickerOpen && (
        <View
          style={[
            s.dropdown,
            {
              backgroundColor: colors.surfaceCard,
              borderColor: colors.border,
            },
          ]}
        >
          {chainOptions.map((chain) => {
            const active = chain.id === selectedChainId;
            const disabled = !chain.isEnabled;
            return (
              <TouchableOpacity
                key={chain.id}
                style={[
                  s.dropdownRow,
                  {
                    borderBottomColor: colors.border,
                    opacity: disabled ? 0.4 : 1,
                  },
                ]}
                onPress={() => !disabled && selectChain(chain.id)}
                disabled={disabled}
              >
                <Text style={s.dropdownEmoji}>
                  {CHAIN_EMOJI[chain.id] ?? "⬡"}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={[s.dropdownName, { color: colors.textPrimary }]}>
                    {chain.name}
                  </Text>
                  <Text style={[s.dropdownSub, { color: colors.textMuted }]}>
                    {disabled ? "Unavailable" : chain.environment}
                  </Text>
                </View>
                {active && (
                  <Feather name="check" size={15} color={accent} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* ── Error banner ───────────────────────────────────────────────── */}
      {errorMessage && step !== "result" ? (
        <View
          style={[
            s.errorBanner,
            {
              backgroundColor: colors.dangerSoft,
              borderColor: `${colors.danger}4D`,
            },
          ]}
        >
          <Feather name="alert-circle" size={13} color={colors.danger} />
          <Text style={[s.errorBannerText, { color: colors.danger }]}>
            {errorMessage}
          </Text>
        </View>
      ) : null}

      {/* ════════════════════════════════════════════════════════════════
          STEP: TOKEN SELECT
         ════════════════════════════════════════════════════════════════ */}
      {step === "token" && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[
            s.body,
            { paddingBottom: insets.bottom + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[s.sectionLabel, { color: colors.textMuted }]}>
            Tokens
          </Text>

          {tokenOptions.map((token) => {
            const key =
              token.address === "native"
                ? "native"
                : token.address.toLowerCase();
            const raw = tokenBalances[key] ?? 0n;
            const balance = formatUnits(raw, token.decimals);
            const active = token.address === selectedToken?.address;

            return (
              <TouchableOpacity
                key={`${token.chainId}:${token.address}`}
                style={[
                  s.tokenRow,
                  {
                    backgroundColor: colors.surfaceCard,
                    borderColor: active
                      ? `${accent}73`
                      : colors.border,
                  },
                ]}
                onPress={() => {
                  setSelectedToken(token);
                  setStep("amount");
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                {/* Icon */}
                <View
                  style={[
                    s.tokenIconCircle,
                    {
                      backgroundColor: active
                        ? `${accent}2E`
                        : colors.surfaceCard,
                    },
                  ]}
                >
                  <Text
                    style={[
                      s.tokenIconLetter,
                      { color: active ? accent : colors.textSecondary },
                    ]}
                  >
                    {token.symbol[0]}
                  </Text>
                </View>

                {/* Name */}
                <View style={{ flex: 1 }}>
                  <Text
                    style={[s.tokenSymbol, { color: colors.textPrimary }]}
                  >
                    {token.symbol}
                  </Text>
                  <Text style={[s.tokenName, { color: colors.textMuted }]}>
                    {token.name}
                  </Text>
                </View>

                {/* Balance */}
                <View style={{ alignItems: "flex-end" }}>
                  {balancesLoading ? (
                    <ActivityIndicator size="small" color={accent} />
                  ) : (
                    <>
                      <Text
                        style={[
                          s.tokenBalance,
                          { color: colors.textPrimary },
                        ]}
                      >
                        {balance}
                      </Text>
                      <Text
                        style={[s.tokenBalanceSub, { color: colors.textMuted }]}
                      >
                        {token.symbol}
                      </Text>
                    </>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* ════════════════════════════════════════════════════════════════
          STEP: AMOUNT (numpad style like Phantom)
         ════════════════════════════════════════════════════════════════ */}
      {step === "amount" && (
        <View style={{ flex: 1 }}>
          {/* Big amount display */}
          <View style={s.amountDisplay}>
            <Text
              style={[s.amountBig, { color: colors.textPrimary }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {amountDecimal || "0"}
            </Text>
            <Text style={[s.amountSymbol, { color: colors.textSecondary }]}>
              {selectedToken?.symbol}
            </Text>
            <Text style={[s.amountAvailable, { color: colors.textMuted }]}>
              {selectedTokenBalanceDisplay} {selectedToken?.symbol} available
            </Text>
          </View>

          {/* Quick % row */}
          <View style={s.quickRow}>
            {[25, 50, 75, 100].map((pct) => (
              <TouchableOpacity
                key={pct}
                style={[
                  s.quickBtn,
                  {
                    backgroundColor: colors.surfaceCard,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => handleQuickPercent(pct)}
              >
                <Text style={[s.quickBtnText, { color: colors.textSecondary }]}>
                  {pct === 100 ? "Max" : `${pct}%`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Numpad */}
          <View
            style={[
              s.numpad,
              { paddingBottom: insets.bottom + 12 },
            ]}
          >
            {numpadKeys.map((row, ri) => (
              <View key={ri} style={s.numpadRow}>
                {row.map((key) => (
                  <TouchableOpacity
                    key={key}
                    style={[
                      s.numpadKey,
                      {
                        backgroundColor: colors.surfaceCard,
                      },
                    ]}
                    onPress={() => handleNumpad(key)}
                  >
                    {key === "del" ? (
                      <Feather
                        name="delete"
                        size={20}
                        color={colors.textPrimary}
                      />
                    ) : (
                      <Text
                        style={[s.numpadKeyText, { color: colors.textPrimary }]}
                      >
                        {key}
                      </Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            ))}

            {/* Continue button */}
            <TouchableOpacity
              style={[
                s.continueBtn,
                {
                  backgroundColor: canContinueAmount
                    ? accent
                    : `${accent}4D`,
                },
              ]}
              disabled={!canContinueAmount}
              onPress={() => {
                setStep("recipient");
                Haptics.selectionAsync();
              }}
            >
              <Text
                style={[s.continueBtnText, { color: colors.textOnAccent }]}
              >
                Continue
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ════════════════════════════════════════════════════════════════
          STEP: RECIPIENT
         ════════════════════════════════════════════════════════════════ */}
      {step === "recipient" && (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 80 }]}
            keyboardShouldPersistTaps="handled"
          >
            {/* Address input bar */}
            <View
              style={[
                s.toBar,
                {
                  backgroundColor: colors.surfaceCard,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[s.toBarLabel, { color: colors.textMuted }]}>To</Text>
              <TextInput
                value={recipient}
                onChangeText={(v) => {
                  setRecipient(v);
                  setRecipientSearch(v);
                }}
                placeholder="Enter address to send to"
                autoCapitalize="none"
                autoCorrect={false}
                style={[s.toBarInput, { color: colors.textPrimary }]}
                placeholderTextColor={colors.textMuted}
              />
              <TouchableOpacity
                style={[
                  s.toBarPaste,
                  { backgroundColor: colors.surfaceCard },
                ]}
                onPress={handlePaste}
              >
                <Text style={[s.toBarPasteText, { color: colors.textPrimary }]}>Paste</Text>
              </TouchableOpacity>
            </View>

            {/* Contacts section */}
            {contacts.length > 0 && (
              <Text style={[s.sectionLabel, { color: colors.textMuted, marginTop: 16 }]}>
                Contacts
              </Text>
            )}

            {contactsLoading ? (
              <ActivityIndicator size="small" color={accent} style={{ marginTop: 20 }} />
            ) : (
              contactCandidates.slice(0, 10).map((candidate) => (
                <TouchableOpacity
                  key={candidate.id}
                  style={[
                    s.contactRow,
                    {
                      backgroundColor: colors.surfaceCard,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() => {
                    setRecipient(candidate.address);
                    Haptics.selectionAsync();
                  }}
                >
                  <View
                    style={[
                      s.contactAvatar,
                      { backgroundColor: `${colors.accentAlt}2E` },
                    ]}
                  >
                    <Text style={[s.contactAvatarLetter, { color: colors.accentAlt }]}>
                      {candidate.name[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.contactName, { color: colors.textPrimary }]}>
                      {candidate.name}
                    </Text>
                    <Text style={[s.contactAddr, { color: colors.textMuted }]}>
                      {shorten(candidate.address, 8, 6)}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={14} color={colors.textMuted} />
                </TouchableOpacity>
              ))
            )}
          </ScrollView>

          {/* Fixed bottom button */}
          <View
            style={[
              s.bottomBtn,
              { paddingBottom: insets.bottom + 12 },
            ]}
          >
            <TouchableOpacity
              style={[
                s.primaryBtn,
                {
                  backgroundColor: canContinueRecipient
                    ? accent
                    : `${accent}47`,
                },
              ]}
              disabled={!canContinueRecipient}
              onPress={() => {
                Haptics.selectionAsync();
                handleSendWithSheet();
              }}
            >
              <Text style={[s.primaryBtnText, { color: colors.textOnAccent }]}>
                Review
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* ── Unified confirm sheet (pre-broadcast: prepare + simulate + approve) */}
      <TransactionConfirmSheet
        ref={tc.sheetRef}
        preview={tc.preview}
        simulation={tc.simulation}
        gasFee={tc.gasFee}
        loading={tc.loading}
        onApprove={tc.onApprove}
        onReject={tc.onReject}
      />

      {/* ════════════════════════════════════════════════════════════════
          STEP: SUBMITTING
         ════════════════════════════════════════════════════════════════ */}
      {step === "submitting" && (
        <View style={s.centeredStep}>
          <ActivityIndicator size="large" color={accent} />
          <Text style={[s.submittingTitle, { color: colors.textPrimary }]}>
            Sending…
          </Text>
          <Text style={[s.submittingSub, { color: colors.textMuted }]}>
            Signing with passkey and relaying to bundler
          </Text>
        </View>
      )}

      {/* ════════════════════════════════════════════════════════════════
          STEP: RESULT
         ════════════════════════════════════════════════════════════════ */}
      {step === "result" && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 24 }]}
        >
          {/* Status icon */}
          <View style={s.resultIconWrap}>
            <View
              style={[
                s.resultIconCircle,
                {
                  backgroundColor:
                    finalState === "confirmed"
                      ? colors.successSoft
                      : finalState === "failed" || finalState === "cancelled"
                        ? colors.dangerSoft
                        : colors.warningSoft,
                },
              ]}
            >
              <Feather
                name={
                  finalState === "confirmed"
                    ? "check"
                    : finalState === "failed" || finalState === "cancelled"
                      ? "x"
                      : "clock"
                }
                size={34}
                color={
                  finalState === "confirmed"
                    ? colors.success
                    : finalState === "failed" || finalState === "cancelled"
                      ? colors.danger
                      : colors.warning
                }
              />
            </View>
            <Text style={[s.resultTitle, { color: colors.textPrimary }]}>
              {finalState === "confirmed"
                ? "Transaction Confirmed"
                : finalState === "failed"
                  ? "Transaction Failed"
                  : finalState === "cancelled"
                    ? "Cancelled"
                    : "Pending…"}
            </Text>
            {finalState === "confirmed" && (
              <Text style={[s.resultSub, { color: colors.textMuted }]}>
                {amountDecimal} {selectedToken?.symbol} sent successfully
              </Text>
            )}
          </View>

          {/* Error message if failed */}
          {errorMessage && (
            <View
              style={[
                s.errorBanner,
                {
                  backgroundColor: colors.dangerSoft,
                  borderColor: `${colors.danger}4D`,
                },
              ]}
            >
              <Feather name="alert-circle" size={13} color={colors.danger} />
              <Text style={[s.errorBannerText, { color: colors.danger }]}>
                {errorMessage}
              </Text>
            </View>
          )}

          {/* TX details card */}
          <View
            style={[
              s.reviewCard,
              {
                backgroundColor: colors.surfaceCard,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={[s.reviewRow, { borderBottomColor: colors.border }]}>
              <Text style={[s.reviewKey, { color: colors.textMuted }]}>Amount</Text>
              <Text style={[s.reviewVal, { color: colors.textPrimary }]}>
                {amountDecimal} {selectedToken?.symbol}
              </Text>
            </View>
            <View style={[s.reviewRow, { borderBottomColor: colors.border }]}>
              <Text style={[s.reviewKey, { color: colors.textMuted }]}>To</Text>
              <Text style={[s.reviewVal, { color: colors.textPrimary }]}>
                {shorten(recipient.trim(), 8, 6)}
              </Text>
            </View>
            {userOpHash && (
              <View style={[s.reviewRow, { borderBottomColor: colors.border }]}>
                <Text style={[s.reviewKey, { color: colors.textMuted }]}>UserOp</Text>
                <Text style={[s.reviewVal, { color: colors.textPrimary }]}>
                  {shorten(userOpHash, 8, 6)}
                </Text>
              </View>
            )}
            {txHash && (
              <View style={[s.reviewRow, { borderBottomWidth: 0 }]}>
                <Text style={[s.reviewKey, { color: colors.textMuted }]}>Tx Hash</Text>
                <Text style={[s.reviewVal, { color: colors.textPrimary }]}>
                  {shorten(txHash, 8, 6)}
                </Text>
              </View>
            )}
          </View>

          {/* Send another / Done */}
          <TouchableOpacity
            style={[s.primaryBtn, { backgroundColor: accent }]}
            onPress={resetFlow}
          >
            <Text style={[s.primaryBtnText, { color: colors.textOnAccent }]}>
              {finalState === "confirmed" ? "Done" : "Back to Send"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
};


// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerIcon: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  networkRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 10,
    gap: 10,
  },
  networkPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  networkPillEmoji: { fontSize: 14 },
  networkPillText: { fontSize: 13, fontWeight: "600" },
  fundingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  fundingText: { fontSize: 12, fontWeight: "500" },
  dropdown: {
    marginHorizontal: 20,
    marginBottom: 8,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  dropdownRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dropdownEmoji: { fontSize: 18, width: 28, textAlign: "center" },
  dropdownName: { fontSize: 14, fontWeight: "700" },
  dropdownSub: { fontSize: 11, marginTop: 2, fontWeight: "500" },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginHorizontal: 20,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  errorBannerText: { fontSize: 12, fontWeight: "600", flex: 1 },
  body: { paddingHorizontal: 20, paddingTop: 4, gap: 10 },
  sectionLabel: { fontSize: 13, fontWeight: "600", marginBottom: 4 },
  // Token row
  tokenRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  tokenIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  tokenIconLetter: { fontSize: 18, fontWeight: "800" },
  tokenSymbol: { fontSize: 15, fontWeight: "700" },
  tokenName: { fontSize: 12, marginTop: 2 },
  tokenBalance: { fontSize: 14, fontWeight: "700" },
  tokenBalanceSub: { fontSize: 11, marginTop: 2 },
  // Amount step
  amountDisplay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
    minHeight: 160,
  },
  amountBig: {
    fontSize: 56,
    fontWeight: "300",
    letterSpacing: -2,
  },
  amountSymbol: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 4,
  },
  amountAvailable: {
    fontSize: 13,
    marginTop: 8,
  },
  quickRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  quickBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: "center",
  },
  quickBtnText: { fontSize: 13, fontWeight: "700" },
  numpad: {
    paddingHorizontal: 16,
    gap: 6,
  },
  numpadRow: { flexDirection: "row", gap: 6 },
  numpadKey: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  numpadKeyText: { fontSize: 22, fontWeight: "400" },
  continueBtn: {
    marginTop: 10,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  continueBtnText: { fontSize: 16, fontWeight: "700" },
  // Recipient step
  toBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  toBarLabel: { fontSize: 14, fontWeight: "600", width: 22 },
  toBarInput: { flex: 1, fontSize: 14, fontWeight: "500" },
  toBarPaste: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  toBarPasteText: { fontSize: 13, fontWeight: "700" },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  contactAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  contactAvatarLetter: { fontSize: 16, fontWeight: "800" },
  contactName: { fontSize: 14, fontWeight: "700" },
  contactAddr: { fontSize: 12, marginTop: 2 },
  bottomBtn: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  primaryBtn: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryBtnText: { fontSize: 16, fontWeight: "700" },
  // Review card (shared with result step)
  reviewCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 16,
  },
  reviewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  reviewKey: { fontSize: 13, fontWeight: "600" },
  reviewVal: { fontSize: 13, fontWeight: "700", maxWidth: "60%", textAlign: "right" },
  // Submitting step
  centeredStep: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  submittingTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: 18,
    letterSpacing: -0.4,
  },
  submittingSub: {
    fontSize: 13,
    marginTop: 8,
    textAlign: "center",
    lineHeight: 20,
  },
  // Result step
  resultIconWrap: {
    alignItems: "center",
    paddingTop: 24,
    paddingBottom: 20,
  },
  resultIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  resultTitle: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.5,
    textAlign: "center",
  },
  resultSub: {
    fontSize: 14,
    marginTop: 6,
    textAlign: "center",
  },
});

export default SendScreen;
