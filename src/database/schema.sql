-- Drop existing tables (for fresh migrations)
DROP TABLE IF EXISTS order_failures CASCADE;
DROP TABLE IF EXISTS order_executions CASCADE;
DROP TABLE IF EXISTS orders CASCADE;

-- Create orders table
CREATE TABLE orders (
  id UUID PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  token_in VARCHAR(88) NOT NULL,
  token_out VARCHAR(88) NOT NULL,
  amount_in NUMERIC(30, 8) NOT NULL,
  min_amount_out NUMERIC(30, 8) NOT NULL,
  slippage_tolerance NUMERIC(5, 2) NOT NULL DEFAULT 0.5,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  dex_selected VARCHAR(50),
  tx_hash VARCHAR(255),
  executed_price NUMERIC(30, 18),
  error_reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

-- Create order_executions table for tracking execution attempts
CREATE TABLE order_executions (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  dex VARCHAR(50) NOT NULL,
  input_amount NUMERIC(30, 8) NOT NULL,
  output_amount NUMERIC(30, 8),
  tx_hash VARCHAR(255),
  status VARCHAR(50) NOT NULL,
  error_reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create order_failures table for post-mortem analysis
CREATE TABLE order_failures (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  attempt_number INT NOT NULL,
  reason TEXT NOT NULL,
  error_code VARCHAR(100),
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_order_executions_order_id ON order_executions(order_id);
CREATE INDEX idx_order_executions_dex ON order_executions(dex);
CREATE INDEX idx_order_failures_order_id ON order_failures(order_id);
