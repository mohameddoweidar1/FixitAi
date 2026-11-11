import {
  createBookingSchema, updateStatusSchema, adminUpdateStatusSchema,
  bookingIdParamSchema, bookingListQuerySchema, cancelBookingSchema
} from './bookings.schema.js';
import {
  createBooking, listClientBookings, listTechnicianBookings, listAllBookings,
  getBookingById, cancelBooking, updateBookingStatus, adminUpdateBookingStatus,
  getStatusHistory, payQuote as payBookingQuote
} from './bookings.service.js';
import { ok, fail } from '../../utils/apiResponse.js';

// ── Client: create booking ────────────────────────────────
export async function create(req, res, next) {
  try {
    const data = createBookingSchema.parse(req.body);
    const booking = await createBooking(req.user.id, data);
    return ok(res, { booking }, 'Booking created', 201);
  } catch (err) { return next(err); }
}

// ── Client: list own bookings ─────────────────────────────
export async function listMine(req, res, next) {
  try {
    const filters = bookingListQuerySchema.parse(req.query);
    const result = await listClientBookings(req.user.id, filters);
    return ok(res, result, 'Client bookings');
  } catch (err) { return next(err); }
}

// ── Any authenticated user: get booking by id ─────────────
export async function getById(req, res, next) {
  try {
    const { id } = bookingIdParamSchema.parse(req.params);
    const booking = await getBookingById(id);
    if (!booking) return fail(res, 'Booking not found', 404);
    
    // Access control
    const isClient = booking.clientId === req.user.id;
    const isTech = booking.technician?.userId === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isClient && !isTech && !isAdmin) {
      return fail(res, 'Access denied', 403);
    }

    return ok(res, { booking }, 'Booking details');
  } catch (err) { return next(err); }
}

// ── Client: cancel own booking ────────────────────────────
export async function cancel(req, res, next) {
  try {
    const { id } = bookingIdParamSchema.parse(req.params);
    const { cancellationNote } = cancelBookingSchema.parse(req.body ?? {});
    const booking = await cancelBooking(id, req.user.id, cancellationNote);
    return ok(res, { booking }, 'Booking cancelled');
  } catch (err) { return next(err); }
}

// ── Technician: list assigned bookings ────────────────────
export async function listForTechnician(req, res, next) {
  try {
    const filters = bookingListQuerySchema.parse(req.query);
    const result = await listTechnicianBookings(req.user.id, filters);
    return ok(res, result, 'Technician bookings');
  } catch (err) { return next(err); }
}

// ── Technician: accept / reject / in_progress / complete ──
export async function updateStatus(req, res, next) {
  try {
    const { id } = bookingIdParamSchema.parse(req.params);
    const { status } = updateStatusSchema.parse(req.body);
    const booking = await updateBookingStatus(id, req.user.id, status);
    return ok(res, { booking }, `Booking marked as ${status}`);
  } catch (err) { return next(err); }
}

export async function payQuote(req, res, next) {
  try {
    const { id } = bookingIdParamSchema.parse(req.params);
    const booking = await payBookingQuote(id, req.user.id);
    return ok(res, { booking }, 'Payment successful and reserved');
  } catch (err) { return next(err); }
}

// ── Admin: list all bookings ──────────────────────────────
export async function listAll(req, res, next) {
  try {
    const filters = bookingListQuerySchema.parse(req.query);
    const result = await listAllBookings(filters);
    return ok(res, result, 'All bookings');
  } catch (err) { return next(err); }
}

// ── Admin: override booking status ────────────────────────
export async function adminUpdateStatus(req, res, next) {
  try {
    const { id } = bookingIdParamSchema.parse(req.params);
    const { status } = adminUpdateStatusSchema.parse(req.body);
    const booking = await adminUpdateBookingStatus(id, status, req.user.id);
    return ok(res, { booking }, `Booking status set to ${status} (admin)`);
  } catch (err) { return next(err); }
}

// ── Status History ────────────────────────────────────────
export async function getHistory(req, res, next) {
  try {
    const { id } = bookingIdParamSchema.parse(req.params);
    const history = await getStatusHistory(id);
    return ok(res, { history }, 'Booking status history');
  } catch (err) { return next(err); }
}
