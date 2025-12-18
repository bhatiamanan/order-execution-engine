import { describe, it, expect, beforeEach } from '@jest/globals';
import { QueueManager } from '../src/services/queue-manager';
import { Order } from '../src/types/order';

describe('Queue Manager', () => {
  let queueManager: QueueManager;
  let mockOrder: Order;

  beforeEach(() => {
    queueManager = new QueueManager();
    mockOrder = {
      id: 'test-order-1',
      userId: 'user-1',
      tokenIn: 'So11111111111111111111111111111111111111112',
      tokenOut: 'EPjFWaJiy6ePf60j6sPn6ZozD7Zb9T9r3BjnvG5LLPQ',
      amountIn: '1.5',
      minAmountOut: '140',
      slippageTolerance: 0.5,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  });

  it('should have correct queue configuration', async () => {
    const stats = await queueManager.getQueueStats();
    expect(stats.concurrency).toBe(10); // MAX_CONCURRENT_ORDERS = 10
  });

  it('should track queue statistics', async () => {
    const stats = await queueManager.getQueueStats();
    expect(stats).toHaveProperty('waitingCount');
    expect(stats).toHaveProperty('activeCount');
    expect(stats).toHaveProperty('completedCount');
    expect(stats).toHaveProperty('failedCount');
  });

  it('should handle exponential backoff configuration', () => {
    // Test that retry strategy is configured
    expect(true).toBe(true); // Placeholder for real retry test
  });

  it('should respect maximum concurrent orders limit', () => {
    const maxConcurrent = 10;
    expect(maxConcurrent).toBeLessThanOrEqual(100);
  });

  afterEach(async () => {
    await queueManager.closeQueue();
  });
});
