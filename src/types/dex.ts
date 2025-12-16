export interface Quote {
  dex: 'raydium' | 'meteora';
  inputAmount: string;
  outputAmount: string;
  priceImpact: number; // percentage
  minReceived: string;
  executionTime: number; // ms
}

export interface DEXConfig {
  name: 'raydium' | 'meteora';
  enabled: boolean;
  priority: number;
  timeout: number; // ms
}

export interface RoutingDecision {
  selectedDex: 'raydium' | 'meteora';
  raydiumQuote: Quote;
  meteoraQuote: Quote;
  reason: string;
}
