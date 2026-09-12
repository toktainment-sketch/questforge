const PRODUCTS = {
  standard: {
    name: 'QuestForgeAI - Standard (up to 300 questions)',
    price: 1200,
    currency: 'USD',
    description: 'Human-reviewed questionnaire draft package, confidence report, flagged items, and cover note. 24-hour target after usable files are received.',
    priceEnv: 'PADDLE_PRICE_STANDARD',
  },
  large: {
    name: 'QuestForgeAI - Large (300-600 questions)',
    price: 1800,
    currency: 'USD',
    description: 'Human-reviewed draft package for larger questionnaires, including formatting QA and flagged items. 48-hour target after usable files are received.',
    priceEnv: 'PADDLE_PRICE_LARGE',
  },
  monthly: {
    name: 'QuestForgeAI - Monthly Unlimited',
    price: 4500,
    currency: 'USD',
    description: 'Recurring concierge questionnaire support, reusable answer library maintenance, and priority handling.',
    recurring: true,
    priceEnv: 'PADDLE_PRICE_MONTHLY',
  },
};

const LEGAL_FLAGS = [
  'indemnif', 'liability', 'sla', 'uptime', 'guarantee', 'warranty',
  'breach notification', 'data retention', 'subprocessor', 'pentest',
  'penetration test', 'insurance', 'audit right', 'escrow', 'termination',
];

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' https://cdn.paddle.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://*.paddle.com",
    "connect-src 'self' https://*.paddle.com",
    "font-src 'self'",
    "worker-src 'self' blob:",
    "frame-src https://*.paddle.com",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "form-action 'self' https://*.paddle.com",
  ].join('; '),
};

const CLEAN_ROUTES = new Map([
  ['/', '/landing.html'],
  ['/pricing', '/pricing.html'],
  ['/privacy', '/privacy.html'],
  ['/terms', '/terms.html'],
  ['/refund', '/refund.html'],
  ['/security', '/security.html'],
  ['/success', '/success.html'],
]);

function withSecurityHeaders(response, extra = {}) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) headers.set(key, value);
  for (const [key, value] of Object.entries(extra)) headers.set(key, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function json(data, status = 200, extraHeaders = {}) {
  return withSecurityHeaders(new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders },
  }));
}

function html(markup, status = 200) {
  return withSecurityHeaders(new Response(markup, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  }));
}

function getPaddleEnvironment(env) {
  return String(env.PADDLE_ENVIRONMENT || 'production').toLowerCase() === 'sandbox' ? 'sandbox' : 'production';
}

function getProducts(env) {
  return Object.entries(PRODUCTS).map(([tier, product]) => ({
    tier,
    name: product.name,
    price: product.price,
    currency: product.currency,
    description: product.description,
    recurring: Boolean(product.recurring),
    priceId: env[product.priceEnv] || null,
    priceConfigured: Boolean(env[product.priceEnv]),
  }));
}

function getPaymentConfig(env) {
  const products = getProducts(env);
  const clientToken = env.PADDLE_CLIENT_TOKEN || '';
  const ready = Boolean(clientToken) && products.every(product => product.priceConfigured);
  return {
    provider: 'paddle',
    ready,
    environment: getPaddleEnvironment(env),
    clientToken: ready ? clientToken : null,
    products,
  };
}

function constantTimeEqual(left, right) {
  left = String(left || '');
  right = String(right || '');
  const maxLength = Math.max(left.length, right.length);
  let mismatch = left.length ^ right.length;
  for (let index = 0; index < maxLength; index += 1) {
    mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return mismatch === 0;
}

function hasPilotAccess(request, env) {
  if (!env.QUESTFORGE_OPERATOR_TOKEN) return false;
  const url = new URL(request.url);
  const supplied = request.headers.get('x-questforge-token') || url.searchParams.get('token') || '';
  return constantTimeEqual(supplied, env.QUESTFORGE_OPERATOR_TOKEN);
}

function detectLegalFlag(question) {
  const value = String(question || '').toLowerCase();
  return LEGAL_FLAGS.some(flag => value.includes(flag));
}

function scoreConfidence(answer) {
  if (!answer || answer.length < 20) return 'LOW';
  if (answer.includes("I don't have") || answer.includes('not found') || answer.includes('unclear')) return 'LOW';
  if (answer.length > 200) return 'HIGH';
  return 'MEDIUM';
}

async function callAnthropic(env, { system, prompt, maxTokens }) {
  if (!env.ANTHROPIC_API_KEY) throw new Error('QuestForgeAI AI processing is not configured.');
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system: system || undefined,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || `AI provider returned ${response.status}.`;
    throw new Error(message);
  }
  const text = payload?.content?.find(item => item.type === 'text')?.text;
  if (!text) throw new Error('AI provider returned an empty answer.');
  return text;
}

