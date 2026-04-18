import React, { useEffect } from "react";
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useWallet } from "../hooks/useWallet";

const WalletDashboard: React.FC = () => {
  const {
    isWalletInitialized,
    activeAccount,
    balances,
    transactions,
    balancesLoading,
    transactionsLoading,
    loading,
    error,
    initializeWallet,
    createWallet,
    fetchBalance,
    fetchTransactions,
  } = useWallet();

  useEffect(() => {
    initializeWallet();
  }, []);

  const handleCreateWallet = async () => {
    try {
      const result = await createWallet("My Wallet");
      Alert.alert(
        "Wallet Created! 🎉",
        `Address: ${result.address.slice(0, 10)}...\n\nSave your mnemonic:\n${result.mnemonic}`,
        [{ text: "OK" }]
      );
    } catch (err) {
      Alert.alert("Error", "Failed to create wallet");
    }
  };

  const handleRefresh = () => {
    fetchBalance();
    fetchTransactions();
  };

  if (loading && !isWalletInitialized) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1877f2" />
          <Text style={styles.loadingText}>Initializing wallet...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isWalletInitialized) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.title}>Welcome to Trezo Wallet</Text>
          <Text style={styles.subtitle}>Create your first wallet to get started</Text>
          <TouchableOpacity style={styles.button} onPress={handleCreateWallet}>
            <Text style={styles.buttonText}>Create Wallet</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const ethBalance = balances.find((b) => b.symbol === "ETH");

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Wallet Dashboard</Text>
          <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
            <Text style={styles.refreshText}>Refresh</Text>
          </TouchableOpacity>
        </View>

        {/* Error Display */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
          </View>
        )}

        {/* Account Info */}
        {activeAccount && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Active Account</Text>
            <Text style={styles.accountName}>{activeAccount.name}</Text>
            <Text style={styles.address}>
              {activeAccount.address.slice(0, 6)}...{activeAccount.address.slice(-4)}
            </Text>
          </View>
        )}

        {/* Balance */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Balance</Text>
          {balancesLoading ? (
            <ActivityIndicator color="#1877f2" />
          ) : ethBalance ? (
            <View>
              <Text style={styles.balanceAmount}>
                {parseFloat(ethBalance.balance).toFixed(4)} {ethBalance.symbol}
              </Text>
              <Text style={styles.balanceSubtext}>Anvil Local Network</Text>
            </View>
          ) : (
            <Text style={styles.noData}>No balance data</Text>
          )}
        </View>

        {/* Transactions */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recent Transactions</Text>
          {transactionsLoading ? (
            <ActivityIndicator color="#1877f2" />
          ) : transactions.length > 0 ? (
            transactions.slice(0, 5).map((tx, index) => (
              <View key={tx.hash} style={styles.txItem}>
                <View style={styles.txInfo}>
                  <Text style={styles.txHash}>
                    {tx.hash.slice(0, 10)}...{tx.hash.slice(-8)}
                  </Text>
                  <Text style={styles.txValue}>{parseFloat(tx.value).toFixed(4)} ETH</Text>
                </View>
                <Text style={[styles.txStatus, { color: tx.status === "confirmed" ? "#10b981" : "#f59e0b" }]}>
                  {tx.status}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.noData}>No transactions yet</Text>
          )}
        </View>

        {/* Connection Status */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Network Status</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: "#10b981" }]} />
            <Text style={styles.statusText}>Connected to Anvil (Local)</Text>
          </View>
          <Text style={styles.statusDetail}>http://10.0.2.2:8545</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#111827",
  },
  subtitle: {
    fontSize: 16,
    color: "#6b7280",
    marginTop: 8,
    marginBottom: 32,
    textAlign: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#6b7280",
  },
  button: {
    backgroundColor: "#1877f2",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "600",
  },
  refreshButton: {
    backgroundColor: "#3b82f6",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  refreshText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  errorContainer: {
    margin: 24,
    marginTop: 0,
    padding: 16,
    backgroundColor: "#fef2f2",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  errorText: {
    color: "#dc2626",
    fontSize: 14,
  },
  card: {
    backgroundColor: "#ffffff",
    marginHorizontal: 24,
    marginBottom: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6b7280",
    marginBottom: 12,
  },
  accountName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 4,
  },
  address: {
    fontSize: 14,
    color: "#9ca3af",
    fontFamily: "monospace",
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#111827",
  },
  balanceSubtext: {
    fontSize: 14,
    color: "#9ca3af",
    marginTop: 4,
  },
  noData: {
    fontSize: 14,
    color: "#9ca3af",
    fontStyle: "italic",
  },
  txItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  txInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  txHash: {
    fontSize: 14,
    color: "#111827",
    fontFamily: "monospace",
  },
  txValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  txStatus: {
    fontSize: 12,
    textTransform: "capitalize",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    color: "#111827",
  },
  statusDetail: {
    fontSize: 12,
    color: "#9ca3af",
    marginLeft: 16,
    fontFamily: "monospace",
  },
});

export default WalletDashboard;
