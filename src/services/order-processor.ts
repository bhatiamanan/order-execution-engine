import { Order, OrderStatus, StatusUpdate } from '../types/order';
import { dexRouter } from './dex-router';
import { updateOrderStatus, recordExecution, recordFailure } from '../database/queries';
import { wsManager } from './websocket-manager';
import { logger } from '../utils/logger';
import { config } from '../config/env';
import { cacheOrder } from '../config/redis';
import { ExecutionError, RoutingError } from '../utils/errors';
import Decimal from 'decimal.js';

export class OrderProcessor {
  async processOrder(order: Order): Promise<void> {
    try {
      // Emit pending status
      await this.emitStatusUpdate(order.id, 'pending', {});

      // Step 1: Routing
      await this.emitStatusUpdate(order.id, 'routing', {});
      const routingDecision = await dexRouter.routeOrder(
        order.tokenIn,
        order.tokenOut,
        order.amountIn
      );

      if (!routingDecision) {
        throw new RoutingError('Failed to route order');
      }

      logger.info('Order routed successfully', {
        orderId: order.id,
        selectedDex: routingDecision.selectedDex,
        reason: routingDecision.reason,
      });

      // Update order with selected DEX
      await updateOrderStatus(order.id, 'routing', {
        dexSelected: routingDecision.selectedDex,
      } as any);

      // Step 2: Building transaction
      await this.emitStatusUpdate(order.id, 'building', {
        dex: routingDecision.selectedDex,
      });

      const selectedQuote = routingDecision.selectedDex === 'raydium'
        ? routingDecision.raydiumQuote
        : routingDecision.meteoraQuote;

      // Simulate transaction building delay
      await this.delay(500);

      // Step 3: Submitting
      await this.emitStatusUpdate(order.id, 'submitted', {
        dex: routingDecision.selectedDex,
        price: selectedQuote.outputAmount,
      });

      // Step 4: Execute swap (mock)
      const executionResult = await this.executeSwap(
        order.id,
        routingDecision.selectedDex,
        selectedQuote,
        order
      );

      // Step 5: Confirm
      await updateOrderStatus(order.id, 'confirmed', {
        txHash: executionResult.txHash,
        executedPrice: executionResult.executedPrice,
        completedAt: new Date(),
      } as any);

      await this.emitStatusUpdate(order.id, 'confirmed', {
        dex: routingDecision.selectedDex,
        price: executionResult.executedPrice,
        txHash: executionResult.txHash,
      });

      logger.info('Order execution completed successfully', {
        orderId: order.id,
        txHash: executionResult.txHash,
        executedPrice: executionResult.executedPrice,
      });

      // Cache updated order
      const updatedOrder = await this.getUpdatedOrder(order.id);
      if (updatedOrder) {
        await cacheOrder(order.id, updatedOrder);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorCode = error instanceof Error ? (error as any).code || 'UNKNOWN_ERROR' : 'UNKNOWN_ERROR';

      logger.error('Order execution failed', {
        orderId: order.id,
        error: errorMessage,
        errorCode,
      });

      // Record failure for post-mortem
      await recordFailure(order.id, 1, errorMessage, errorCode, {
        tokenIn: order.tokenIn,
        tokenOut: order.tokenOut,
        amountIn: order.amountIn,
      });

      // Update order status to failed
      await updateOrderStatus(order.id, 'failed', {
        errorReason: errorMessage,
        completedAt: new Date(),
      } as any);

      // Emit failure status
      await this.emitStatusUpdate(order.id, 'failed', {
        error: errorMessage,
      });

      throw error;
    }
  }

  private async executeSwap(
    orderId: string,
    dex: string,
    quote: any,
    order: Order
  ): Promise<{ txHash: string; executedPrice: string }> {
    if (!config.mock.enabled) {
      throw new ExecutionError('Real execution not implemented');
    }

    // Mock execution
    await this.delay(config.mock.delayMs);

    // Simulate realistic output with slippage
    const baseOutput = new Decimal(quote.outputAmount);
    const slippageAmount = baseOutput
      .times(order.slippageTolerance)
      .dividedBy(100);
    const finalOutput = baseOutput.minus(slippageAmount);

    const mockTxHash = `${Buffer.from(orderId).toString('hex').substring(0, 64)}`;

    logger.info('Swap executed on mock DEX', {
      orderId,
      dex,
      inputAmount: order.amountIn,
      outputAmount: finalOutput.toString(),
      txHash: mockTxHash,
    });

    // Record execution
    await recordExecution(
      orderId,
      dex,
      order.amountIn,
      finalOutput.toString(),
      mockTxHash,
      'completed',
      null
    );

    return {
      txHash: mockTxHash,
      executedPrice: finalOutput.toString(),
    };
  }

  private async emitStatusUpdate(
    orderId: string,
    status: OrderStatus,
    data: any
  ): Promise<void> {
    const update: StatusUpdate = {
      event: 'status_update',
      orderId,
      status,
      data,
      timestamp: Date.now(),
    };

    wsManager.broadcast(update);
    logger.debug('Status update emitted', { orderId, status });
  }

  private async getUpdatedOrder(orderId: string) {
    // This would normally fetch from database, but for now we'll just return the basic structure
    return { id: orderId, status: 'confirmed' };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const orderProcessor = new OrderProcessor();
