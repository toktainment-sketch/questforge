// QuestForge payments — LemonSqueezy (Merchant of Record)
//
// Why LemonSqueezy instead of Stripe: the operator is based in Nigeria and has no
// US/UK business registration, which Stripe requires at verification. LemonSqueezy
// acts as Merchant of Record (it is the seller of record, handles tax/compliance,
// and pays out globally, including to a Payoneer USD account). No seller business
// registration required.
//
// Required environment variables (set in .env locally and in the Render dashboard):
//   LEMONSQUEEZY_API_KEY       - API key from LemonSqueezy → Settings → API
//   LEMONSQUEEZY_STORE_ID      - numeric store id from LemonSqueezy → Settings → Stores
//   LEMONSQUEEZY_VARIANT_STANDARD - variant id for the $1,200 product
//   LEMONSQUEEZY_VARIANT_LARGE    - variant id for the $1,800 product
//   LEMONSQUEEZY_VARIANT_MONTHLY  - variant id for the $4,500/month subscription
//   LEMONSQUEEZY_WEBHOOK_SECRET   - (optional) signing secret for webhook verification

const crypto = require('crypto');

const API_BASE = 'https://api.lemonsqueezy.com/v1';

let ready = false;

function initPayments() {
  ready = !!(process.env.LEMONSQUEEZY_API_KEY && process.env.LEMONSQUEEZY_STORE_ID);
  return ready;
}

// Display/pricing metadata. The price here is for display only; the real charge is
// controlled by the LemonSqueezy product/variant. Keep them in sync.
const PRODUCTS = {
  standard: {
    name: 'QuestForge — Standard (up to 300 questions)',
    price: 1200_00, // $1,200
    description: 'Complete security questionnaire draft + confidence report + cover letter. 24-hour delivery.',
    variantEnv: 'LEMONSQUEEZY_VARIANT_STANDARD',
  },
  large: {
    name: 'QuestForge — Large (300–600 questions)',
    price: 1800_00, // $1,800
    description: 'Complete security questionnaire draft for large questionnaires (SIG Full, custom 500+ questions). 48-hour delivery.',
    variantEnv: 'LEMONSQUEEZY_VARIANT_LARGE',
  },
  monthly: {
    name: 'QuestForge — Monthly Unlimited',
    price: 4500_00, // $4,500/month
    description: 'Unlimited security questionnaire completions per month. Dedicated answer library. Priority delivery.',
    recurring: true,
    variantEnv: 'LEMONSQUEEZY_VARIANT_MONTHLY',
  },
};

function lsHeaders() {
  return {
    'Accept': 'application/vnd.api+json',
    'Content-Type': 'application/vnd.api+json',
    'Authorization': `Bearer ${process.env.LEMONSQUEEZY_API_KEY}`,
  };
}

// Creates a hosted LemonSqueezy checkout and returns its URL.
async function createCheckoutSession(tier, customerEmail, successUrl /*, cancelUrl */) {
  if (!ready) throw new Error('Payments not configured');

  const product = PRODUCTS[tier];
  if (!product) throw new Error(`Invalid tier: ${tier}`);

  const storeId = process.env.LEMONSQUEEZY_STORE_ID;
  const variantId = process.env[product.variantEnv];
  if (!variantId) {
    throw new Error(`Missing variant id for tier "${tier}". Set ${product.variantEnv} in the environment.`);
  }

  const body = {
    data: {
      type: 'checkouts',
      attributes: {
        checkout_data: {
          email: customerEmail || undefined,
          custom: { tier },
        },
        product_options: {
          redirect_url: successUrl || undefined,
          // Only offer the variant we intend to sell on this checkout.
          enabled_variants: [Number(variantId)],
        },
      },
      relationships: {
        store: { data: { type: 'stores', id: String(storeId) } },
        variant: { data: { type: 'variants', id: String(variantId) } },
      },
    },
  };

  const res = await fetch(`${API_BASE}/checkouts`, {
    method: 'POST',
    headers: lsHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`LemonSqueezy checkout failed (${res.status}): ${detail}`);
  }

  const json = await res.json();
  const url = json?.data?.attributes?.url;
  const sessionId = json?.data?.id;
  if (!url) throw new Error('LemonSqueezy did not return a checkout URL');

  return { url, sessionId };
}

// Verifies an order by id (LemonSqueezy order id). The success redirect is informational
// only in the current single-operator flow; the operator is also notified by LemonSqueezy
// email on every sale. This is provided for completeness and future automation.
async function verifyPayment(orderId) {
  if (!ready) throw new Error('Payments not configured');

  const res = await fetch(`${API_BASE}/orders/${orderId}`, {
    method: 'GET',
    headers: lsHeaders(),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`LemonSqueezy order lookup failed (${res.status}): ${detail}`);
  }

  const json = await res.json();
  const attr = json?.data?.attributes || {};
  return {
    paid: attr.status === 'paid',
    email: attr.user_email,
    tier: attr.first_order_item?.variant_name || undefined,
    amount: attr.total, // in cents
  };
}

// Verifies a LemonSqueezy webhook signature (X-Signature header, HMAC-SHA256 of the raw body).
function verifyWebhookSignature(rawBody, signatureHeader) {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret) return false;
  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signatureHeader || ''));
  } catch {
    return false;
  }
}

module.exports = {
  initPayments,
  createCheckoutSession,
  verifyPayment,
  verifyWebhookSignature,
  PRODUCTS,
};
