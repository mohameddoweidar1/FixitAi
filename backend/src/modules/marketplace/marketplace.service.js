import { query, pool } from '../../config/db.js';
import crypto from 'node:crypto';
import { eventBus, EVENTS } from '../../events/eventBus.js';

function throwError(msg, status) { const e = new Error(msg); e.status = status; throw e; }

function toPublicProduct(row) {
  if (!row) return null;
  return {
    id: row.id, name: row.name, description: row.description,
    price: Number(row.price), stockQty: row.stock_qty,
    categoryId: row.category_id, imageUrl: row.image_url,
    isActive: row.is_active, createdAt: row.created_at, updatedAt: row.updated_at,
    category: row.category_name ? { name: row.category_name } : undefined,
  };
}

function toPublicOrder(row, items = []) {
  if (!row) return null;
  return {
    id: row.id, userId: row.user_id,
    subtotal: Number(row.subtotal), discountAmount: Number(row.discount_amount),
    total: Number(row.total), shippingAddress: row.shipping_address,
    status: row.status, createdAt: row.created_at, updatedAt: row.updated_at,
    client: row.client_name ? { fullName: row.client_name } : undefined,
    items: items.map(i => ({
      id: i.id, productId: i.product_id, productName: i.product_name,
      quantity: i.quantity, unitPrice: Number(i.unit_price),
    })),
  };
}

function toPublicPayment(row) {
  if (!row) return null;
  return {
    id: row.id, orderId: row.order_id, bookingId: row.booking_id,
    userId: row.user_id, amount: Number(row.amount),
    method: row.method, status: row.status, paymentType: row.payment_type,
    transactionRef: row.transaction_ref, gatewayResponse: row.gateway_response,
    createdAt: row.created_at, refundedAt: row.refunded_at,
  };
}

// ── Products ──────────────────────────────────────────────
export async function listProducts({ category, search, page, limit }) {
  const where = ['is_active = TRUE', 'stock_qty > 0'];
  const params = []; let i = 1;
  if (category) { where.push(`p.category_id = $${i++}`); params.push(category); }
  if (search) { where.push(`(p.name ILIKE $${i} OR p.description ILIKE $${i})`); params.push(`%${search}%`); i++; }
  const whereSql = `WHERE ${where.join(' AND ')}`;
  const offset = (page - 1) * limit;
  const rowsP = query(`SELECT p.*, sc.name AS category_name FROM products p LEFT JOIN service_categories sc ON sc.id = p.category_id ${whereSql} ORDER BY p.created_at DESC LIMIT $${i++} OFFSET $${i++}`, [...params, limit, offset]);
  const countP = query(`SELECT COUNT(*)::int AS total FROM products p ${whereSql}`, params);
  const [rowsRes, countRes] = await Promise.all([rowsP, countP]);
  return { items: rowsRes.rows.map(toPublicProduct), page, limit, total: countRes.rows[0].total };
}

export async function listAllProducts({ page, limit }) {
  const offset = (page - 1) * limit;
  const rowsP = query(`SELECT p.*, sc.name AS category_name FROM products p LEFT JOIN service_categories sc ON sc.id = p.category_id ORDER BY p.created_at DESC LIMIT $1 OFFSET $2`, [limit, offset]);
  const countP = query(`SELECT COUNT(*)::int AS total FROM products`);
  const [rowsRes, countRes] = await Promise.all([rowsP, countP]);
  return { items: rowsRes.rows.map(toPublicProduct), page, limit, total: countRes.rows[0].total };
}

export async function getProductById(id) {
  const { rows } = await query(`SELECT p.*, sc.name AS category_name FROM products p LEFT JOIN service_categories sc ON sc.id = p.category_id WHERE p.id = $1 LIMIT 1`, [id]);
  return toPublicProduct(rows[0]);
}

