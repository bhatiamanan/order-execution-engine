import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { dexRouter } from '../src/services/dex-router';
import { Quote, RoutingDecision } from '../src/types/dex';

describe('DEX Router', () => {
  it('should generate quotes for Raydium', async () => {
    const quote = await dexRouter.getQuote(
      'raydium',
      'So11111111111111111111111111111111111111112',
      'EPjFWaJiy6ePf60j6sPn6ZozD7Zb9T9r3BjnvG5LLPQ',
      '1'
    );

    expect(quote).toBeDefined();
    expect(quote.dex).toBe('raydium');
    expect(quote.inputAmount).toBe('1');
    expect(parseFloat(quote.outputAmount)).toBeGreaterThan(0);
    expect(quote.priceImpact).toBeGreaterThan(0);
  });

  it('should generate quotes for Meteora', async () => {
    const quote = await dexRouter.getQuote(
      'meteora',
      'So11111111111111111111111111111111111111112',
      'EPjFWaJiy6ePf60j6sPn6ZozD7Zb9T9r3BjnvG5LLPQ',
      '1'
    );

    expect(quote).toBeDefined();
    expect(quote.dex).toBe('meteora');
    expect(quote.inputAmount).toBe('1');
    expect(parseFloat(quote.outputAmount)).toBeGreaterThan(0);
  });

  it('should compare prices and select best DEX', async () => {
    const routingDecision = await dexRouter.routeOrder(
      'So11111111111111111111111111111111111111112',
      'EPjFWaJiy6ePf60j6sPn6ZozD7Zb9T9r3BjnvG5LLPQ',
      '1'
    );

    expect(routingDecision).toBeDefined();
    expect(routingDecision.selectedDex).toMatch(/raydium|meteora/);
    expect(routingDecision.raydiumQuote).toBeDefined();
    expect(routingDecision.meteoraQuote).toBeDefined();
    expect(routingDecision.reason).toBeTruthy();
  });

  it('should prefer DEX with higher output amount', async () => {
    const routingDecision = await dexRouter.routeOrder(
      'So11111111111111111111111111111111111111112',
      'EPjFWaJiy6ePf60j6sPn6ZozD7Zb9T9r3BjnvG5LLPQ',
      '10'
    );

    const selectedQuote = routingDecision.selectedDex === 'raydium'
      ? routingDecision.raydiumQuote
      : routingDecision.meteoraQuote;

    const otherQuote = routingDecision.selectedDex === 'raydium'
      ? routingDecision.meteoraQuote
      : routingDecision.raydiumQuote;

    // Selected DEX should have better or equal output
    const selectedOutput = parseFloat(selectedQuote.outputAmount);
    const otherOutput = parseFloat(otherQuote.outputAmount);

    expect(selectedOutput).toBeGreaterThanOrEqual(otherOutput * 0.99); // Allow small margin
  });

  it('should handle different order sizes', async () => {
    const sizes = ['0.1', '1', '10', '100'];

    for (const size of sizes) {
      const routingDecision = await dexRouter.routeOrder(
        'So11111111111111111111111111111111111111112',
        'EPjFWaJiy6ePf60j6sPn6ZozD7Zb9T9r3BjnvG5LLPQ',
        size
      );

      expect(routingDecision.selectedDex).toMatch(/raydium|meteora/);
      expect(parseFloat(routingDecision.raydiumQuote.outputAmount)).toBeGreaterThan(0);
      expect(parseFloat(routingDecision.meteoraQuote.outputAmount)).toBeGreaterThan(0);
    }
  });
});
