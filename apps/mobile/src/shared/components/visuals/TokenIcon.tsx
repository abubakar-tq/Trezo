import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, ViewStyle, ImageStyle, StyleProp } from 'react-native';
import { useAppTheme } from '@theme';
import { withAlpha } from '@utils/color';

interface TokenIconProps {
  symbol: string;
  address?: string;
  uri?: string;
  size?: number;
  style?: StyleProp<ViewStyle | ImageStyle>;
}

export const TokenIcon: React.FC<TokenIconProps> = ({ 
  symbol, 
  address, 
  uri, 
  size = 40,
  style 
}) => {
  const { theme } = useAppTheme();
  const { colors } = theme;
  const [error, setError] = useState(false);
  const [imgUri, setImgUri] = useState<string | null>(uri || null);

  useEffect(() => {
    // Reset state when props change
    setError(false);
    
    if (uri) {
      setImgUri(uri);
      return;
    }

    const cleanSymbol = symbol?.toUpperCase() || '';
    
    // Check for native tokens or specific symbols first with direct reliable fallbacks
    if (cleanSymbol === 'ETH') {
      setImgUri('https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png');
    } else if (cleanSymbol === 'SOL') {
      setImgUri('https://assets.coingecko.com/coins/images/4128/small/solana.png');
    } else if (cleanSymbol === 'BTC' || cleanSymbol === 'WBTC') {
      setImgUri('https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/bitcoin/info/logo.png');
    } else if (cleanSymbol === 'BNB') {
      setImgUri('https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/binance/info/logo.png');
    } else if (cleanSymbol === 'MATIC' || cleanSymbol === 'POL') {
      setImgUri('https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png');
    } else if (address && /^0x[0-9a-fA-F]{40}$/.test(address) && address !== '0x0000000000000000000000000000000000000000') {
      const isSolana = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
      const blockchain = isSolana ? 'solana' : 'ethereum';
      const trustUri = `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${blockchain}/assets/${address}/logo.png`;
      setImgUri(trustUri);
    } else if (cleanSymbol) {
      const symbolLower = cleanSymbol.toLowerCase();
      // Try CoinCap as primary for the dashboard consistency
      setImgUri(`https://assets.coincap.io/assets/icons/${symbolLower}@2x.png`);
    }
  }, [symbol, address, uri]);

  const renderPlaceholder = () => (
    <View style={[
      styles.placeholder, 
      { 
        width: size, 
        height: size, 
        borderRadius: size / 2,
        backgroundColor: withAlpha(colors.accent, 0.1),
        borderColor: withAlpha(colors.accent, 0.2)
      },
      style
    ]}>
      <Text style={[styles.placeholderText, { fontSize: size * 0.4, color: colors.accent }]}>
        {symbol?.charAt(0).toUpperCase()}
      </Text>
    </View>
  );

  if (error || !imgUri) {
    return renderPlaceholder();
  }

  return (
    <Image
      source={{ uri: imgUri }}
      style={[
        { width: size, height: size, borderRadius: size / 2, backgroundColor: 'transparent' },
        style as StyleProp<ImageStyle>
      ]}
      onError={() => {
        const symbolLower = symbol?.toLowerCase();
        if (!symbolLower) {
          setError(true);
          return;
        }

        // Tiered fallback sequence for high-fidelity brand recognition
        if (imgUri.includes('assets.coincap.io')) {
          // CoinCap failed, try high-quality cryptoicons.org
          setImgUri(`https://cryptoicons.org/api/icon/${symbolLower}/200`);
        } else if (imgUri.includes('cryptoicons.org')) {
          // CryptoIcons failed, try OKX CDN
          setImgUri(`https://static.okx.com/cdn/oksupport/asset/currency/icon/${symbolLower}.png`);
        } else if (imgUri.includes('static.okx.com')) {
          // OKX failed, try SpotHQ cryptocurrency-icons (very reliable community set)
          setImgUri(`https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${symbolLower}.png`);
        } else if (imgUri.includes('cryptocurrency-icons')) {
          // Final straw: CoinIcons API
          setImgUri(`https://coinicons-api.vercel.app/api/icon/${symbolLower}`);
        } else {
          setError(true);
        }
      }}
    />
  );
};

const styles = StyleSheet.create({
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  placeholderText: {
    fontWeight: 'bold',
  },
});