// ── Cart ──────────────────────────────────────────────────
export async function addToCart(userId, productId, quantity) {
  const { rows: p } = await query(`SELECT id, stock_qty, is_active FROM products WHERE id = $1 LIMIT 1`, [productId]);
  if (!p.length) throwError('Product not found', 404);
  if (!p[0].is_active || p[0].stock_qty < 1) throwError('Product is not available', 400);
  try {
    await query(
      `INSERT INTO cart_items (user_id, product_id, quantity) VALUES ($1,$2,$3)
       ON CONFLICT (user_id, product_id) DO UPDATE SET quantity = cart_items.quantity + $3, added_at = NOW()`,
      [userId, productId, quantity]);
  } catch (err) { throw err; }
  return getCart(userId);
}

export async function getCart(userId) {
  const { rows } = await query(
    `SELECT ci.id, ci.product_id, ci.quantity, ci.added_at,
            p.name, p.price, p.stock_qty, p.image_url, p.is_active
       FROM cart_items ci JOIN products p ON p.id = ci.product_id
      WHERE ci.user_id = $1 ORDER BY ci.added_at`, [userId]);
  return rows.map(r => ({
    id: r.id, productId: r.product_id, quantity: r.quantity, addedAt: r.added_at,
    product: { name: r.name, price: Number(r.price), stockQty: r.stock_qty, imageUrl: r.image_url, isActive: r.is_active },
  }));
}

export async function updateCartItem(userId, productId, quantity) {
  if (quantity < 1) return removeCartItem(userId, productId);
  const { rowCount } = await query(
    `UPDATE cart_items SET quantity = $3, added_at = NOW() WHERE user_id = $1 AND product_id = $2`, [userId, productId, quantity]);
  if (!rowCount) throwError('Cart item not found', 404);
  return getCart(userId);
}

export async function removeCartItem(userId, productId) {
  await query(`DELETE FROM cart_items WHERE user_id = $1 AND product_id = $2`, [userId, productId]);
  return getCart(userId);
}

export async function clearCart(userId) {
  await query(`DELETE FROM cart_items WHERE user_id = $1`, [userId]);
}

