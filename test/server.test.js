const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');

const PORT = 3299;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const TOKEN = 'server-test-token';
const PADDLE_WEBHOOK_SECRET = 'test-webhook-secret';

function startServer() {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(PORT),
      QUESTFORGE_OPERATOR_TOKEN: TOKEN,
      ANTHROPIC_API_KEY: '',
      PADDLE_CLIENT_TOKEN: '',
      PADDLE_PRICE_STANDARD: '',
      PADDLE_PRICE_LARGE: '',
      PADDLE_PRICE_MONTHLY: '',
      PADDLE_WEBHOOK_SECRET,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return child;
}

async function waitForHealth() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const res = await fetch(`${BASE_URL}/api/health`);
      if (res.ok) return res;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 150));
    }
  }
  throw new Error('Server did not become healthy');
}

test('server enforces pilot gate and security headers', async () => {
  const server = startServer();

  try {
    await waitForHealth();

    const pricing = await fetch(`${BASE_URL}/pricing`);
    assert.equal(pricing.status, 200);
    const pricingHtml = await pricing.text();
    assert.match(pricingHtml, /Pilot pricing/);
    assert.match(pricingHtml, /data-checkout-tier="standard"/);

    const legacyPricing = await fetch(`${BASE_URL}/pricing.html`, { redirect: 'manual' });
    assert.equal(legacyPricing.status, 302);
    assert.equal(legacyPricing.headers.get('location'), '/pricing');

    const paymentConfig = await fetch(`${BASE_URL}/api/payment-config`);
    assert.equal(paymentConfig.status, 200);
    const paymentPayload = await paymentConfig.json();
    assert.equal(paymentPayload.provider, 'paddle');
    assert.equal(paymentPayload.ready, false);

    const checkout = await fetch(`${BASE_URL}/api/checkout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tier: 'standard' }),
    });
    assert.equal(checkout.status, 503);

    const appNoToken = await fetch(`${BASE_URL}/app`);
    assert.equal(appNoToken.status, 403);

    const appWithToken = await fetch(`${BASE_URL}/app?token=${TOKEN}`);
    assert.equal(appWithToken.status, 200);
    assert.equal(appWithToken.headers.get('cache-control'), 'no-store');

    const csp = appWithToken.headers.get('content-security-policy') || '';
    assert.match(csp, /default-src 'self'/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.equal(appWithToken.headers.get('x-frame-options'), 'DENY');
    assert.equal(appWithToken.headers.get('referrer-policy'), 'no-referrer');

    const statusNoToken = await fetch(`${BASE_URL}/api/status/job_missing`);
    assert.equal(statusNoToken.status, 401);

    const processNoKey = await fetch(`${BASE_URL}/api/process`, {
      method: 'POST',
      headers: { 'x-questforge-token': TOKEN },
    });
    assert.equal(processNoKey.status, 503);
  } finally {
    server.kill('SIGTERM');
    await new Promise(resolve => server.once('exit', resolve));
  }
});

test('server verifies Paddle webhook signatures', async () => {
  const server = startServer();

  try {
    await waitForHealth();

    const body = JSON.stringify({
      event_type: 'transaction.completed',
      data: {
        custom_data: { tier: 'standard' },
        customer: { email: 'buyer@example.com' },
      },
    });

    const invalid = await fetch(`${BASE_URL}/api/paddle/webhook`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'paddle-signature': 'ts=1;h1=bad',
      },
      body,
    });
    assert.equal(invalid.status, 401);

    const ts = Math.floor(Date.now() / 1000);
    const h1 = crypto
      .createHmac('sha256', PADDLE_WEBHOOK_SECRET)
      .update(`${ts}:${body}`)
      .digest('hex');

    const valid = await fetch(`${BASE_URL}/api/paddle/webhook`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'paddle-signature': `ts=${ts};h1=${h1}`,
      },
      body,
    });
    assert.equal(valid.status, 200);
    assert.deepEqual(await valid.json(), { received: true });
  } finally {
    server.kill('SIGTERM');
    await new Promise(resolve => server.once('exit', resolve));
  }
});
