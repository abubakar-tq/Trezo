import { NavigationProp, RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Clipboard, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { RootStackParamList } from "@/src/types/navigation";
import { useAppTheme } from "@theme";
import type { ThemeColors } from "@theme";
import {
  getRecoveryRequestService,
  type RecoveryApproval,
  type RecoveryRequest,
} from "@/src/features/wallet/services/RecoveryRequestService";

type Route = RouteProp<RootStackParamList, "ShareRecoveryRequest">;

const ShareRecoveryScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<Route>();
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme.colors), [theme.colors]);

  const serviceRef = useRef(getRecoveryRequestService());
  const [request, setRequest] = useState<RecoveryRequest | null>(null);
  const [approvals, setApprovals] = useState<RecoveryApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const link = `https://trezo.app/recovery/guardian/${route.params.requestId}`;

  const loadState = useCallback(async () => {
    const [nextRequest, nextApprovals] = await Promise.all([
      serviceRef.current.getRecoveryRequest(route.params.requestId),
      serviceRef.current.listApprovals(route.params.requestId),
    ]);
    setRequest(nextRequest);
    setApprovals(nextApprovals);
  }, [route.params.requestId]);

  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      setLoading(true);
      setError(null);
      try {
        await loadState();
      } catch (e) {
        if (isMounted) {
          setError(e instanceof Error ? e.message : "Failed to load recovery request.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void initialize();

    const unsubscribeApprovals = serviceRef.current.subscribeToApprovals(
      route.params.requestId,
      (nextApprovals) => {
        if (!isMounted) return;
        setApprovals(nextApprovals);
      },
    );

    const requestPoll = setInterval(() => {
      void serviceRef.current
        .getRecoveryRequest(route.params.requestId)
        .then((nextRequest) => {
          if (!isMounted) return;
          setRequest(nextRequest);
        })
        .catch(() => {
          // keep current UI state on transient polling failures
        });
    }, 6000);

    return () => {
      isMounted = false;
      unsubscribeApprovals();
      clearInterval(requestPoll);
    };
  }, [loadState, route.params.requestId]);

  const approvalMap = useMemo(() => {
    const map = new Map<string, RecoveryApproval>();
    for (const approval of approvals) {
      map.set(approval.guardian_address.toLowerCase(), approval);
    }
    return map;
  }, [approvals]);

  const validApprovalCount = useMemo(
    () => approvals.filter((approval) => approval.verification_status === "valid").length,
    [approvals],
  );

  const deadlineLabel = useMemo(() => {
    if (!request?.deadline) return "Unknown";
    const deadline = new Date(request.deadline);
    const remainingMs = deadline.getTime() - Date.now();
    if (remainingMs <= 0) return `Expired at ${deadline.toLocaleString()}`;
    const minutes = Math.floor(remainingMs / 60000);
    const days = Math.floor(minutes / (24 * 60));
    const hours = Math.floor((minutes % (24 * 60)) / 60);
    const mins = minutes % 60;
    return `${days}d ${hours}h ${mins}m remaining`;
  }, [request?.deadline]);

  const handleCopy = () => {
    Clipboard.setString(link);
    Alert.alert("Link copied", "Share the guardian approval link with your configured guardians.");
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Approve this Trezo recovery request: ${link}`,
        url: link,
      });
    } catch (shareError) {
      Alert.alert(
        "Share failed",
        shareError instanceof Error ? shareError.message : "Failed to open the share sheet.",
      );
    }
  };

  if (loading) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Text style={styles.kicker}>Share</Text>
          <Text style={styles.title}>Loading recovery request...</Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.kicker}>Share</Text>
        <Text style={styles.title}>Send the guardian link.</Text>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Text style={styles.body} numberOfLines={3}>
          {link}
        </Text>

        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>Request ID</Text>
          <Text style={styles.summaryValue}>{route.params.requestId}</Text>
          <Text style={styles.summaryMeta}>Status: {request?.status ?? "unknown"}</Text>
          <Text style={styles.summaryMeta}>
            Approvals: {validApprovalCount}/{request?.threshold ?? 0}
          </Text>
          <Text style={styles.summaryMeta}>Deadline: {deadlineLabel}</Text>
        </View>

        <Text style={styles.sectionTitle}>Guardian Status</Text>
        {request?.guardian_addresses?.length ? (
          request.guardian_addresses.map((guardianAddress) => {
            const approval = approvalMap.get(guardianAddress.toLowerCase());
            return (
              <View style={styles.guardianRow} key={guardianAddress}>
                <Text style={styles.guardianAddress}>{guardianAddress}</Text>
                <Text style={styles.guardianStatus}>
                  {approval?.verification_status === "valid"
                    ? "Approved"
                    : approval?.verification_status === "invalid"
                      ? "Invalid signature"
                      : "Pending"}
                </Text>
              </View>
            );
          })
        ) : (
          <Text style={styles.emptyText}>No guardians configured for this request.</Text>
        )}

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleCopy}>
            <Text style={styles.secondaryButtonText}>Copy Link</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => void handleShare()}>
            <Text style={styles.secondaryButtonText}>Share</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate("RecoveryProgress", { requestId: route.params.requestId })}
        >
          <Text style={styles.primaryButtonText}>Go to progress</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flexGrow: 1,
      padding: 24,
      backgroundColor: colors.background,
      justifyContent: "center",
    },
    card: {
      borderRadius: 28,
      padding: 24,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 16,
    },
    kicker: {
      color: colors.accent,
      textTransform: "uppercase",
      letterSpacing: 2,
      fontSize: 12,
      fontWeight: "700",
    },
    title: {
      color: colors.text,
      fontSize: 26,
      fontWeight: "800",
      lineHeight: 32,
    },
    body: {
      color: colors.textMuted,
      fontSize: 15,
      lineHeight: 22,
    },
    errorText: {
      color: colors.danger,
      fontSize: 14,
      lineHeight: 20,
    },
    summaryBox: {
      borderRadius: 18,
      padding: 16,
      backgroundColor: colors.surfaceMuted,
      gap: 4,
    },
    summaryLabel: {
      color: colors.textMuted,
      fontSize: 12,
      textTransform: "uppercase",
      letterSpacing: 1.2,
    },
    summaryValue: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "700",
    },
    summaryMeta: {
      color: colors.textMuted,
      fontSize: 13,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "700",
    },
    guardianRow: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      paddingVertical: 10,
      paddingHorizontal: 12,
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 10,
    },
    guardianAddress: {
      color: colors.text,
      fontSize: 13,
      flexShrink: 1,
      fontWeight: "600",
    },
    guardianStatus: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "600",
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
    primaryButton: {
      paddingVertical: 16,
      borderRadius: 18,
      backgroundColor: colors.accent,
      alignItems: "center",
    },
    actionRow: {
      flexDirection: "row",
      gap: 12,
    },
    secondaryButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
    },
    secondaryButtonText: {
      color: colors.text,
      fontWeight: "700",
      fontSize: 15,
    },
    primaryButtonText: {
      color: colors.textOnAccent,
      fontWeight: "700",
      fontSize: 16,
    },
  });

export default ShareRecoveryScreen;
