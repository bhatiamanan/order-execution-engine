export class OrderExecutionError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'OrderExecutionError';
  }
}

export class OrderNotFoundError extends OrderExecutionError {
  constructor(orderId: string) {
    super('ORDER_NOT_FOUND', `Order ${orderId} not found`, 404);
    this.name = 'OrderNotFoundError';
  }
}

export class RoutingError extends OrderExecutionError {
  constructor(message: string) {
    super('ROUTING_ERROR', message, 500);
    this.name = 'RoutingError';
  }
}

export class ExecutionError extends OrderExecutionError {
  constructor(message: string) {
    super('EXECUTION_ERROR', message, 500);
    this.name = 'ExecutionError';
  }
}

export class ValidationError extends OrderExecutionError {
  constructor(message: string) {
    super('VALIDATION_ERROR', message, 400);
    this.name = 'ValidationError';
  }
}

export class QuoteError extends OrderExecutionError {
  constructor(message: string) {
    super('QUOTE_ERROR', message, 500);
    this.name = 'QuoteError';
  }
}

export class QueueError extends OrderExecutionError {
  constructor(message: string) {
    super('QUEUE_ERROR', message, 500);
    this.name = 'QueueError';
  }
}
