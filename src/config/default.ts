import { TradingConfig } from '../types';

export const defaultConfig: TradingConfig = {
  defaultSlippageTolerance: 0.005,
  maxRetries: 3,
  loopsPerMinute: 19,
  minTradeSize: 10,
  maxTradeSize: 10000
};

export const testConfig: TradingConfig = {
  defaultSlippageTolerance: 0.01,
  maxRetries: 2,
  loopsPerMinute: 60,
  minTradeSize: 1,
  maxTradeSize: 1000
};

export const productionConfig: TradingConfig = {
  defaultSlippageTolerance: 0.003,
  maxRetries: 5,
  loopsPerMinute: 19,
  minTradeSize: 50,
  maxTradeSize: 50000
};

export function getConfig(environment: 'default' | 'test' | 'production' = 'default'): TradingConfig {
  switch (environment) {
    case 'test':
      return testConfig;
    case 'production':
      return productionConfig;
    default:
      return defaultConfig;
  }
}
