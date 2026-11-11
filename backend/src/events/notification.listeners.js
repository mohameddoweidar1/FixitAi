import { eventBus, EVENTS } from './eventBus.js';
import { createNotification } from '../modules/notifications/notifications.service.js';

export function registerNotificationListeners() {
  eventBus.on(EVENTS.BOOKING_CREATED, async ({ userId, serviceTitle, bookingId }) => {
    if (!userId) return;
    try {
      await createNotification(userId, 'New Booking Request', `You have a new booking request for: ${serviceTitle}`, 'booking', 'booking', bookingId);
    } catch (err) {
      console.error('Failed to create notification for BOOKING_CREATED', err);
    }
  });

  eventBus.on(EVENTS.BOOKING_STATUS_CHANGED, async ({ userId, serviceTitle, status, bookingId }) => {
    if (!userId) return;
    try {
      await createNotification(userId, 'Booking Update', `Your booking "${serviceTitle}" is now ${status}.`, 'booking', 'booking', bookingId);
    } catch (err) {
      console.error('Failed to create notification for BOOKING_STATUS_CHANGED', err);
    }
  });

  eventBus.on(EVENTS.WALLET_TOP_UP, async ({ userId, amount }) => {
    if (!userId) return;
    try {
      await createNotification(userId, 'Wallet Top-Up', `Successfully added $${amount.toFixed(2)} to your wallet.`);
    } catch (err) {
      console.error('Failed to create notification for WALLET_TOP_UP', err);
    }
  });

  eventBus.on(EVENTS.WALLET_WITHDRAWAL, async ({ userId, amount }) => {
    if (!userId) return;
    try {
      await createNotification(userId, 'Wallet Withdrawal', `Successfully withdrew $${amount.toFixed(2)} from your wallet.`);
    } catch (err) {
      console.error('Failed to create notification for WALLET_WITHDRAWAL', err);
    }
  });

  eventBus.on(EVENTS.PAYMENT_PROCESSED, async ({ userId, amount, isTechnician }) => {
    if (!userId) return;
    try {
      const msg = isTechnician 
        ? `You received a payment of $${amount.toFixed(2)}.` 
        : `Payment of $${amount.toFixed(2)} successful.`;
      await createNotification(userId, 'Payment Processed', msg);
    } catch (err) {
      console.error('Failed to create notification for PAYMENT_PROCESSED', err);
    }
  });

  eventBus.on(EVENTS.REFUND_PROCESSED, async ({ userId, amount }) => {
    if (!userId) return;
    try {
      await createNotification(userId, 'Refund Processed', `A refund of $${amount.toFixed(2)} has been credited to your wallet.`);
    } catch (err) {
      console.error('Failed to create notification for REFUND_PROCESSED', err);
    }
  });
}
