export enum OrderStatus {
  PENDING = 'PENDING',
  VALIDATING = 'VALIDATING',
  EXECUTING = 'EXECUTING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  ROLLED_BACK = 'ROLLED_BACK'
}

export enum OrderSide {
  BUY = 'BUY',
  SELL = 'SELL'
}

export interface Order {
  id: string;
  pair: string;
  side: OrderSide;
  amount: number;
  price: number;
  status: OrderStatus;
  timestamp: number;
  slippageTolerance: number;
  retryCount: number;
  maxRetries: number;
}

export interface TradeResult {
  success: boolean;
  orderId: string;
  executedAmount: number;
  executedPrice: number;
  error?: string;
  timestamp: number;
}

export interface LiquidityInfo {
  pair: string;
  availableLiquidity: number;
  bidPrice: number;
  askPrice: number;
  timestamp: number;
}

export interface ExecutionContext {
  order: Order;
  liquidityInfo: LiquidityInfo;
  timestamp: number;
}

export interface TradingConfig {
  defaultSlippageTolerance: number;
  maxRetries: number;
  loopsPerMinute: number;
  minTradeSize: number;
  maxTradeSize: number;
}
