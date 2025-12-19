# Order Execution Engine

A high-performance market order execution engine with DEX routing, WebSocket status streaming, and concurrent order processing for the Solana blockchain.

## 🎯 Architecture Overview

### Why Market Orders?

We chose **Market Orders** for this implementation because they:
- **Execute immediately** at the best available market price (no waiting for target prices)
- **Minimize complexity** - focus on architecture and flow without complex order matching logic
- **Provide foundation** for extending to other order types

### Extensibility to Other Order Types

- **Limit Orders**: Add a price monitoring service that continuously checks market prices and executes when target price is reached
- **Sniper Orders**: Integrate token launch detection APIs and execute at launch with minimal delay, using pre-signed transactions for speed

---

## 🏗️ System Architecture

```
Client (Postman/Web)
       ↓
    POST /api/orders/execute (HTTP)
       ↓
[Fastify API Server]
       ├→ Returns: { orderId, wsUrl }
       └→ Enqueues order to BullMQ
            ↓
[Redis Cache] ← [BullMQ Queue] → [Order Processor Worker]
       ↓                              ↓
  Active Orders              1. Validate order
                            2. Fetch DEX quotes
                            3. Compare prices
                            4. Route to best DEX
                            5. Execute swap
                            6. Emit status updates
                                  ↓
                            [WebSocket Manager]
                                  ↓
                         [PostgreSQL Database]
                    (Orders, Executions, Failures)
```

---

## 📊 Order Execution Flow (State Machine)

```
pending → routing → building → submitted → confirmed
                                              ↓
                                          (+ txHash)
                                              
Any step → failed (+ error reason)
```

### Status Definitions
- **pending**: Order received and queued
- **routing**: Comparing DEX prices (Raydium vs Meteora)
- **building**: Creating transaction
- **submitted**: Transaction sent to mock network
- **confirmed**: Transaction successful (includes txHash)
- **failed**: Execution failed at any step (includes error reason)

---

## 🔄 DEX Routing Logic

The engine fetches quotes from both **Raydium** and **Meteora**:
1. Queries both DEX pools for the same token pair and amount
2. Compares output amounts (price impact, liquidity)
3. Selects DEX offering the best price
4. Routes order to selected DEX

### Mock Implementation Details
- Raydium: ~0.5% better rates (higher priority)
- Meteora: ~2% worse rates (secondary option)
- Realistic delay: 2-3 seconds per DEX query
- Price variations: 2-5% difference to simulate real market conditions

---

## 🚀 Tech Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Server** | Fastify + TypeScript | RESTful API + WebSocket |
| **Queue** | BullMQ + Redis | Concurrent order processing (max 10) |
| **Cache** | Redis | Active order state, quick lookups |
| **Database** | PostgreSQL | Orders, executions, failures |
| **Testing** | Jest + Supertest | Unit & integration tests |
| **Validation** | Zod | Input validation |
| **Decimals** | Decimal.js | Precise number handling |

---

## 📦 Installation

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis 7+
- Docker & Docker Compose (optional, for local setup)

### Quick Start with Docker

```bash
# Clone repository
git clone <repo-url>
cd order-execution-engine

# Copy environment file
cp .env.example .env

# Start PostgreSQL and Redis
docker-compose up -d

# Install dependencies
npm install

# Run database migrations
npm run db:migrate

# Start development server
npm run dev
```

### Manual Setup

```bash
# Install dependencies
npm install

# Configure PostgreSQL
createdb order_execution_engine
createuser postgres -P  # Set password

# Start Redis
redis-server

# Run migrations
npm run db:migrate

# Start server
npm run dev
```

Server runs on `http://localhost:3000`

---

## 📡 API Endpoints

### Submit Order
```bash
POST /api/orders/execute
Content-Type: application/json

{
  "userId": "user-123",
  "tokenIn": "So11111111111111111111111111111111111111112",  # SOL
  "tokenOut": "EPjFWaJiy6ePf60j6sPn6ZozD7Zb9T9r3BjnvG5LLPQ", # USDC
  "amountIn": "1.5",
  "minAmountOut": "140",
  "slippageTolerance": 0.5
}

Response (202 Accepted):
{
  "orderId": "uuid",
  "wsUrl": "/ws/uuid",
  "status": "pending",
  "createdAt": "2025-12-16T10:30:00Z"
}
```

### Get Order Status
```bash
GET /api/orders/{orderId}

Response:
{
  "id": "uuid",
  "userId": "user-123",
  "status": "confirmed",
  "dexSelected": "raydium",
  "txHash": "...",
  "executedPrice": "142.5",
  "createdAt": "2025-12-16T10:30:00Z",
  "completedAt": "2025-12-16T10:30:15Z"
}
```

### List User Orders
```bash
GET /api/orders?userId=user-123&limit=10&offset=0

Response:
{
  "orders": [...],
  "limit": 10,
  "offset": 0,
  "total": 25
}
```

### Queue Statistics
```bash
GET /api/queue/stats

Response:
{
  "waitingCount": 3,
  "activeCount": 2,
  "completedCount": 45,
  "failedCount": 1,
  "concurrency": 10
}
```

### WebSocket Connection
```bash
WebSocket /ws/{orderId}

# Incoming events
{
  "event": "status_update",
  "orderId": "uuid",
  "status": "routing",
  "data": {
    "dex": "raydium",
    "price": "142.5",
    "txHash": null
  },
  "timestamp": 1702717815000
}
```

---

## 📊 Database Schema

