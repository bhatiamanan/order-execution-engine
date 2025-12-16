import { z } from 'zod';
import { OrderRequest } from '../types/order';
import { ValidationError } from './errors';

const orderRequestSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  tokenIn: z.string().regex(/^[1-9A-HJ-NP-Z]{32,34}$/, 'Invalid token address'),
  tokenOut: z.string().regex(/^[1-9A-HJ-NP-Z]{32,34}$/, 'Invalid token address'),
  amountIn: z.string().regex(/^\d+(\.\d+)?$/, 'Invalid amount format'),
  minAmountOut: z.string().regex(/^\d+(\.\d+)?$/, 'Invalid amount format'),
  slippageTolerance: z.number().min(0.1).max(50).optional().default(0.5),
});

export function validateOrderRequest(data: any): OrderRequest {
  try {
    return orderRequestSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(`Validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
    }
    throw error;
  }
}

export function validateTokenAddress(address: string): boolean {
  return /^[1-9A-HJ-NP-Z]{32,34}$/.test(address);
}

export function validateAmount(amount: string): boolean {
  return /^\d+(\.\d+)?$/.test(amount) && parseFloat(amount) > 0;
}
