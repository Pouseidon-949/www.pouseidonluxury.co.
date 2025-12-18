/**
 * Core Liquidity and Arbitrage Types for Pouseidon Bot v2
 */

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

export enum ArbitrageType {
  SPATIAL = 'SPATIAL',
  TEMPORAL = 'TEMPORAL',
  TRIANGULAR = 'TRIANGULAR',
  CROSS_EXCHANGE = 'CROSS_EXCHANGE'
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
  bidVolume?: number;
  askVolume?: number;
  depth?: LiquidityDepth;
}

export interface LiquidityDepth {
  bids: Array<[price: number, volume: number]>;
  asks: Array<[price: number, volume: number]>;
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

/**
 * Arbitrage Opportunity Detection
 */
export interface ArbitrageOpportunity {
  id: string;
  type: ArbitrageType;
  pair: string;
  sourcePrice: number;
  targetPrice: number;
  priceDifference: number;
  percentageProfit: number;
  confidenceScore: number;
  sourceExchange?: string;
  targetExchange?: string;
  timestamp: number;
  estimatedSlippage: number;
  potentialProfit: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  estimatedExecutionTime: number;
  microLotSize?: number;
  capitalRequired?: number;
}

export interface LiquidityMetrics {
  pair: string;
  totalLiquidity: number;
  spreadPercentage: number;
  priceImpact: Map<number, number>;
  volatility: number;
  timestamp: number;
  liquidity24h: number;
  averagePrice: number;
  medianPrice: number;
}

export interface CapitalState {
  totalCapital: number;
  availableCapital: number;
  allocatedCapital: number;
  activePositions: Map<string, number>;
  reusableCapital: number;
}

export interface LoopState {
  loopId: string;
  startTime: number;
  opportunities: ArbitrageOpportunity[];
  executedTrades: TradeResult[];
  capitalBefore: CapitalState;
  capitalAfter?: CapitalState;
  totalProfit: number;
  successRate: number;
}

export interface MicroLotCalculation {
  baseSize: number;
  adjustedSize: number;
  liquidity: number;
  maxLotSize: number;
  riskAdjustment: number;
  finalSize: number;
}

export interface SlippageEstimate {
  orderSize: number;
  estimatedSlippage: number;
  slippagePercentage: number;
  impactedPrice: number;
  timeToExecute: number;
}

export interface MarketMetrics {
  pair: string;
  bidPrice: number;
  askPrice: number;
  lastTradePrice: number;
  volumeWeightedPrice: number;
  priceChange24h: number;
  volume24h: number;
  volatility: number;
  timestamp: number;
}

export interface RankingCriteria {
  profitability: number;
  riskAdjustedReturn: number;
  liquidity: number;
  executionSpeed: number;
  capitalEfficiency: number;
}

export interface RankedOpportunity extends ArbitrageOpportunity {
  rankingScore: number;
  ranking: number;
  criteria: RankingCriteria;
}
