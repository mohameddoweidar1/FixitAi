import {
  topUpSchema, withdrawSchema, adminAdjustSchema,
  transactionQuerySchema, addPaymentMethodSchema,
  idParamSchema, userIdParamSchema,
} from './wallet.schema.js';
import {
  getOrCreateWallet, getWalletByUserId,
  topUp, withdraw, adminAdjust,
  listTransactions, listTransactionsByWalletUserId,
  addSavedPaymentMethod, listSavedPaymentMethods,
  deleteSavedPaymentMethod, setDefaultPaymentMethod,
  adminGetOverview, adminListWallets,
} from './wallet.service.js';
import { ok, fail } from '../../utils/apiResponse.js';

// ── Wallet ───────────────────────────────────────────────

export async function getMyWallet(req, res, next) {
  try {
    const wallet = await getOrCreateWallet(req.user.id);
    return ok(res, { wallet }, 'Wallet balance');
  } catch (err) { return next(err); }
}

export async function topUpHandler(req, res, next) {
  try {
    const { amount } = topUpSchema.parse(req.body);
    const wallet = await topUp(req.user.id, amount);
    return ok(res, { wallet }, 'Top-up successful');
  } catch (err) { return next(err); }
}

export async function withdrawHandler(req, res, next) {
  try {
    const { amount } = withdrawSchema.parse(req.body);
    const wallet = await withdraw(req.user.id, amount);
    return ok(res, { wallet }, 'Withdrawal successful');
  } catch (err) { return next(err); }
}

export async function myTransactionsHandler(req, res, next) {
  try {
    const filters = transactionQuerySchema.parse(req.query);
    const result = await listTransactions(req.user.id, filters);
    return ok(res, result, 'Transaction history');
  } catch (err) { return next(err); }
}

// ── Admin Wallet ─────────────────────────────────────────

export async function adminGetUserWallet(req, res, next) {
  try {
    const { userId } = userIdParamSchema.parse(req.params);
    const wallet = await getWalletByUserId(userId);
    if (!wallet) return fail(res, 'Wallet not found for this user', 404);
    return ok(res, { wallet }, 'User wallet');
  } catch (err) { return next(err); }
}

export async function adminAdjustHandler(req, res, next) {
  try {
    const data = adminAdjustSchema.parse(req.body);
    const wallet = await adminAdjust(req.user.id, data.userId, data.amount, data.direction, data.reason);
    return ok(res, { wallet }, `Wallet ${data.direction} adjustment applied`);
  } catch (err) { return next(err); }
}

export async function adminListTransactionsHandler(req, res, next) {
  try {
    const { userId } = userIdParamSchema.parse(req.params);
    const filters = transactionQuerySchema.parse(req.query);
    const result = await listTransactionsByWalletUserId(userId, filters);
    return ok(res, result, 'User transaction history');
  } catch (err) { return next(err); }
}

export async function adminOverviewHandler(req, res, next) {
  try {
    const overview = await adminGetOverview();
    return ok(res, overview, 'Wallet overview');
  } catch (err) { return next(err); }
}

export async function adminListWalletsHandler(req, res, next) {
  try {
    const filters = {
      search: req.query.search || undefined,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
    };
    return ok(res, await adminListWallets(filters), 'All wallets');
  } catch (err) { return next(err); }
}

// ── Saved Payment Methods ────────────────────────────────

export async function addPaymentMethodHandler(req, res, next) {
  try {
    const data = addPaymentMethodSchema.parse(req.body);
    const method = await addSavedPaymentMethod(req.user.id, data);
    return ok(res, { paymentMethod: method }, 'Payment method added', 201);
  } catch (err) { return next(err); }
}

export async function listPaymentMethodsHandler(req, res, next) {
  try {
    const methods = await listSavedPaymentMethods(req.user.id);
    return ok(res, { paymentMethods: methods }, 'Saved payment methods');
  } catch (err) { return next(err); }
}

export async function deletePaymentMethodHandler(req, res, next) {
  try {
    const { id } = idParamSchema.parse(req.params);
    await deleteSavedPaymentMethod(req.user.id, id);
    return ok(res, null, 'Payment method removed');
  } catch (err) { return next(err); }
}

export async function setDefaultPaymentMethodHandler(req, res, next) {
  try {
    const { id } = idParamSchema.parse(req.params);
    const methods = await setDefaultPaymentMethod(req.user.id, id);
    return ok(res, { paymentMethods: methods }, 'Default payment method updated');
  } catch (err) { return next(err); }
}
