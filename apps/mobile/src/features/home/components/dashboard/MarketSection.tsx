import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, FlatList, Animated, StyleSheet } from 'react-native';
import { Feather } from "@expo/vector-icons";
import { useAppTheme } from "@theme";
import { withAlpha } from "@utils/color";
import { MARKET_CHAIN_OPTIONS, type MarketToken, type EvmChain } from "@lib/api/web3Data";
import { MarketTokenSkeleton } from "@shared/components/ui";

interface MarketSectionProps {
  tokens: MarketToken[];
  filteredTokens: MarketToken[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activeChain: EvmChain;
  activeChainLabel: string;
  onSelectChain: (chain: EvmChain) => void;
  onRefresh: () => void;
  onRetry: () => void;
  onTokenPress: (token: MarketToken) => void;
  isRefreshing: boolean;
  refreshSpin: any;
  renderTokenItem: (props: { item: MarketToken }) => React.ReactElement;
  renderEmptyComponent: () => React.ReactElement;
  source: string | null;
  lastUpdated: string | null;
}

export const MarketSection: React.FC<MarketSectionProps> = ({
  tokens,
  filteredTokens,
  loading,
  error,
  searchQuery,
  setSearchQuery,
  activeChain,
  activeChainLabel,
  onSelectChain,
  onRefresh,
  onRetry,
  onTokenPress,
  isRefreshing,
  refreshSpin,
  renderTokenItem,
  renderEmptyComponent,
  source,
  lastUpdated,
}) => {
  const { theme } = useAppTheme();
  const { colors } = theme;
  const styles = createStyles(colors);

  const skeletonData = useMemo(() => Array.from({ length: 8 }, (_, index) => index), []);
  const isInitialLoading = loading && tokens.length === 0;

  return (
    <View style={styles.marketSection}>
      <View style={styles.marketHeader}>
        <View>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Market</Text>
          <Text style={[styles.marketMeta, { color: colors.textSecondary }]}>
            {source ? (source === "moralis" ? "Source: Moralis" : "Source: CoinGecko") : "Source syncing…"}
          </Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.9}
          style={styles.marketRefreshIconButton}
          onPress={onRefresh}
          disabled={loading && tokens.length === 0}
        >
          <Animated.View style={isRefreshing ? refreshSpin : undefined}>
            <Feather name="refresh-ccw" size={16} color={colors.accent} />
          </Animated.View>
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.marketChainScroller}
      >
        {MARKET_CHAIN_OPTIONS.map((option) => {
          const isActive = option.key === activeChain;
          return (
            <TouchableOpacity
              key={option.key}
              style={[
                styles.marketChainPill,
                { backgroundColor: colors.surfaceCard, borderColor: colors.borderMuted },
                isActive && { backgroundColor: colors.accent, borderColor: colors.accent },
              ]}
              activeOpacity={0.85}
              onPress={() => onSelectChain(option.key)}
            >
              <Text
                style={[
                  styles.marketChainLabel,
                  { color: colors.textSecondary },
                  isActive && { color: "#ffffff", fontWeight: '700' },
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.marketInfoRow}>
        <Text style={[styles.marketMeta, { color: colors.textSecondary }]}>
          {lastUpdated
            ? `Updated ${new Date(lastUpdated).toLocaleTimeString()}`
            : `Awaiting data for ${activeChainLabel}`}
        </Text>
        {error && tokens.length > 0 ? (
          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.marketErrorPill, { backgroundColor: withAlpha(colors.danger, 0.1) }]}
            onPress={onRetry}
          >
            <Feather name="alert-circle" size={14} color={colors.danger} />
            <Text style={[styles.marketErrorPillText, { color: colors.danger }]}>Retry</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={[styles.marketSearch, { backgroundColor: colors.surfaceCard, borderColor: colors.borderMuted }]}>
        <Feather
          name="search"
          size={16}
          color={withAlpha(colors.textMuted, 0.65)}
        />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by token or symbol"
          placeholderTextColor={withAlpha(colors.textMuted, 0.55)}
          style={[styles.marketSearchInput, { color: colors.textPrimary }]}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>

      {isInitialLoading ? (
        <FlatList
          data={skeletonData}
          keyExtractor={(item) => `market-skeleton-${item}`}
          renderItem={() => <MarketTokenSkeleton />}
          scrollEnabled={false}
        />
      ) : (
        <FlatList
          data={filteredTokens}
          keyExtractor={(item) => `${item.chain}-${item.address}`}
          renderItem={renderTokenItem}
          scrollEnabled={false}
          ListEmptyComponent={renderEmptyComponent}
        />
      )}
    </View>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  marketSection: {
    paddingTop: 8,
    gap: 16,
  },
  marketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  marketMeta: {
    fontSize: 12,
    marginTop: 2,
    opacity: 0.8,
  },
  marketRefreshIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(colors.accent, 0.1),
  },
  marketChainScroller: {
    paddingVertical: 4,
    gap: 8,
  },
  marketChainPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  marketChainLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  marketInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  marketErrorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  marketErrorPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  marketSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
  },
  marketSearchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
});
