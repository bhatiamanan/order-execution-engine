import { Quote, RoutingDecision } from '../types/dex';
import { logger } from '../utils/logger';
import Decimal from 'decimal.js';
import { config } from '../config/env';

export class DEXRouter {
  async getQuote(
    dex: 'raydium' | 'meteora',
    tokenIn: string,
    tokenOut: string,
    amountIn: string
  ): Promise<Quote> {
    if (config.mock.enabled) {
      return this.getMockQuote(dex, amountIn);
    }
    // Real implementation would go here
    throw new Error('Real DEX quote not implemented');
  }

  private getMockQuote(dex: 'raydium' | 'meteora', amountIn: string): Promise<Quote> {
    return new Promise((resolve) => {
      // Simulate network delay
      setTimeout(() => {
        const amount = new Decimal(amountIn);
        const baseRate = new Decimal('0.95'); // 95 USDC per SOL (mock)

        // Raydium: slightly better rate (0.5% better)
        // Meteora: slightly worse rate (2% worse)
        const rate = dex === 'raydium'
          ? baseRate.times('1.005')
          : baseRate.times('0.98');

        const outputAmount = amount.times(rate).toString();
        const minReceived = amount
          .times(rate)
          .times('0.995') // 0.5% slippage
          .toString();

        const priceImpact = dex === 'raydium' ? 0.3 : 0.8;

        logger.debug(`Generated ${dex} quote`, {
          tokenIn: 'SOL',
          tokenOut: 'USDC',
          amountIn,
          outputAmount,
          minReceived,
          priceImpact,
        });

        resolve({
          dex,
          inputAmount: amountIn,
          outputAmount,
          priceImpact,
          minReceived,
          executionTime: config.mock.delayMs,
        });
      }, config.mock.delayMs);
    });
  }

  async routeOrder(
    tokenIn: string,
    tokenOut: string,
    amountIn: string
  ): Promise<RoutingDecision> {
    logger.info('Starting DEX routing', { tokenIn, tokenOut, amountIn });

    const [raydiumQuote, meteoraQuote] = await Promise.all([
      this.getQuote('raydium', tokenIn, tokenOut, amountIn),
      this.getQuote('meteora', tokenIn, tokenOut, amountIn),
    ]);

    logger.debug('Received quotes', {
      raydiumOutput: raydiumQuote.outputAmount,
      meteoraOutput: meteoraQuote.outputAmount,
    });

    // Compare output amounts
    const raydiumOutput = new Decimal(raydiumQuote.outputAmount);
    const meteoraOutput = new Decimal(meteoraQuote.outputAmount);

    let selectedDex: 'raydium' | 'meteora';
    let reason: string;

    if (raydiumOutput.greaterThan(meteoraOutput)) {
      selectedDex = 'raydium';
      const difference = raydiumOutput.minus(meteoraOutput);
      const percentageDifference = difference.dividedBy(meteoraOutput).times(100);
      reason = `Raydium offers ${percentageDifference.toFixed(2)}% better rate`;
    } else {
      selectedDex = 'meteora';
      const difference = meteoraOutput.minus(raydiumOutput);
      const percentageDifference = difference.dividedBy(raydiumOutput).times(100);
      reason = `Meteora offers ${percentageDifference.toFixed(2)}% better rate`;
    }

    logger.info('DEX routing decision', {
      selectedDex,
      reason,
      raydiumOutput: raydiumQuote.outputAmount,
      meteoraOutput: meteoraQuote.outputAmount,
    });

    return {
      selectedDex,
      raydiumQuote,
      meteoraQuote,
      reason,
    };
  }
}

export const dexRouter = new DEXRouter();
