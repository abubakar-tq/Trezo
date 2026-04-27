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
      // Direct high-quality fallback for Solana
      setImgUri('https://assets.coingecko.com/coins/images/4128/small/solana.png');
    } else if (cleanSymbol === 'BTC' || cleanSymbol === 'WBTC') {
      setImgUri('https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/bitcoin/info/logo.png');
    } else if (cleanSymbol === 'BNB') {
      setImgUri('https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/binance/info/logo.png');
    } else if (cleanSymbol === 'MATIC' || cleanSymbol === 'POL') {
      setImgUri('https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png');
    } else if (address && address !== '0x0000000000000000000000000000000000000000') {
      // Determine blockchain by address format
      // Solana addresses are 32-44 chars base58
      const isSolana = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
      const blockchain = isSolana ? 'solana' : 'ethereum';
      
      // Try TrustWallet assets as primary source
      const trustUri = `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${blockchain}/assets/${address}/logo.png`;
      setImgUri(trustUri);
    } else {
      // Final fallback: general icon API by symbol
      setImgUri(`https://coinicons-api.vercel.app/api/icon/${cleanSymbol.toLowerCase()}`);
    }
  }, [symbol, address, uri]);

  const renderPlaceholder = () => (
    <View style={[
      styles.placeholder, 
      { 
        width: size, 
        height: size, 
        borderRadius: size / 2,
        backgroundColor: colors.glass,
        borderColor: colors.glassBorder
      },
      style
    ]}>
      <Text style={[styles.placeholderText, { fontSize: size * 0.4, color: colors.textPrimary }]}>
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
        // If TrustWallet fails and we have a symbol, try the fallback API
        if (imgUri.includes('trustwallet') && symbol) {
          setImgUri(`https://coinicons-api.vercel.app/api/icon/${symbol.toLowerCase()}`);
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

