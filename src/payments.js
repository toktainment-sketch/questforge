// QuestForgeAI payments - Paddle Billing
//
// Paddle is the Merchant of Record for the public checkout flow. The public
// pricing page can open Paddle Checkout when these production values are set:
//   PADDLE_CLIENT_TOKEN       - Paddle.js client-side token
//   PADDLE_ENVIRONMENT        - production or sandbox
//   PADDLE_PRICE_STANDARD     - price id for the $1,200 package
//   PADDLE_PRICE_LARGE        - price id for the $1,800 package
//   PADDLE_PRICE_MONTHLY      - recurring price id for the $4,500/month package
//   PADDLE_WEBHOOK_SECRET     - endpoint secret for verified Paddle webhooks

const crypto = require('crypto');

const SUPPORTED_ENVIRONMENTS = new Set(['production', 'sandbox']);

const PRODUCTS = {
  standard: {
    name: 'QuestForgeAI - Standard (up to 300 questions)',
    price: 1200_00,
    currency: 'USD',
    description: 'Human-reviewed questionnaire draft package, confidence report, flagged items, and cover note. 24-hour target after usable files are received.',
    priceEnv: 'PADDLE_PRICE_STANDARD',
  },
  large: {
    name: 'QuestForgeAI - Large (300-600 questions)',
    price: 1800_00,
    currency: 'USD',
    description: 'Human-reviewed draft package for larger questionnaires, including formatting QA and flagged items. 48-hour target after usable files are received.',
    priceEnv: 'PADDLE_PRICE_LARGE',
  },
  monthly: {
    name: 'QuestForgeAI - Monthly Unlimited',
    price: 4500_00,
    currency: 'USD',
    description: 'Recurring concierge questionnaire support, reusable answer library maintenance, and priority handling.',
    recurring: true,
    priceEnv: 'PADDLE_PRICE_MONTHLY',
  },
};

function getPaddleEnvironment() {
  const raw = String(process.env.PADDLE_ENVIRONMENT || 'production').trim().toLowerCase();
  return SUPPORTED_ENVIRONMENTS.has(raw) ? raw : 'production';
}

function getProductsWithPrices() {
  return Object.entries(PRODUCTS).map(([tier, product]) => ({
    tier,
    name: product.name,
    price: product.price / 100,
    currency: product.currency,
    description: product.description,
    recurring: !!product.recurring,
    priceId: process.env[product.priceEnv] || null,
    priceConfigured: !!process.env[product.priceEnv],
  }));
}

function getPaymentConfig() {
  const clientToken = process.env.PADDLE_CLIENT_TOKEN || '';
  const products = getProductsWithPrices();
  const ready = !!clientToken && products.every(product => product.priceConfigured);

  return {
    provider: 'paddle',
    ready,
    environment: getPaddleEnvironment(),
    clientToken: ready ? clientToken : null,
    products,
  };
}

function initPayments() {
  return getPaymentConfig().ready;
}

function getPublicPricing() {
  return getProductsWithPrices().map(({ priceId, ...product }) => ({
    ...product,
    checkoutAvailable: !!priceId && !!process.env.PADDLE_CLIENT_TOKEN,
  }));
}

function createCheckoutSession(tier, customerEmail, successUrl, closeUrl) {
  const config = getPaymentConfig();
  if (!config.ready) throw new Error('Paddle checkout is not configured yet.');

  const product = config.products.find(item => item.tier === tier);
  if (!product) throw new Error(`Invalid tier: ${tier}`);

  return {
    provider: 'paddle',
    environment: config.environment,
    clientToken: config.clientToken,
    tier: product.tier,
    priceId: product.priceId,
    customerEmail: customerEmail || null,
    checkout: {
      items: [{ priceId: product.priceId, quantity: 1 }],
      customData: { tier: product.tier },
      settings: {
        displayMode: 'overlay',
        theme: 'light',
        locale: 'en',
        successUrl: successUrl || undefined,
        closeUrl: closeUrl || undefined,
      },
    },
  };
}

function timingSafeHexEqual(left, right) {
  if (!/^[a-f0-9]+$/i.test(left || '') || !/^[a-f0-9]+$/i.test(right || '')) return false;
  const leftBuffer = Buffer.from(left, 'hex');
  const rightBuffer = Buffer.from(right, 'hex');
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function parsePaddleSignature(signatureHeader) {
  const parts = String(signatureHeader || '').split(';').map(part => part.trim()).filter(Boolean);
  const parsed = { ts: null, h1: [] };

  for (const part of parts) {
    const [key, value] = part.split('=');
    if (key === 'ts') parsed.ts = Number(value);
    if (key === 'h1' && value) parsed.h1.push(value);
  }

  return parsed;
}

function verifyWebhookSignature(rawBody, signatureHeader) {
  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!secret) return false;

  const { ts, h1 } = parsePaddleSignature(signatureHeader);
  if (!Number.isFinite(ts) || h1.length === 0) return false;

  const toleranceSeconds = Number(process.env.PADDLE_WEBHOOK_TOLERANCE_SECONDS || 5);
  const tolerance = Number.isFinite(toleranceSeconds) && toleranceSeconds > 0 ? toleranceSeconds : 5;
  const age = Math.abs(Math.floor(Date.now() / 1000) - ts);
  if (age > tolerance) return false;

  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody || ''), 'utf8');
  const signedPayload = Buffer.concat([Buffer.from(`${ts}:`, 'utf8'), body]);
  const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');

  return h1.some(signature => timingSafeHexEqual(expected, signature));
}

function verifyPayment() {
  throw new Error('Automated payment verification is handled by verified Paddle webhooks.');
}

module.exports = {
  initPayments,
  getPaymentConfig,
  getPublicPricing,
  createCheckoutSession,
  verifyPayment,
  verifyWebhookSignature,
  PRODUCTS,
};
