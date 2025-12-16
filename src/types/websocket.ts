import { RawServerDefault } from 'fastify';
import { SocketStream } from '@fastify/websocket';
import { StatusUpdate } from './order';

export interface WebSocketClient {
  orderId: string;
  socket: SocketStream;
  createdAt: Date;
}

export interface WebSocketManager {
  broadcast(update: StatusUpdate): void;
  subscribe(orderId: string, socket: SocketStream): void;
  unsubscribe(orderId: string): void;
  getClient(orderId: string): WebSocketClient | undefined;
}
