import { z } from 'zod';

// ── Params ────────────────────────────────────────────────
export const idParamSchema = z.object({
  id: z.string().uuid('Invalid id'),
});

// ── Query: product list filters ───────────────────────────
export const productListQuerySchema = z.object({
  category: z.string().uuid().optional(),
  search: z.string().trim().min(1).max(120).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// ── Query: order list filters ─────────────────────────────
export const orderListQuerySchema = z.object({
  status: z.enum(['pending', 'paid', 'shipped', 'completed', 'cancelled']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// ── Body: create order ────────────────────────────────────
export const createOrderSchema = z.object({
  items: z.array(z.object({
    productId: z.string().uuid('Invalid product id'),
    quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1').max(99),
  })).min(1, 'Order must have at least one item').max(50, 'Too many items'),
  shippingAddress: z.string().trim().max(500).optional().default(''),
});

// ── Cart ──────────────────────────────────────────────────
export const addToCartSchema = z.object({
  productId: z.string().uuid('Invalid product id'),
  quantity: z.coerce.number().int().min(1).max(99).default(1),
});

export const updateCartSchema = z.object({
  quantity: z.coerce.number().int().min(0).max(99),
});

// ── Body: create payment (order) ──────────────────────────
export const createOrderPaymentSchema = z.object({
  orderId: z.string().uuid('Invalid order id'),
  method: z.enum(['card', 'cash', 'wallet']).optional().default('card'),
  promoCode: z.string().trim().min(1).max(50).optional(),
});

// ── Body: create payment (booking) ────────────────────────
export const createBookingPaymentSchema = z.object({
  bookingId: z.string().uuid('Invalid booking id'),
  amount: z.coerce.number().min(0, 'Amount cannot be negative'),
  method: z.enum(['card', 'cash', 'wallet']).optional().default('card'),
  promoCode: z.string().trim().min(1).max(50).optional(),
});