async function answerQuestion(env, question, knowledgeBase, companyName) {
  const isLegalFlag = detectLegalFlag(question);
  const system = `You are a security documentation specialist helping ${companyName} complete a vendor security questionnaire.

Answer accurately based ONLY on the supplied documentation. Be specific, professional, and concise, normally 2 to 5 sentences. If the documentation does not clearly support an answer, begin with "[NEEDS REVIEW]" and state exactly what information is missing. Never invent certifications, standards, controls, dates, or commitments. Never use em dashes or en dashes.`;
  const prompt = `SECURITY DOCUMENTATION:\n${knowledgeBase}\n\nQUESTIONNAIRE QUESTION:\n${question}\n\nProvide one clear draft answer.`;
  const answer = await callAnthropic(env, { system, prompt, maxTokens: 600 });
  const confidence = scoreConfidence(answer);
  return {
    answer,
    confidence,
    needsReview: isLegalFlag || answer.includes('[NEEDS REVIEW]') || confidence === 'LOW',
    isLegalFlag,
  };
}

async function verifyPaddleSignature(env, rawBody, signatureHeader) {
  if (!env.PADDLE_WEBHOOK_SECRET || !signatureHeader) return false;
  const parts = signatureHeader.split(';').map(part => part.trim());
  const timestamp = Number(parts.find(part => part.startsWith('ts='))?.slice(3));
  const signatures = parts.filter(part => part.startsWith('h1=')).map(part => part.slice(3));
  if (!Number.isFinite(timestamp) || signatures.length === 0) return false;
  const tolerance = Math.max(5, Number(env.PADDLE_WEBHOOK_TOLERANCE_SECONDS || 5));
  if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > tolerance) return false;

  const payload = new TextEncoder().encode(`${timestamp}:${rawBody}`);
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.PADDLE_WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, payload));
  const expected = Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
  return signatures.some(signature => constantTimeEqual(signature.toLowerCase(), expected));
}

async function serveAsset(request, env, pathname) {
  const assetUrl = new URL(request.url);
  assetUrl.pathname = pathname;
  assetUrl.search = '';
  const assetRequest = new Request(assetUrl.toString(), { method: 'GET', headers: request.headers });
  return withSecurityHeaders(await env.ASSETS.fetch(assetRequest));
}