### Orders Table
```sql
- id (UUID, Primary Key)
- user_id (VARCHAR)
- token_in (VARCHAR - Solana address)
- token_out (VARCHAR - Solana address)
- amount_in (NUMERIC)
- min_amount_out (NUMERIC)
- slippage_tolerance (NUMERIC)
- status (VARCHAR - pending/routing/building/submitted/confirmed/failed)
- dex_selected (VARCHAR - raydium/meteora)
- tx_hash (VARCHAR)
- executed_price (NUMERIC)
- error_reason (TEXT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
- completed_at (TIMESTAMP)
```

### Order Executions Table
Tracks each execution attempt with inputs, outputs, and transaction hashes.

### Order Failures Table
Logs all failures for post-mortem analysis:
- Failure reason and error code
- Metadata (token pair, amounts, DEX info)
- Timestamp and attempt number

---

## 🔄 Queue & Concurrency Management

- **Max Concurrent Orders**: 10
- **Target Throughput**: 100 orders/minute
- **Retry Strategy**: Exponential backoff (3 attempts max)
- **Backoff Delays**: 1s → 2s → 4s (capped at 30s)
- **Job Cleanup**: Completed jobs removed, failed jobs persisted for analysis

---

## ✅ Testing

### Run All Tests
```bash
npm test
```

### Watch Mode
```bash
npm run test:watch
```

### Test Coverage
```bash
npm test -- --coverage
```

### Test Files
- `tests/unit/dex-router.test.ts` - DEX quote logic and routing decisions
- `tests/unit/order-processor.test.ts` - Order lifecycle and slippage handling
- `tests/unit/websocket-manager.test.ts` - WebSocket subscription and broadcasts
- `tests/unit/validators.test.ts` - Input validation and error handling
- `tests/unit/queue-manager.test.ts` - Queue configuration and statistics
- `tests/integration/order-flow.test.ts` - Full order execution flow
- `tests/integration/websocket.test.ts` - WebSocket lifecycle and concurrent clients

### Coverage Targets
- ✅ DEX routing logic (price comparison, DEX selection)
- ✅ Queue behavior (concurrent processing, retries, exponential backoff)
- ✅ WebSocket lifecycle (subscribe, broadcast, disconnect)
- ✅ Order validation and error handling
- ✅ Concurrent order processing

---

## 📮 Postman Collection

Import `Postman_Collection.json` to test:
- Single order flow
- 5 concurrent orders
- Error cases (validation, not found, invalid amounts)
- Queue and WebSocket statistics
- Order status polling

**Setup Variables in Postman:**
- `base_url`: `http://localhost:3000`
- `order_id`: Replace with actual order ID from responses

---

## 🐛 Error Handling & Retry Logic

### Exponential Backoff
```
Attempt 1: Immediate
Attempt 2: Wait 1 second + random jitter
Attempt 3: Wait 2 seconds + random jitter
(Max retries: 3, capped at 30 seconds)
```

### Error Persistence
All failures are recorded in `order_failures` table with:
- Error code and message
- Metadata (tokens, amounts)
- Attempt number and timestamp
- Available for post-mortem analysis

### Error Types
- `VALIDATION_ERROR` - Invalid order data
- `ROUTING_ERROR` - DEX routing failed
- `EXECUTION_ERROR` - Transaction building/submission failed
- `QUOTE_ERROR` - Unable to fetch quotes
- `QUEUE_ERROR` - Queue operation failed

---

## 📈 Performance Metrics

### Benchmarks
- **Order Submission**: < 100ms
- **DEX Quote**: ~2-3s (mock with realistic delay)
- **Total Execution Time**: ~8-10s per order
- **Concurrent Capacity**: 10 orders simultaneously
- **Throughput**: ~100 orders/minute

### Monitoring
Check `/api/queue/stats` and `/api/ws/stats` for:
- Active orders count
- Queue depth
- Completed and failed orders
- WebSocket connection count

---

## 🔐 Security Considerations

### For Production (Real Devnet Execution)
- **Private Keys**: Store in environment variables or secure vaults (never in code)
- **Rate Limiting**: Implement rate limiting per user/IP
- **Authentication**: Add JWT or API key authentication
- **Transaction Signing**: Use Solana SPL Token program safety checks
- **Slippage Limits**: Enforce maximum slippage per order

### Current Mock Implementation
- Safe for testing and demonstration
- No real transactions or private keys needed
- Realistic delays and price variations

---

## 📝 Logging

Logs include:
- Order submission and completion
- DEX routing decisions with reasoning
- Queue job processing (start, complete, fail, retry)
- WebSocket connections/disconnections
- Database operations
- Error tracking with timestamps

Configure log level via environment:
```bash
LOG_LEVEL=debug  # debug, info, warn, error
```

---

## 🤝 Contributing

1. Create feature branch: `git checkout -b feature/amazing-feature`
2. Commit changes: `git commit -m 'Add amazing feature'`
3. Push to branch: `git push origin feature/amazing-feature`
4. Open Pull Request

---

## 📄 License

MIT License - See LICENSE file for details

---

## 🆘 Troubleshooting

### PostgreSQL Connection Error
```bash
# Check if PostgreSQL is running
psql -U postgres -d order_execution_engine

# Reset database
dropdb order_execution_engine
createdb order_execution_engine
npm run db:migrate
```

### Redis Connection Error
```bash
# Check Redis
redis-cli ping

# Restart Redis
redis-server --daemonize yes
```

### Port Already in Use
```bash
# Change PORT in .env
PORT=3001
```

### WebSocket Not Connecting
- Ensure WebSocket plugin is loaded in Fastify
- Check firewall allows port 3000
- Verify orderId in WebSocket URL

---

## 📞 Support

For issues and questions:
1. Check logs: `tail -f app.log`
2. Review test cases in `tests/` directory
3. Check Postman collection for API examples
4. Review GitHub issues

---

**Last Updated**: December 16, 2025
**Version**: 1.0.0
**Status**: Production Ready (Mock Mode)
