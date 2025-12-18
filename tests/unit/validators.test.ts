import { describe, it, expect, beforeEach } from '@jest/globals';
import { validateOrderRequest, validateTokenAddress, validateAmount } from '../src/utils/validators';
import { ValidationError } from '../src/utils/errors';

describe('Validators', () => {
  it('should validate correct order request', () => {
    const validRequest = {
      userId: 'user-123',
      tokenIn: 'So11111111111111111111111111111111111111112',
      tokenOut: 'EPjFWaJiy6ePf60j6sPn6ZozD7Zb9T9r3BjnvG5LLPQ',
      amountIn: '1.5',
      minAmountOut: '140',
      slippageTolerance: 0.5,
    };

    const result = validateOrderRequest(validRequest);
    expect(result.userId).toBe('user-123');
    expect(result.slippageTolerance).toBe(0.5);
  });

  it('should reject invalid token address', () => {
    const validAddress = 'So11111111111111111111111111111111111111112';
    const invalidAddress = 'invalid-address';

    expect(validateTokenAddress(validAddress)).toBe(true);
    expect(validateTokenAddress(invalidAddress)).toBe(false);
  });

  it('should reject invalid amount', () => {
    expect(validateAmount('1.5')).toBe(true);
    expect(validateAmount('0')).toBe(false);
    expect(validateAmount('-1')).toBe(false);
    expect(validateAmount('invalid')).toBe(false);
  });

  it('should set default slippage tolerance', () => {
    const request = {
      userId: 'user-123',
      tokenIn: 'So11111111111111111111111111111111111111112',
      tokenOut: 'EPjFWaJiy6ePf60j6sPn6ZozD7Zb9T9r3BjnvG5LLPQ',
      amountIn: '1.5',
      minAmountOut: '140',
    };

    const result = validateOrderRequest(request);
    expect(result.slippageTolerance).toBe(0.5);
  });

  it('should reject orders with missing required fields', () => {
    const invalidRequest = {
      userId: 'user-123',
      tokenIn: 'So11111111111111111111111111111111111111112',
      // Missing tokenOut
      amountIn: '1.5',
      minAmountOut: '140',
    };

    expect(() => validateOrderRequest(invalidRequest)).toThrow(ValidationError);
  });
});
