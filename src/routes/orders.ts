import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { createOrder, getOrder, getOrdersByUser, getOrdersByStatus } from '../database/queries';
import { validateOrderRequest } from '../utils/validators';
import { queueManager } from '../services/queue-manager';
import { logger } from '../utils/logger';
import { OrderNotFoundError } from '../utils/errors';

export async function registerOrderRoutes(fastify: FastifyInstance) {
  // Submit new order
  fastify.post<{ Body: any }>('/api/orders/execute', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const validatedData = validateOrderRequest(request.body);

      // Create order in database
      const order = await createOrder({
        userId: validatedData.userId,
        tokenIn: validatedData.tokenIn,
        tokenOut: validatedData.tokenOut,
        amountIn: validatedData.amountIn,
        minAmountOut: validatedData.minAmountOut,
        slippageTolerance: validatedData.slippageTolerance,
        status: 'pending',
      });

      logger.info('Order created', {
        orderId: order.id,
        userId: order.userId,
      });

      // Enqueue order for processing
      await queueManager.enqueueOrder(order);

      // Return order ID and WebSocket URL
      return reply.code(202).send({
        orderId: order.id,
        wsUrl: `/ws/${order.id}`,
        status: 'pending',
        createdAt: order.createdAt,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error';
      const statusCode = (error as any).statusCode || 500;

      logger.error('Order submission error', { error: message });
      return reply.code(statusCode).send({
        error: message,
        code: (error as any).code || 'INTERNAL_ERROR',
      });
    }
  });

  // Get order status
  fastify.get<{ Params: { id: string } }>('/api/orders/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const order = await getOrder(request.params.id);

      if (!order) {
        throw new OrderNotFoundError(request.params.id);
      }

      logger.info('Order status requested', { orderId: request.params.id });

      return reply.send(order);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error';
      const statusCode = (error as any).statusCode || 500;

      return reply.code(statusCode).send({
        error: message,
        code: (error as any).code || 'INTERNAL_ERROR',
      });
    }
  });

  // Get user's orders
  fastify.get<{ Querystring: { userId: string; limit?: string; offset?: string } }>(
    '/api/orders',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId, limit = '50', offset = '0' } = request.query;

        if (!userId) {
          return reply.code(400).send({
            error: 'userId query parameter is required',
            code: 'VALIDATION_ERROR',
          });
        }

        const orders = await getOrdersByUser(userId, parseInt(limit), parseInt(offset));

        logger.info('User orders retrieved', { userId, count: orders.length });

        return reply.send({
          orders,
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: orders.length,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal server error';

        logger.error('Orders retrieval error', { error: message });
        return reply.code(500).send({
          error: message,
          code: 'INTERNAL_ERROR',
        });
      }
    }
  );

  // Get queue stats
  fastify.get('/api/queue/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = await queueManager.getQueueStats();
      return reply.send(stats);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error';
      return reply.code(500).send({
        error: message,
        code: 'INTERNAL_ERROR',
      });
    }
  });

  // Get WebSocket manager stats
  fastify.get('/api/ws/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { wsManager } = await import('../services/websocket-manager');
      const stats = wsManager.getStats();
      return reply.send(stats);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error';
      return reply.code(500).send({
        error: message,
        code: 'INTERNAL_ERROR',
      });
    }
  });

  // Health check
  fastify.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ status: 'ok', timestamp: new Date().toISOString() });
  });
}