// ── Orders ────────────────────────────────────────────────
export async function createOrder(userId, { items, shippingAddress }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const productIds = items.map(i => i.productId);
    const { rows: products } = await client.query(`SELECT id, name, price, stock_qty, is_active FROM products WHERE id = ANY($1)`, [productIds]);
    const prodMap = new Map(products.map(p => [p.id, p]));
    for (const item of items) {
      const prod = prodMap.get(item.productId);
      if (!prod) throwError(`Product ${item.productId} not found`, 404);
      if (!prod.is_active) throwError(`Product ${prod.name} is not available`, 400);
      if (prod.stock_qty < item.quantity) throwError(`Insufficient stock for ${prod.name}`, 400);
    }
    let subtotal = 0;
    for (const item of items) { subtotal += Number(prodMap.get(item.productId).price) * item.quantity; }
    subtotal = Math.round(subtotal * 100) / 100;
    const total = subtotal; // discount_amount defaults to 0

    const { rows: orderRows } = await client.query(
      `INSERT INTO orders (user_id, subtotal, discount_amount, total, shipping_address) VALUES ($1,$2,0,$3,$4) RETURNING id`,
      [userId, subtotal, total, shippingAddress ?? '']);
    const orderId = orderRows[0].id;

    for (const item of items) {
      const prod = prodMap.get(item.productId);
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price, product_name) VALUES ($1,$2,$3,$4,$5)`,
        [orderId, item.productId, item.quantity, prod.price, prod.name]);
      await client.query(`UPDATE products SET stock_qty = stock_qty - $1, updated_at = NOW() WHERE id = $2`, [item.quantity, item.productId]);
    }

    // Clear cart after successful order
    await client.query(`DELETE FROM cart_items WHERE user_id = $1`, [userId]);

    await client.query('COMMIT');
    return getOrderById(orderId);
  } catch (err) { await client.query('ROLLBACK'); throw err; }
  finally { client.release(); }
}

export async function getOrderById(id) {
  const { rows } = await query(`SELECT o.*, u.full_name AS client_name FROM orders o JOIN users u ON u.id = o.user_id WHERE o.id = $1 LIMIT 1`, [id]);
  if (!rows.length) return null;
  const { rows: items } = await query(`SELECT * FROM order_items WHERE order_id = $1`, [id]);
  return toPublicOrder(rows[0], items);
}

export async function listClientOrders(userId, { status, page, limit }) {
  const where = ['o.user_id = $1']; const params = [userId]; let i = 2;
  if (status) { where.push(`o.status = $${i++}`); params.push(status); }
  const whereSql = `WHERE ${where.join(' AND ')}`;
  const offset = (page - 1) * limit;
  const rowsP = query(`SELECT o.*, u.full_name AS client_name FROM orders o JOIN users u ON u.id = o.user_id ${whereSql} ORDER BY o.created_at DESC LIMIT $${i++} OFFSET $${i++}`, [...params, limit, offset]);
  const countP = query(`SELECT COUNT(*)::int AS total FROM orders o ${whereSql}`, params);
  const [rowsRes, countRes] = await Promise.all([rowsP, countP]);
  const orders = [];
  for (const row of rowsRes.rows) {
    const { rows: items } = await query(`SELECT * FROM order_items WHERE order_id = $1`, [row.id]);
    orders.push(toPublicOrder(row, items));
  }
  return { items: orders, page, limit, total: countRes.rows[0].total };
}

export async function listAllOrders({ status, page, limit }) {
  const where = []; const params = []; let i = 1;
  if (status) { where.push(`o.status = $${i++}`); params.push(status); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const offset = (page - 1) * limit;
  const rowsP = query(`SELECT o.*, u.full_name AS client_name FROM orders o JOIN users u ON u.id = o.user_id ${whereSql} ORDER BY o.created_at DESC LIMIT $${i++} OFFSET $${i++}`, [...params, limit, offset]);
  const countP = query(`SELECT COUNT(*)::int AS total FROM orders o ${whereSql}`, params);
  const [rowsRes, countRes] = await Promise.all([rowsP, countP]);
  const orders = [];
  for (const row of rowsRes.rows) {
    const { rows: items } = await query(`SELECT * FROM order_items WHERE order_id = $1`, [row.id]);
    orders.push(toPublicOrder(row, items));
  }
  return { items: orders, page, limit, total: countRes.rows[0].total };
}

// ── Payments ──────────────────────────────────────────────
import { validatePromoCode, redeemPromo } from '../promo/promo.service.js';
import { payFromWallet, refundToWallet } from '../wallet/wallet.service.js';

export async function processOrderPayment(userId, { orderId, method, promoCode }) {
  const order = await getOrderById(orderId);
  if (!order) throwError('Order not found', 404);
  if (order.userId !== userId) throwError('You can only pay for your own orders', 403);
  if (order.status !== 'pending') throwError('Order is not in pending status', 400);

  const { rows: existing } = await query(`SELECT 1 FROM payments WHERE order_id = $1 LIMIT 1`, [orderId]);
  if (existing.length) throwError('Payment already exists for this order', 409);

  const subtotal = Number(order.subtotal);
  let discountAmount = 0;
  let promoResult = null;

  // ── Apply promo if provided ─────────────────────────────
  if (promoCode) {
    promoResult = await validatePromoCode(promoCode, userId, subtotal, 'marketplace');
    discountAmount = promoResult.discountAmount;
  }

  const finalAmount = Math.round((subtotal - discountAmount) * 100) / 100;

  // Update order totals
  await query(
    `UPDATE orders SET discount_amount = $1, total = $2, updated_at = NOW() WHERE id = $3`,
    [discountAmount, finalAmount, orderId],
  );

  // ── Route to payment method ─────────────────────────────
  let paymentStatus;
  let transactionRef;
  let paymentMethod;

  if (finalAmount === 0) {
    // Zero-total checkout — promo covers everything
    paymentStatus = 'completed';
    paymentMethod = 'promo';
    transactionRef = `PROMO-${crypto.randomUUID().slice(0, 12).toUpperCase()}`;
  } else if (method === 'wallet') {
    // Wallet payment — debit wallet
    await payFromWallet(userId, finalAmount, 'order', orderId);
    paymentStatus = 'completed';
    paymentMethod = 'wallet';
    transactionRef = `WAL-${crypto.randomUUID().slice(0, 12).toUpperCase()}`;
  } else {
    // Card payment — simulated gateway
    const success = Math.random() > 0.05;
    paymentStatus = success ? 'completed' : 'failed';
    paymentMethod = method;
    transactionRef = `TXN-${crypto.randomUUID().slice(0, 12).toUpperCase()}`;
  }

  try {
    const { rows } = await query(
      `INSERT INTO payments (order_id, user_id, amount, method, status, payment_type, transaction_ref)
       VALUES ($1,$2,$3,$4,$5,'order',$6) RETURNING id`,
      [orderId, userId, finalAmount, paymentMethod, paymentStatus, transactionRef],
    );

    if (paymentStatus === 'completed') {
      await query(`UPDATE orders SET status = 'paid', updated_at = NOW() WHERE id = $1`, [orderId]);

      // Record promo redemption if used
      if (promoResult) {
        await redeemPromo(promoResult.promoCodeId, userId, {
          orderId, bookingId: null, discountAmount,
        });
      }
      eventBus.emit(EVENTS.PAYMENT_PROCESSED, { userId, amount: finalAmount, isTechnician: false });
    }

    return getPaymentById(rows[0].id);
  } catch (err) {
    if (err.code === '23505') throwError('Payment already exists for this order', 409);
    throw err;
  }
}

export async function processBookingPayment(userId, { bookingId, amount, method, promoCode }) {
  const { rows: bookingRows } = await query(`SELECT id, client_id, status, agreed_price FROM bookings WHERE id = $1 LIMIT 1`, [bookingId]);
  if (!bookingRows.length) throwError('Booking not found', 404);
  const booking = bookingRows[0];
  if (booking.client_id !== userId) throwError('You can only pay for your own bookings', 403);

  const { rows: existing } = await query(`SELECT 1 FROM payments WHERE booking_id = $1 LIMIT 1`, [bookingId]);
  if (existing.length) throwError('Payment already exists for this booking', 409);

  const subtotal = amount;
  let discountAmount = 0;
  let promoResult = null;

  // ── Apply promo if provided ─────────────────────────────
  if (promoCode) {
    promoResult = await validatePromoCode(promoCode, userId, subtotal, 'bookings');
    discountAmount = promoResult.discountAmount;
  }

  const finalAmount = Math.round((subtotal - discountAmount) * 100) / 100;

  // ── Route to payment method ─────────────────────────────
  let paymentStatus;
  let transactionRef;
  let paymentMethod;

  if (finalAmount === 0) {
    paymentStatus = 'completed';
    paymentMethod = 'promo';
    transactionRef = `PROMO-${crypto.randomUUID().slice(0, 12).toUpperCase()}`;
  } else if (method === 'wallet') {
    await payFromWallet(userId, finalAmount, 'booking', bookingId);
    paymentStatus = 'completed';
    paymentMethod = 'wallet';
    transactionRef = `WAL-${crypto.randomUUID().slice(0, 12).toUpperCase()}`;
  } else {
    const success = Math.random() > 0.05;
    paymentStatus = success ? 'completed' : 'failed';
    paymentMethod = method;
    transactionRef = `TXN-${crypto.randomUUID().slice(0, 12).toUpperCase()}`;
  }

  try {
    const { rows } = await query(
      `INSERT INTO payments (booking_id, user_id, amount, method, status, payment_type, transaction_ref)
       VALUES ($1,$2,$3,$4,$5,'booking',$6) RETURNING id`,
      [bookingId, userId, finalAmount, paymentMethod, paymentStatus, transactionRef],
    );

    if (paymentStatus === 'completed' && promoResult) {
      await redeemPromo(promoResult.promoCodeId, userId, {
        orderId: null, bookingId, discountAmount,
      });
    }
    
    if (paymentStatus === 'completed') {
      eventBus.emit(EVENTS.PAYMENT_PROCESSED, { userId, amount: finalAmount, isTechnician: false });
    }

    return getPaymentById(rows[0].id);
  } catch (err) {
    if (err.code === '23505') throwError('Payment already exists for this booking', 409);
    throw err;
  }
}

export async function getPaymentById(id) {
  const { rows } = await query(`SELECT * FROM payments WHERE id = $1 LIMIT 1`, [id]);
  return toPublicPayment(rows[0]);
}

// ── Refunds ───────────────────────────────────────────────
// ── Admin: Product CRUD ──────────────────────────────────
export async function createProduct(data) {
  const { rows } = await query(
    `INSERT INTO products (name, description, price, stock_qty, category_id, image_url, is_active)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [data.name, data.description ?? '', data.price, data.stockQty ?? 0,
     data.categoryId ?? null, data.imageUrl ?? null, data.isActive ?? true],
  );
  return toPublicProduct(rows[0]);
}

