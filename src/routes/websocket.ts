import { FastifyInstance, FastifyRequest } from 'fastify';
import { SocketStream } from '@fastify/websocket';
import { wsManager } from '../services/websocket-manager';
import { logger } from '../utils/logger';

export async function registerWebSocketRoutes(fastify: FastifyInstance) {
  fastify.get<{ Params: { orderId: string } }>(
    '/ws/:orderId',
    { websocket: true },
    async (socket: SocketStream, request: FastifyRequest) => {
      const orderId = request.params.orderId;

      logger.info('WebSocket connection established', { orderId });

      try {
        // Subscribe to order updates
        wsManager.subscribe(orderId, socket);

        // Send initial connection message
        socket.socket.send(
          JSON.stringify({
            event: 'connected',
            orderId,
            timestamp: Date.now(),
          })
        );

        // Keep connection alive
        socket.socket.on('message', (data: Buffer) => {
          try {
            const message = JSON.parse(data.toString());
            logger.debug('WebSocket message received', { orderId, message });

            // Echo pong for ping
            if (message.type === 'ping') {
              socket.socket.send(
                JSON.stringify({
                  type: 'pong',
                  timestamp: Date.now(),
                })
              );
            }
          } catch (error) {
            logger.error('WebSocket message parsing error', {
              orderId,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        });
      } catch (error) {
        logger.error('WebSocket connection error', {
          orderId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );
}
