export type OrderStatus = 
  | 'pending'
  | 'routing'
  | 'building'
  | 'submitted'
  | 'confirmed'
  | 'failed';

export type DEXName = 'raydium' | 'meteora';

export interface Order {
  id: string;
  userId: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  minAmountOut: string;
  slippageTolerance: number; // percentage, e.g., 0.5 for 0.5%
  status: OrderStatus;
  dexSelected?: DEXName;
  txHash?: string;
  executedPrice?: string;
  errorReason?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface OrderRequest {
  userId: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  minAmountOut: string;
  slippageTolerance?: number;
}

export interface OrderResponse {
  orderId: string;
  wsUrl: string;
  status: OrderStatus;
}

export interface StatusUpdate {
  event: 'status_update';
  orderId: string;
  status: OrderStatus;
  data: {
    dex?: DEXName;
    price?: string;
    txHash?: string;
    error?: string;
  };
  timestamp: number;
}