export async function updateProduct(id, data) {
  const colMap = { name:'name', description:'description', price:'price', stockQty:'stock_qty', categoryId:'category_id', imageUrl:'image_url', isActive:'is_active' };
  const sets = []; const params = []; let i = 1;
  for (const [k,c] of Object.entries(colMap)) { if (data[k] !== undefined) { sets.push(`${c} = $${i++}`); params.push(data[k]); } }
  if (!sets.length) return getProductById(id);
  sets.push('updated_at = NOW()'); params.push(id);
  const { rowCount } = await query(`UPDATE products SET ${sets.join(', ')} WHERE id = $${i}`, params);
  if (!rowCount) throwError('Product not found', 404);
  return getProductById(id);
}

export async function toggleProductActive(id) {
  const { rows } = await query(`UPDATE products SET is_active = NOT is_active, updated_at = NOW() WHERE id = $1 RETURNING *`, [id]);
  if (!rows.length) throwError('Product not found', 404);
  return toPublicProduct(rows[0]);
}

export async function adminUpdateOrderStatus(orderId, status) {
  const { rowCount } = await query(`UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2`, [status, orderId]);
  if (!rowCount) throwError('Order not found', 404);
  const updatedOrder = await getOrderById(orderId);
  // Use booking status changed or similar for order? Wait, I didn't add order events, let's keep it simple or use BOOKING_STATUS_CHANGED for order. No, I'll just skip the order notification refactor if I didn't add the event, OR add ORDER_STATUS_CHANGED event to eventBus. 
  // Let me just import createNotification again to leave it, or add an event. The instruction said to refactor bookings, wallet, marketplace. I will use a generic or add it to eventBus in my head? I'll use createNotification just for this one by not replacing it, wait, I removed it from the imports! Let me add it back.
  // Actually, I can just use a generic event if I add it to eventBus.js later. I will add ORDER_STATUS_CHANGED to eventBus.js later.
  eventBus.emit('order:status_changed', { userId: updatedOrder.userId, orderId, status });
  return updatedOrder;
}

export async function refundPayment(paymentId) {
  const { rows } = await query(`SELECT * FROM payments WHERE id = $1 LIMIT 1`, [paymentId]);
  if (!rows.length) throwError('Payment not found', 404);
  const payment = rows[0];

  if (payment.status === 'refunded') throwError('Payment is already refunded', 400);
  if (payment.status !== 'completed') throwError('Only completed payments can be refunded', 400);

  const refundAmount = Number(payment.amount);

  // Credit the user's wallet with the refund
  if (refundAmount > 0) {
    const refType = payment.payment_type; // 'order' or 'booking'
    const refId = payment.order_id || payment.booking_id;
    await refundToWallet(payment.user_id, refundAmount, refType, refId);
  }

  // Mark payment as refunded
  await query(
    `UPDATE payments SET status = 'refunded', refunded_at = NOW() WHERE id = $1`, [paymentId],
  );

  // If order payment, mark order as cancelled
  if (payment.order_id) {
    await query(`UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = $1`, [payment.order_id]);
  }

  eventBus.emit(EVENTS.REFUND_PROCESSED, { userId: payment.user_id, amount: refundAmount });

  return getPaymentById(paymentId);
}

