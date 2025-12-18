import { Queue, Worker, QueueEvents } from 'bullmq';
import { redisClient } from '../config/redis';
import { Order } from '../types/order';
import { logger } from '../utils/logger';
import { config } from '../config/env';
import { orderProcessor } from './order-processor';

export interface OrderJob {
  orderId: string;
  orderData: Order;
  attempts: number;
  maxAttempts: number;
}

export class QueueManager {
  private queue: Queue<OrderJob>;
  private worker: Worker<OrderJob>;
  private queueEvents: QueueEvents;

  constructor() {
    this.queue = new Queue<OrderJob>('orders', {
      connection: {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
      },
    });

    this.queueEvents = new QueueEvents('orders', {
      connection: {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
      },
    });

    this.worker = new Worker<OrderJob>(
      'orders',
      async (job) => this.processJob(job),
      {
        connection: {
          host: config.redis.host,
          port: config.redis.port,
          password: config.redis.password,
        },
        concurrency: config.queue.maxConcurrent,
      }
    );

    this.setupWorkerHandlers();
  }

  private setupWorkerHandlers(): void {
    this.worker.on('completed', (job) => {
      logger.info('Order job completed', {
        orderId: job.data.orderId,
        jobId: job.id,
      });
    });

    this.worker.on('failed', (job, error) => {
      logger.error('Order job failed', {
        orderId: job?.data.orderId,
        error: error.message,
        attempts: job?.attemptsMade || 0,
      });
    });

    this.worker.on('error', (error) => {
      logger.error('Worker error', { error: error.message });
    });
  }

  private async processJob(job: any): Promise<void> {
    const orderJob: OrderJob = job.data;
    logger.info('Processing order job', {
      orderId: orderJob.orderId,
      attempt: job.attemptsMade + 1,
      maxAttempts: config.queue.retryMaxAttempts,
    });

    try {
      await orderProcessor.processOrder(orderJob.orderData);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Check if we should retry
      if (job.attemptsMade < config.queue.retryMaxAttempts - 1) {
        // Calculate exponential backoff
        const backoffMs = Math.min(1000 * Math.pow(2, job.attemptsMade), 30000);
        logger.info('Retrying order execution', {
          orderId: orderJob.orderId,
          attempt: job.attemptsMade + 1,
          backoffMs,
        });

        throw error; // BullMQ will handle retry with exponential backoff
      } else {
        logger.error('Order execution failed after max retries', {
          orderId: orderJob.orderId,
          error: errorMessage,
        });

        // Mark order as failed (handled in order processor)
        throw error;
      }
    }
  }

  async enqueueOrder(order: Order): Promise<string> {
    const jobData: OrderJob = {
      orderId: order.id,
      orderData: order,
      attempts: 0,
      maxAttempts: config.queue.retryMaxAttempts,
    };

    try {
      const job = await this.queue.add(jobData, {
        attempts: config.queue.retryMaxAttempts,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      });

      logger.info('Order enqueued', {
        orderId: order.id,
        jobId: job.id,
      });

      return job.id!;
    } catch (error) {
      logger.error('Failed to enqueue order', {
        orderId: order.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async getQueueStats() {
    const counts = await this.queue.getCountsPerPriority();
    const waitingCount = counts.waiting || 0;
    const activeCount = counts.active || 0;
    const completedCount = counts.completed || 0;
    const failedCount = counts.failed || 0;

    return {
      waitingCount,
      activeCount,
      completedCount,
      failedCount,
      concurrency: config.queue.maxConcurrent,
    };
  }

  async closeQueue(): Promise<void> {
    await this.queueEvents.close();
    await this.worker.close();
    await this.queue.close();
  }
}

export const queueManager = new QueueManager();
