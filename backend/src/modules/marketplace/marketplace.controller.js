import {
  productListQuerySchema, orderListQuerySchema,
  createOrderSchema, createOrderPaymentSchema, createBookingPaymentSchema,
  addToCartSchema, updateCartSchema, idParamSchema,
} from './marketplace.schema.js';
import {
  listProducts, listAllProducts, getProductById,
  addToCart, getCart, updateCartItem, removeCartItem,
  createOrder, getOrderById, listClientOrders, listAllOrders,
  processOrderPayment, processBookingPayment, getPaymentById,
  refundPayment,
  createProduct, updateProduct, toggleProductActive, adminUpdateOrderStatus,
} from './marketplace.service.js';
import { ok, fail } from '../../utils/apiResponse.js';

// ── Products ──────────────────────────────────────────────
export async function listProductsHandler(req, res, next) {
  try { return ok(res, await listProducts(productListQuerySchema.parse(req.query)), 'Products'); }
  catch (err) { return next(err); }
}

export async function getProductHandler(req, res, next) {
  try {
    const { id } = idParamSchema.parse(req.params);
    const product = await getProductById(id);
    if (!product) return fail(res, 'Product not found', 404);
    return ok(res, { product }, 'Product details');
  } catch (err) { return next(err); }
}

export async function adminListProductsHandler(req, res, next) {
  try { return ok(res, await listAllProducts(productListQuerySchema.parse(req.query)), 'All products'); }
  catch (err) { return next(err); }
}

// ── Cart ──────────────────────────────────────────────────
export async function addToCartHandler(req, res, next) {
  try {
    const { productId, quantity } = addToCartSchema.parse(req.body);
    const cart = await addToCart(req.user.id, productId, quantity);
    return ok(res, { cart }, 'Added to cart', 201);
  } catch (err) { return next(err); }
}

export async function getCartHandler(req, res, next) {
  try { return ok(res, { cart: await getCart(req.user.id) }, 'Cart'); }
  catch (err) { return next(err); }
}

export async function updateCartHandler(req, res, next) {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { quantity } = updateCartSchema.parse(req.body);
    const cart = await updateCartItem(req.user.id, id, quantity);
    return ok(res, { cart }, 'Cart updated');
  } catch (err) { return next(err); }
}

export async function removeCartHandler(req, res, next) {
  try {
    const { id } = idParamSchema.parse(req.params);
    const cart = await removeCartItem(req.user.id, id);
    return ok(res, { cart }, 'Item removed');
  } catch (err) { return next(err); }
}

// ── Orders ────────────────────────────────────────────────
export async function createOrderHandler(req, res, next) {
  try {
    const data = createOrderSchema.parse(req.body);
    const order = await createOrder(req.user.id, data);
    return ok(res, { order }, 'Order created', 201);
  } catch (err) { return next(err); }
}

export async function listOrdersHandler(req, res, next) {
  try { return ok(res, await listClientOrders(req.user.id, orderListQuerySchema.parse(req.query)), 'My orders'); }
  catch (err) { return next(err); }
}

export async function getOrderHandler(req, res, next) {
  try {
    const { id } = idParamSchema.parse(req.params);
    const order = await getOrderById(id);
    if (!order) return fail(res, 'Order not found', 404);
    return ok(res, { order }, 'Order details');
  } catch (err) { return next(err); }
}

export async function adminListOrdersHandler(req, res, next) {
  try { return ok(res, await listAllOrders(orderListQuerySchema.parse(req.query)), 'All orders'); }
  catch (err) { return next(err); }
}

// ── Payments ──────────────────────────────────────────────
export async function createOrderPaymentHandler(req, res, next) {
  try {
    const data = createOrderPaymentSchema.parse(req.body);
    const payment = await processOrderPayment(req.user.id, data);
    return ok(res, { payment }, 'Payment processed', 201);
  } catch (err) { return next(err); }
}

export async function createBookingPaymentHandler(req, res, next) {
  try {
    const data = createBookingPaymentSchema.parse(req.body);
    const payment = await processBookingPayment(req.user.id, data);
    return ok(res, { payment }, 'Booking payment processed', 201);
  } catch (err) { return next(err); }
}

export async function getPaymentHandler(req, res, next) {
  try {
    const { id } = idParamSchema.parse(req.params);
    const payment = await getPaymentById(id);
    if (!payment) return fail(res, 'Payment not found', 404);
    return ok(res, { payment }, 'Payment details');
  } catch (err) { return next(err); }
}

export async function refundPaymentHandler(req, res, next) {
  try {
    const { id } = idParamSchema.parse(req.params);
    const payment = await refundPayment(id);
    return ok(res, { payment }, 'Payment refunded');
  } catch (err) { return next(err); }
}

// ── Admin: Product CRUD ──────────────────────────────────
export async function adminCreateProductHandler(req, res, next) {
  try {
    const product = await createProduct(req.body);
    return ok(res, { product }, 'Product created', 201);
  } catch (err) { return next(err); }
}

export async function adminUpdateProductHandler(req, res, next) {
  try {
    const { id } = idParamSchema.parse(req.params);
    const product = await updateProduct(id, req.body);
    return ok(res, { product }, 'Product updated');
  } catch (err) { return next(err); }
}

export async function adminToggleProductHandler(req, res, next) {
  try {
    const { id } = idParamSchema.parse(req.params);
    const product = await toggleProductActive(id);
    return ok(res, { product }, 'Product toggled');
  } catch (err) { return next(err); }
}

export async function adminUpdateOrderStatusHandler(req, res, next) {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { status } = req.body;
    const order = await adminUpdateOrderStatus(id, status);
    return ok(res, { order }, 'Order status updated');
  } catch (err) { return next(err); }
}
