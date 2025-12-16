import { createClient } from 'redis';
import { config } from './env';

export const redisClient = createClient({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        console.error('Redis reconnection failed after 10 attempts');
        return new Error('Max retries exceeded');
      }
      return Math.min(retries * 50, 500);
    },
  },
});

redisClient.on('error', (err) => {
  console.error('Redis Client Error', err);
});

redisClient.on('connect', () => {
  console.log('Redis connected');
});

export async function connectRedis() {
  await redisClient.connect();
}

export async function closeRedis() {
  await redisClient.quit();
}

export async function cacheOrder(orderId: string, data: any, ttlSeconds = 86400) {
  await redisClient.setEx(
    `order:${orderId}`,
    ttlSeconds,
    JSON.stringify(data)
  );
}

export async function getOrderCache(orderId: string) {
  const data = await redisClient.get(`order:${orderId}`);
  return data ? JSON.parse(data) : null;
}

export async function deleteOrderCache(orderId: string) {
  await redisClient.del(`order:${orderId}`);
}
