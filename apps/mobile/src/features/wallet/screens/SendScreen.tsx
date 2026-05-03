import { Feather, Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useAppTheme } from "@theme";
import { withAlpha } from "@utils/color";
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
import { SendExecutionService } from "@/src/features/send/services/SendExecutionService";
import { SendValidationService } from "@/src/features/send/services/SendValidationService";
import { TransactionHistoryService } from "@/src/features/send/services/TransactionHistoryService";
import { TransactionReceiptTracker } from "@/src/features/send/services/TransactionReceiptTracker";
import type { SendIntent } from "@/src/features/send/types/send";
import WalletPersistenceService from "@/src/features/wallet/services/SupabaseWalletService";
import { devFundSmartAccount } from "@/src/features/wallet/services/devFunding";
import { useWalletStore } from "@/src/features/wallet/store/useWalletStore";
import {
  DEFAULT_CHAIN_ID,
  SUPPORTED_CHAIN_IDS,
  getChainConfig,
  type SupportedChainId,
} from "@/src/integration/chains";
import { useUserStore } from "@/src/store/useUserStore";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SendScreenProps {
  onCancel?: () => void;
}

type FlowStep =
  | "token"
  | "amount"
  | "recipient"
  | "review"
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
  1: "Ξ",
  324: "⧫",
  300: "⧫",
};

// ─── Component ───────────────────────────────────────────────────────────────

