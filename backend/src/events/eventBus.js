import { EventEmitter } from 'events';

class EventBus extends EventEmitter {}

export const eventBus = new EventBus();

// Basic event names to keep it structured
export const EVENTS = {
  BOOKING_CREATED: 'booking:created',
  BOOKING_STATUS_CHANGED: 'booking:status_changed',
  WALLET_TOP_UP: 'wallet:top_up',
  WALLET_WITHDRAWAL: 'wallet:withdrawal',
  PAYMENT_PROCESSED: 'payment:processed',
  REFUND_PROCESSED: 'refund:processed'
};
