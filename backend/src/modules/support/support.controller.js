import {
  idParamSchema, notificationListQuerySchema,
  createDisputeSchema, resolveDisputeSchema, disputeListQuerySchema,
  createSessionSchema, addMessageSchema,
} from './support.schema.js';
import {
  listUserNotifications, markAsRead, markAllRead,
  createDispute, listDisputes, getDisputeById, resolveDispute,
  createSession, listSessions, addMessage, listMessages,
} from './support.service.js';
import { ok, fail } from '../../utils/apiResponse.js';

// ── Notifications ─────────────────────────────────────────
export async function getNotifications(req, res, next) {
  try {
    const filters = notificationListQuerySchema.parse(req.query);
    const result = await listUserNotifications(req.user.id, filters);
    return ok(res, result, 'Notifications');
  } catch (err) { return next(err); }
}

export async function readNotification(req, res, next) {
  try {
    const { id } = idParamSchema.parse(req.params);
    await markAsRead(id, req.user.id);
    return ok(res, null, 'Notification marked as read');
  } catch (err) { return next(err); }
}

export async function readAllNotifications(req, res, next) {
  try {
    await markAllRead(req.user.id);
    return ok(res, null, 'All notifications marked as read');
  } catch (err) { return next(err); }
}

// ── Disputes ──────────────────────────────────────────────
export async function createDisputeHandler(req, res, next) {
  try {
    const data = createDisputeSchema.parse(req.body);
    const dispute = await createDispute(req.user.id, data);
    return ok(res, { dispute }, 'Dispute created', 201);
  } catch (err) { return next(err); }
}

export async function listDisputesHandler(req, res, next) {
  try {
    const filters = disputeListQuerySchema.parse(req.query);
    const result = await listDisputes(filters);
    return ok(res, result, 'Disputes');
  } catch (err) { return next(err); }
}

export async function getDisputeHandler(req, res, next) {
  try {
    const { id } = idParamSchema.parse(req.params);
    const dispute = await getDisputeById(id);
    if (!dispute) return fail(res, 'Dispute not found', 404);
    return ok(res, { dispute }, 'Dispute details');
  } catch (err) { return next(err); }
}

export async function resolveDisputeHandler(req, res, next) {
  try {
    const { id } = idParamSchema.parse(req.params);
    const data = resolveDisputeSchema.parse(req.body);
    const dispute = await resolveDispute(id, req.user.id, data);
    return ok(res, { dispute }, 'Dispute resolved');
  } catch (err) { return next(err); }
}

// ── Chat ──────────────────────────────────────────────────
export async function createSessionHandler(req, res, next) {
  try {
    const { title } = createSessionSchema.parse(req.body ?? {});
    const session = await createSession(req.user.id, title);
    return ok(res, { session }, 'Chat session created', 201);
  } catch (err) { return next(err); }
}

export async function listSessionsHandler(req, res, next) {
  try {
    const sessions = await listSessions(req.user.id);
    return ok(res, { sessions }, 'Chat sessions');
  } catch (err) { return next(err); }
}

export async function addMessageHandler(req, res, next) {
  try {
    const { id } = idParamSchema.parse(req.params);
    const data = addMessageSchema.parse(req.body);
    const message = await addMessage(id, req.user.id, data);
    return ok(res, { message }, 'Message sent', 201);
  } catch (err) { return next(err); }
}

export async function listMessagesHandler(req, res, next) {
  try {
    const { id } = idParamSchema.parse(req.params);
    const messages = await listMessages(id, req.user.id);
    return ok(res, { messages }, 'Messages');
  } catch (err) { return next(err); }
}
