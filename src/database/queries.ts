import { query } from '../config/database';
import { Order, OrderStatus } from '../types/order';
import { v4 as uuidv4 } from 'uuid';

export async function createOrder(order: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>): Promise<Order> {
  const id = uuidv4();
  const result = await query(
    `INSERT INTO orders (
      id, user_id, token_in, token_out, amount_in, min_amount_out,
      slippage_tolerance, status, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *`,
    [
      id,
      order.userId,
      order.tokenIn,
      order.tokenOut,
      order.amountIn,
      order.minAmountOut,
      order.slippageTolerance,
      order.status,
      new Date(),
      new Date(),
    ]
  );
  return result.rows[0];
}

export async function getOrder(orderId: string): Promise<Order | null> {
  const result = await query(
    'SELECT * FROM orders WHERE id = $1',
    [orderId]
  );
  return result.rows[0] || null;
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  data?: Partial<Order>
): Promise<Order> {
  const updates = { status, updatedAt: new Date(), ...data };
  const keys = Object.keys(updates);
  const values = Object.values(updates);

  const setClause = keys
    .map((key, index) => {
      const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      return `${dbKey} = $${index + 1}`;
    })
    .join(', ');

  const result = await query(
    `UPDATE orders SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`,
    [...values, orderId]
  );

  return result.rows[0];
}

export async function getOrdersByUser(userId: string, limit = 50, offset = 0): Promise<Order[]> {
  const result = await query(
    'SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
    [userId, limit, offset]
  );
  return result.rows;
}

export async function getOrdersByStatus(status: OrderStatus, limit = 50): Promise<Order[]> {
  const result = await query(
    'SELECT * FROM orders WHERE status = $1 ORDER BY created_at DESC LIMIT $2',
    [status, limit]
  );
  return result.rows;
}

export async function recordExecution(
  orderId: string,
  dex: string,
  inputAmount: string,
  outputAmount: string | null,
  txHash: string | null,
  status: string,
  errorReason: string | null
): Promise<void> {
  await query(
    `INSERT INTO order_executions (
      id, order_id, dex, input_amount, output_amount, tx_hash, status, error_reason, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      uuidv4(),
      orderId,
      dex,
      inputAmount,
      outputAmount,
      txHash,
      status,
      errorReason,
      new Date(),
    ]
  );
}

export async function recordFailure(
  orderId: string,
  attemptNumber: number,
  reason: string,
  errorCode: string,
  metadata: any = {}
): Promise<void> {
  await query(
    `INSERT INTO order_failures (
      id, order_id, attempt_number, reason, error_code, metadata, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      uuidv4(),
      orderId,
      attemptNumber,
      reason,
      errorCode,
      JSON.stringify(metadata),
      new Date(),
    ]
  );
}

export async function getFailuresByOrder(orderId: string): Promise<any[]> {
  const result = await query(
    'SELECT * FROM order_failures WHERE order_id = $1 ORDER BY created_at ASC',
    [orderId]
  );
  return result.rows;
}