function pilotAccessPage() {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>QuestForgeAI Pilot Access</title><link rel="stylesheet" href="/styles.css"></head><body class="app-body"><main class="legal-layout"><article class="legal-panel"><p class="section-kicker">Private pilot</p><h1>QuestForgeAI is in private pilot mode.</h1><p>The processing workspace is reserved for operator-reviewed engagements. To start a questionnaire, contact <a href="mailto:hello@questforgeai.ai">hello@questforgeai.ai</a>.</p></article></main></body></html>`;
}

async function handleApi(request, env, pathname) {
  if (pathname === '/api/health' && request.method === 'GET') {
    return json({
      status: 'ok',
      runtime: 'cloudflare-workers',
      apiKey: Boolean(env.ANTHROPIC_API_KEY),
      payments: getPaymentConfig(env).ready,
      pilotAccessConfigured: Boolean(env.QUESTFORGE_OPERATOR_TOKEN),
      documentStorage: 'browser-only',
    });
  }

  if (pathname === '/api/pricing' && request.method === 'GET') {
    return json(getProducts(env).map(({ priceId, ...product }) => ({
      ...product,
      checkoutAvailable: Boolean(priceId && env.PADDLE_CLIENT_TOKEN),
    })));
  }

  if (pathname === '/api/payment-config' && request.method === 'GET') {
    const config = getPaymentConfig(env);
    return json({
      provider: config.provider,
      ready: config.ready,
      environment: config.environment,
      clientToken: config.clientToken,
      products: config.products.map(({ priceId, ...product }) => ({
        ...product,
        checkoutAvailable: Boolean(priceId && config.clientToken),
      })),
    }, 200, { 'Cache-Control': 'no-store' });
  }

  if (pathname === '/api/checkout' && request.method === 'POST') {
    const config = getPaymentConfig(env);
    if (!config.ready) return json({ error: 'Payments not configured yet. Contact us directly.' }, 503);
    const body = await request.json().catch(() => ({}));
    const product = config.products.find(item => item.tier === (body.tier || 'standard'));
    if (!product) return json({ error: 'Invalid pricing tier.' }, 400);
    const origin = new URL(request.url).origin;
    return json({
      provider: 'paddle',
      environment: config.environment,
      clientToken: config.clientToken,
      tier: product.tier,
      priceId: product.priceId,
      customerEmail: body.email || null,
      checkout: {
        items: [{ priceId: product.priceId, quantity: 1 }],
        customData: { tier: product.tier },
        settings: {
          displayMode: 'overlay',
          theme: 'light',
          locale: 'en',
          successUrl: `${origin}/success`,
          closeUrl: `${origin}/pricing`,
        },
      },
    });
  }

  if (pathname === '/api/paddle/webhook' && request.method === 'POST') {
    const rawBody = await request.text();
    const verified = await verifyPaddleSignature(env, rawBody, request.headers.get('Paddle-Signature'));
    if (!verified) return json({ error: 'Invalid signature' }, 401);
    return json({ received: true });
  }

  if (pathname === '/api/answer-batch' && request.method === 'POST') {
    if (!hasPilotAccess(request, env)) return json({ error: 'Operator access token required.' }, 401, { 'Cache-Control': 'no-store' });
    const body = await request.json().catch(() => null);
    const questions = Array.isArray(body?.questions) ? body.questions.slice(0, 5) : [];
    const knowledgeBase = String(body?.knowledgeBase || '').slice(0, 12000);
    const companyName = String(body?.companyName || 'the company').slice(0, 160);
    if (!questions.length || !knowledgeBase.trim()) return json({ error: 'Questions and supporting documentation are required.' }, 400);

    const results = await Promise.all(questions.map(async item => {
      const question = String(item?.question || '').slice(0, 4000);
      try {
        return { ...item, ...(await answerQuestion(env, question, knowledgeBase, companyName)) };
      } catch (error) {
        return {
          ...item,
          answer: '[ERROR] Failed to generate answer, manual completion required.',
          confidence: 'LOW',
          needsReview: true,
          isLegalFlag: detectLegalFlag(question),
          error: error.message,
        };
      }
    }));
    return json({ results }, 200, { 'Cache-Control': 'no-store' });
  }

  if (pathname === '/api/cover-letter' && request.method === 'POST') {
    if (!hasPilotAccess(request, env)) return json({ error: 'Operator access token required.' }, 401, { 'Cache-Control': 'no-store' });
    const body = await request.json().catch(() => ({}));
    const companyName = String(body.companyName || 'the company').slice(0, 160);
    const senderName = String(body.senderName || 'the prospect').slice(0, 160);
    const autoAnswered = Math.max(0, Number(body.autoAnswered || 0));
    const needsReview = Math.max(0, Number(body.needsReview || 0));
    const prompt = `Write a brief, professional cover note in 3 short paragraphs from ${companyName} to ${senderName} submitting a completed security questionnaire. Note that ${autoAnswered} questions are answered and ${needsReview} items are flagged for follow-up. Use a confident, professional, cooperative tone. End with an offer to schedule a call for clarification. Never use em dashes or en dashes.`;
    try {
      const coverLetter = await callAnthropic(env, { prompt, maxTokens: 400 });
      return json({ coverLetter }, 200, { 'Cache-Control': 'no-store' });
    } catch (error) {
      return json({ error: error.message }, 502);
    }
  }

  return json({ error: 'Not found' }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/+$/, '') || '/';

    try {
      if (pathname.startsWith('/api/')) return await handleApi(request, env, pathname);
      if (pathname === '/app') {
        if (!hasPilotAccess(request, env)) return html(pilotAccessPage(), 403);
        return await serveAsset(request, env, '/index.html');
      }
      if (pathname === '/cancel') return Response.redirect(`${url.origin}/pricing`, 302);
      if (CLEAN_ROUTES.has(pathname)) return await serveAsset(request, env, CLEAN_ROUTES.get(pathname));
      if (pathname.endsWith('.html')) {
        const clean = pathname.replace(/\.html$/, '') || '/';
        return Response.redirect(`${url.origin}${clean}`, 301);
      }
      return await serveAsset(request, env, url.pathname);
    } catch (error) {
      console.error('QuestForgeAI Worker error', error);
      return json({ error: 'QuestForgeAI could not complete this request.' }, 500);
    }
  },
};

export { detectLegalFlag, scoreConfidence, verifyPaddleSignature };
