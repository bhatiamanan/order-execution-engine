import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import { config } from './config/env';
import { connectRedis, closeRedis } from './config/redis';
import { pool, closePool, query } from './config/database';
import { logger } from './utils/logger';
import { registerOrderRoutes } from './routes/orders';
import { registerWebSocketRoutes } from './routes/websocket';
import fs from 'fs';
import path from 'path';

const fastify = Fastify({
  logger: false,
});

async function initializeDatabase() {
  try {
    logger.info('Initializing database...');

    // Check if tables exist
    const result = await query(
      `SELECT EXISTS(
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'orders'
      )`
    );

    if (!result.rows[0].exists) {
      logger.info('Creating database schema...');
      const schemaPath = path.join(__dirname, 'database', 'schema.sql');
      const schema = fs.readFileSync(schemaPath, 'utf-8');

      // Execute schema creation
      const statements = schema.split(';').filter(stmt => stmt.trim());
      for (const statement of statements) {
        if (statement.trim()) {
          await query(statement);
        }
      }

      logger.info('Database schema created successfully');
    } else {
      logger.info('Database schema already exists');
    }
  } catch (error) {
    logger.error('Database initialization error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

async function start() {
  try {
    // Connect to Redis
    await connectRedis();
    logger.info('Redis connected');

    // Initialize database
    await initializeDatabase();

    // Register plugins
    await fastify.register(fastifyWebsocket);

    // Register routes
    await registerOrderRoutes(fastify);
    await registerWebSocketRoutes(fastify);

    // Start server
    await fastify.listen({ port: config.port, host: '0.0.0.0' });
    logger.info('Server started', {
      port: config.port,
      environment: config.nodeEnv,
    });
  } catch (error) {
    logger.error('Server startup error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  try {
    await fastify.close();
    await closeRedis();
    await closePool();
    logger.info('Server shut down successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  try {
    await fastify.close();
    await closeRedis();
    await closePool();
    logger.info('Server shut down successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    process.exit(1);
  }
});

start().catch((error) => {
  logger.error('Failed to start server', {
    error: error instanceof Error ? error.message : 'Unknown error',
  });
  process.exit(1);
});
