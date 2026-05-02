type PriceUpdate = {
  symbol: string;
  price: string;
  changePercent: string;
};

type Subscriber = (update: PriceUpdate) => void;

class BinanceWS {
  private ws: WebSocket | null = null;
  private subscribers: Map<string, Set<Subscriber>> = new Map();
  private baseUrl = 'wss://stream.binance.com:9443/ws';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  private activeSymbols: string[] = [];

  connect(symbols: string[]) {
    if (!symbols || symbols.length === 0) return;
    
    // Avoid redundant reconnections if symbols haven't changed
    const sortedSymbols = [...symbols].sort();
    if (this.ws && JSON.stringify(sortedSymbols) === JSON.stringify(this.activeSymbols)) {
      return;
    }
    
    this.activeSymbols = sortedSymbols;
    
    if (this.ws) {
      // Temporarily remove onclose to prevent loop during intentional restart
      this.ws.onclose = null;
      this.ws.close();
    }

    // Filter and sanitize symbols (only alphanumeric, lowercase)
    const validSymbols = symbols
      .map(s => s.toLowerCase().replace(/[^a-z0-9]/g, ''))
      .filter(s => s.length > 0 && s.length < 10) // Basic sanity check
      .map(s => s.endsWith('usdt') ? s : `${s}usdt`);

    const streams = validSymbols.map(s => `${s}@ticker`).join('/');
    const url = `wss://stream.binance.com:9443/stream?streams=${streams}`;

    console.log(`[BinanceWS] Connecting to ${validSymbols.length} streams...`);
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('[BinanceWS] Connected');
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const data = msg.data;
        if (data && data.e === '24hrTicker') {
          const update: PriceUpdate = {
            symbol: data.s.replace('USDT', ''),
            price: data.c,
            changePercent: data.P,
          };
          
          const symbolSubs = this.subscribers.get(update.symbol);
          if (symbolSubs) {
            symbolSubs.forEach(cb => cb(update));
          }
        }
      } catch (e) {
        console.error('[BinanceWS] Parse error:', e);
      }
    };

    this.ws.onerror = (e) => {
      console.error('[BinanceWS] Error:', e);
    };

    this.ws.onclose = () => {
      console.log('[BinanceWS] Closed');
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        setTimeout(() => this.connect(symbols), 5000);
      }
    };
  }

  subscribe(symbol: string, callback: Subscriber) {
    if (!this.subscribers.has(symbol)) {
      this.subscribers.set(symbol, new Set());
    }
    this.subscribers.get(symbol)!.add(callback);
    
    // If not connected, we might need a more global way to manage this
    // For now, assume the hook will call connect with initial list
  }

  unsubscribe(symbol: string, callback: Subscriber) {
    const symbolSubs = this.subscribers.get(symbol);
    if (symbolSubs) {
      symbolSubs.delete(callback);
      if (symbolSubs.size === 0) {
        this.subscribers.delete(symbol);
      }
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const binanceWS = new BinanceWS();
export type { PriceUpdate };
