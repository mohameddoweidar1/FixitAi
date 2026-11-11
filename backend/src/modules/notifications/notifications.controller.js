import * as service from './notifications.service.js';
import { ok } from '../../utils/apiResponse.js';

export async function list(req, res, next) {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit, 10) || 50;
    const [items, unreadCount] = await Promise.all([
      service.getUserNotifications(userId, limit),
      service.getUnreadCount(userId),
    ]);
    ok(res, { items, unreadCount });
  } catch (err) {
    next(err);
  }
}

export async function markRead(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    await service.markAsRead(userId, id);
    ok(res, { message: 'Notification marked as read' });
  } catch (err) {
    next(err);
  }
}

export async function markAllRead(req, res, next) {
  try {
    const userId = req.user.id;
    await service.markAllAsRead(userId);
    ok(res, { message: 'All notifications marked as read' });
  } catch (err) {
    next(err);
  }
}