export const SendScreen: React.FC<SendScreenProps> = ({ onCancel }) => {
  const { theme, resolvedMode } = useAppTheme();
  const { colors } = theme;
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const isDark = resolvedMode === "dark";

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
  const [txId, setTxId] = useState<string | null>(null);
  const [userOpHash, setUserOpHash] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  // ── Messages ──────────────────────────────────────────────────────────────
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [autoFunding, setAutoFunding] = useState(false);

  // ── Services / Refs ───────────────────────────────────────────────────────
  const walletService = useMemo(() => new WalletPersistenceService(), []);
  const autoFundedRef = useRef<Set<string>>(new Set());

  // ── Derived ───────────────────────────────────────────────────────────────
  const chainOptions = useMemo(
    () => SUPPORTED_CHAIN_IDS.map((id) => getChainConfig(id)),
    [],
  );
  const selectedChain = getChainConfig(selectedChainId);
  const tokenOptions = useMemo(
    () => TokenRegistryService.listTokens(selectedChainId),
    [selectedChainId],
  );

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
            feeMode: "sponsored",
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

  const executeSend = async () => {
    setErrorMessage(null);
    const intent = composeIntent();
    if (!intent) {
      setErrorMessage("Missing wallet or user session.");
      return;
    }
    const validation = await SendValidationService.validate(intent, {
      feeMode: "sponsored",
    });
    if (!validation.isValid) {
      setErrorMessage(validation.errors[0]?.message ?? "Validation failed.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setStep("submitting");
    const result = await SendExecutionService.executeSend(intent, {
      waitForReceipt: false,
      validation: { feeMode: "sponsored" },
    });
    setTxId(result.transactionId);
    setUserOpHash(result.userOpHash ?? null);
    setTxHash(result.transactionHash ?? null);

    if (result.status === "cancelled") {
      setFinalState("cancelled");
      setErrorMessage("Signing was cancelled.");
      setStep("result");
      return;
    }
    if (result.status === "failed") {
      setFinalState("failed");
      setErrorMessage(result.error ?? "Transaction failed.");
      setStep("result");
      return;
    }

    const row = await TransactionHistoryService.getById(result.transactionId);
    if (!row) {
      setFinalState("pending");
      setStep("result");
      return;
    }
    const tracked = await TransactionReceiptTracker.trackById(row, {
      timeoutMs: 45_000,
      pollIntervalMs: 2_000,
    });
    if (tracked === "confirmed") {
      const latest = await TransactionHistoryService.getById(
        result.transactionId,
      );
      setTxHash(latest?.transactionHash ?? null);
      setFinalState("confirmed");
      setStep("result");
      return;
    }
    if (tracked === "failed") {
      const latest = await TransactionHistoryService.getById(
        result.transactionId,
      );
      setFinalState("failed");
      setErrorMessage(
        latest?.errorMessage ?? "Transaction failed after submission.",
      );
      setStep("result");
      return;
    }
    setFinalState("pending");
    setStep("result");
  };

  const resetFlow = () => {
    setStep("token");
    setFinalState(null);
    setAmountDecimal("");
    setRecipient("");
    setRecipientSearch("");
    setTxHash(null);
    setTxId(null);
    setUserOpHash(null);
    setErrorMessage(null);
  };

  const goBack = () => {
    if (step === "token") {
      if (onCancel) onCancel();
      else navigation.goBack();
    } else if (step === "amount") setStep("token");
    else if (step === "recipient") setStep("amount");
    else if (step === "review") setStep("recipient");
    else resetFlow();
  };

  const stepTitle = useMemo(() => {
    if (step === "token") return "Send";
    if (step === "amount") return "Send";
    if (step === "recipient") return "Send";
    if (step === "review") return "Review";
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
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

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
                backgroundColor: withAlpha(colors.surfaceCard, 0.85),
                borderColor: withAlpha(colors.border, 0.35),
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
              backgroundColor: withAlpha(colors.surfaceCard, 0.97),
              borderColor: withAlpha(colors.border, 0.3),
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
                    borderBottomColor: withAlpha(colors.border, 0.18),
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
              backgroundColor: withAlpha(colors.danger, 0.12),
              borderColor: withAlpha(colors.danger, 0.3),
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
                    backgroundColor: withAlpha(
                      colors.surfaceCard,
                      active ? 0.9 : 0.6,
                    ),
                    borderColor: active
                      ? withAlpha(accent, 0.45)
                      : withAlpha(colors.border, 0.25),
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
                        ? withAlpha(accent, 0.18)
                        : withAlpha(colors.surface, 0.8),
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
                    backgroundColor: withAlpha(colors.surfaceCard, 0.75),
                    borderColor: withAlpha(colors.border, 0.25),
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
                        backgroundColor: withAlpha(colors.surfaceCard, 0.55),
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
                    : withAlpha(accent, 0.3),
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
                  backgroundColor: withAlpha(colors.surfaceCard, 0.75),
                  borderColor: withAlpha(colors.border, 0.3),
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
                placeholderTextColor={withAlpha(colors.textPrimary, 0.3)}
              />
              <TouchableOpacity
                style={[
                  s.toBarPaste,
                  { backgroundColor: withAlpha(colors.surface, 0.9) },
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
                      backgroundColor: withAlpha(colors.surfaceCard, 0.7),
                      borderColor: withAlpha(colors.border, 0.22),
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
                      { backgroundColor: withAlpha(colors.accentAlt, 0.18) },
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
                    : withAlpha(accent, 0.28),
                },
              ]}
              disabled={!canContinueRecipient}
              onPress={() => {
                setStep("review");
                Haptics.selectionAsync();
              }}
            >
              <Text style={[s.primaryBtnText, { color: colors.textOnAccent }]}>
                Review
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* ════════════════════════════════════════════════════════════════
          STEP: REVIEW  (Phantom style)
         ════════════════════════════════════════════════════════════════ */}
      {step === "review" && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 20 }]}
        >
          {/* Sending header */}
          <View style={s.reviewHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[s.reviewHeaderLabel, { color: colors.textMuted }]}>Sending</Text>
              <Text style={[s.reviewHeaderAmount, { color: colors.textPrimary }]}>
                {amountDecimal} {selectedToken?.symbol}
              </Text>
            </View>
            {/* Token icon */}
            <View
              style={[
                s.reviewTokenIcon,
                { backgroundColor: withAlpha(accent, 0.15) },
              ]}
            >
              <Text style={[s.reviewTokenLetter, { color: accent }]}>
                {selectedToken?.symbol?.[0] ?? "?"}
              </Text>
            </View>
          </View>

          {/* Details card */}
          <View
            style={[
              s.reviewCard,
              {
                backgroundColor: withAlpha(colors.surfaceCard, 0.82),
                borderColor: withAlpha(colors.border, 0.22),
              },
            ]}
          >
            {/* From */}
            <View style={[s.reviewRow, { borderBottomColor: withAlpha(colors.border, 0.18) }]}>
              <Text style={[s.reviewKey, { color: colors.textMuted }]}>From</Text>
              <View style={s.reviewValRow}>
                <View
                  style={[
                    s.reviewAvatar,
                    { backgroundColor: withAlpha(accent, 0.18) },
                  ]}
                >
                  <Feather name="user" size={12} color={accent} />
                </View>
                <Text style={[s.reviewVal, { color: colors.textPrimary }]}>
                  {shorten(walletAddress, 8, 6)}
                </Text>
              </View>
            </View>

            {/* To */}
            <View style={[s.reviewRow, { borderBottomColor: withAlpha(colors.border, 0.18) }]}>
              <Text style={[s.reviewKey, { color: colors.textMuted }]}>To</Text>
              <Text style={[s.reviewVal, { color: colors.textPrimary }]}>
                {shorten(recipient.trim(), 8, 6)}
              </Text>
            </View>

            {/* Network */}
            <View style={[s.reviewRow, { borderBottomColor: withAlpha(colors.border, 0.18) }]}>
              <Text style={[s.reviewKey, { color: colors.textMuted }]}>Network</Text>
              <Text style={[s.reviewVal, { color: colors.textPrimary }]}>
                {selectedChain.name}
              </Text>
            </View>

            {/* Network fee */}
            <View style={[s.reviewRow, { borderBottomWidth: 0 }]}>
              <Text style={[s.reviewKey, { color: colors.textMuted }]}>Network fee</Text>
              <Text style={[s.reviewVal, { color: colors.textPrimary }]}>Sponsored</Text>
            </View>
          </View>

          {/* Cancel / Confirm */}
          <View style={s.reviewActions}>
            <TouchableOpacity
              style={[
                s.cancelBtn,
                {
                  backgroundColor: withAlpha(colors.surfaceCard, 0.8),
                  borderColor: withAlpha(colors.border, 0.25),
                },
              ]}
              onPress={() => setStep("recipient")}
            >
              <Text style={[s.cancelBtnText, { color: colors.textPrimary }]}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.confirmBtn, { backgroundColor: accent }]}
              onPress={executeSend}
            >
              <Text style={[s.confirmBtnText, { color: colors.textOnAccent }]}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

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
                      ? withAlpha(colors.success, 0.15)
                      : finalState === "failed" || finalState === "cancelled"
                        ? withAlpha(colors.danger, 0.15)
                        : withAlpha(colors.warning, 0.15),
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
                  backgroundColor: withAlpha(colors.danger, 0.12),
                  borderColor: withAlpha(colors.danger, 0.3),
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
                backgroundColor: withAlpha(colors.surfaceCard, 0.82),
                borderColor: withAlpha(colors.border, 0.22),
              },
            ]}
          >
            <View style={[s.reviewRow, { borderBottomColor: withAlpha(colors.border, 0.18) }]}>
              <Text style={[s.reviewKey, { color: colors.textMuted }]}>Amount</Text>
              <Text style={[s.reviewVal, { color: colors.textPrimary }]}>
                {amountDecimal} {selectedToken?.symbol}
              </Text>
            </View>
            <View style={[s.reviewRow, { borderBottomColor: withAlpha(colors.border, 0.18) }]}>
              <Text style={[s.reviewKey, { color: colors.textMuted }]}>To</Text>
              <Text style={[s.reviewVal, { color: colors.textPrimary }]}>
                {shorten(recipient.trim(), 8, 6)}
              </Text>
            </View>
            {userOpHash && (
              <View style={[s.reviewRow, { borderBottomColor: withAlpha(colors.border, 0.18) }]}>
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
  // Review step
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    marginTop: 8,
  },
  reviewHeaderLabel: { fontSize: 13, fontWeight: "600", marginBottom: 2 },
  reviewHeaderAmount: { fontSize: 32, fontWeight: "600", letterSpacing: -1 },
  reviewTokenIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewTokenLetter: { fontSize: 22, fontWeight: "800" },
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
  reviewValRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  reviewAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewKey: { fontSize: 13, fontWeight: "600" },
  reviewVal: { fontSize: 13, fontWeight: "700", maxWidth: "60%", textAlign: "right" },
  reviewActions: {
    flexDirection: "row",
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  cancelBtnText: { fontSize: 16, fontWeight: "700" },
  confirmBtn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  confirmBtnText: { fontSize: 16, fontWeight: "700" },
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

