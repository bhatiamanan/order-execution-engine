import { SocketStream } from '@fastify/websocket';
import { StatusUpdate } from '../types/order';
import { logger } from '../utils/logger';

interface WebSocketClient {
  orderId: string;
  socket: SocketStream;
  createdAt: Date;
}

export class WebSocketManager {
  private clients: Map<string, WebSocketClient> = new Map();
  private orderSubscribers: Map<string, Set<string>> = new Map();

  subscribe(orderId: string, socket: SocketStream): void {
    const client: WebSocketClient = {
      orderId,
      socket,
      createdAt: new Date(),
    };

    this.clients.set(socket.socket.toString(), client);

    if (!this.orderSubscribers.has(orderId)) {
      this.orderSubscribers.set(orderId, new Set());
    }
    this.orderSubscribers.get(orderId)!.add(socket.socket.toString());

    logger.info('WebSocket client subscribed', { orderId, clientId: socket.socket.toString() });

    // Handle client disconnect
    socket.socket.on('close', () => {
      this.unsubscribe(orderId, socket.socket.toString());
    });

    socket.socket.on('error', (error) => {
      logger.error('WebSocket error', { orderId, error: error.message });
      this.unsubscribe(orderId, socket.socket.toString());
    });
  }

  unsubscribe(orderId: string, clientId: string): void {
    this.clients.delete(clientId);
    const subscribers = this.orderSubscribers.get(orderId);
    if (subscribers) {
      subscribers.delete(clientId);
      if (subscribers.size === 0) {
        this.orderSubscribers.delete(orderId);
      }
    }
    logger.info('WebSocket client unsubscribed', { orderId, clientId });
  }

  broadcast(update: StatusUpdate): void {
    const subscribers = this.orderSubscribers.get(update.orderId);

    if (!subscribers || subscribers.size === 0) {
      logger.warn('No subscribers for order', { orderId: update.orderId });
      return;
    }

    const message = JSON.stringify(update);

    subscribers.forEach((clientId) => {
      const client = this.clients.get(clientId);
      if (client && client.socket.socket.readyState === 1) { // OPEN state
        try {
          client.socket.socket.send(message);
          logger.debug('Status update sent', {
            orderId: update.orderId,
            status: update.status,
            clientId,
          });
        } catch (error) {
          logger.error('Failed to send status update', {
            orderId: update.orderId,
            clientId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          this.unsubscribe(update.orderId, clientId);
        }
      }
    });
  }

  getClient(clientId: string): WebSocketClient | undefined {
    return this.clients.get(clientId);
  }

  getSubscriberCount(orderId: string): number {
    return this.orderSubscribers.get(orderId)?.size || 0;
  }

  getStats() {
    return {
      totalClients: this.clients.size,
      totalOrders: this.orderSubscribers.size,
      orderStats: Array.from(this.orderSubscribers.entries()).map(([orderId, subscribers]) => ({
        orderId,
        subscriberCount: subscribers.size,
      })),
    };
  }
}

export const wsManager = new WebSocketManager();
