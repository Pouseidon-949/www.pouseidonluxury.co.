import { Order, OrderStatus, OrderSide, TradeResult, LiquidityInfo } from '../types';
import { logger } from '../utils/logger';

export class OrderManager {
  private orders: Map<string, Order>;
  private orderHistory: Order[];
  private maxRetries: number;

  constructor(maxRetries: number = 3) {
    this.orders = new Map();
    this.orderHistory = [];
    this.maxRetries = maxRetries;
  }

  createOrder(
    pair: string,
    side: OrderSide,
    amount: number,
    price: number,
    slippageTolerance: number
  ): Order {
    const orderId = this.generateOrderId();
    const order: Order = {
      id: orderId,
      pair,
      side,
      amount,
      price,
      status: OrderStatus.PENDING,
      timestamp: Date.now(),
      slippageTolerance,
      retryCount: 0,
      maxRetries: this.maxRetries
    };

    this.orders.set(orderId, order);
    logger.info('Order created', {
      orderId,
      pair,
      side,
      amount,
      price
    });

    return order;
  }

  getOrder(orderId: string): Order | undefined {
    return this.orders.get(orderId);
  }

  updateOrderStatus(orderId: string, status: OrderStatus): void {
    const order = this.orders.get(orderId);
    if (order) {
      order.status = status;
      logger.info('Order status updated', { orderId, status });
    }
  }

  incrementRetryCount(orderId: string): boolean {
    const order = this.orders.get(orderId);
    if (order) {
      order.retryCount++;
      logger.info('Order retry count incremented', {
        orderId,
        retryCount: order.retryCount,
        maxRetries: order.maxRetries
      });
      return order.retryCount < order.maxRetries;
    }
    return false;
  }

  canRetry(orderId: string): boolean {
    const order = this.orders.get(orderId);
    return order ? order.retryCount < order.maxRetries : false;
  }

  completeOrder(orderId: string, result: TradeResult): void {
    const order = this.orders.get(orderId);
    if (order) {
      order.status = result.success ? OrderStatus.COMPLETED : OrderStatus.FAILED;
      this.orderHistory.push({ ...order });
      this.orders.delete(orderId);

      logger.info('Order completed and moved to history', {
        orderId,
        success: result.success,
        executedAmount: result.executedAmount,
        executedPrice: result.executedPrice
      });
    }
  }

  getActiveOrders(): Order[] {
    return Array.from(this.orders.values());
  }

  getOrderHistory(limit: number = 100): Order[] {
    return this.orderHistory.slice(-limit);
  }

  getOrdersByStatus(status: OrderStatus): Order[] {
    return Array.from(this.orders.values()).filter(order => order.status === status);
  }

  getOrdersByPair(pair: string): Order[] {
    return Array.from(this.orders.values()).filter(order => order.pair === pair);
  }

  clearCompletedOrders(): void {
    const completedOrders = this.getOrdersByStatus(OrderStatus.COMPLETED);
    completedOrders.forEach(order => {
      this.orderHistory.push({ ...order });
      this.orders.delete(order.id);
    });

    logger.info('Completed orders cleared', { count: completedOrders.length });
  }

  private generateOrderId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `ORD-${timestamp}-${random}`;
  }

  getOrderCount(): number {
    return this.orders.size;
  }

  getCompletedOrderCount(): number {
    return this.orderHistory.filter(order => order.status === OrderStatus.COMPLETED).length;
  }

  getFailedOrderCount(): number {
    return this.orderHistory.filter(order => order.status === OrderStatus.FAILED).length;
  }
}
