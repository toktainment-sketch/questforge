const Stripe = require('stripe');

let stripe = null;

function initStripe() {
  if (process.env.STRIPE_SECRET_KEY) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    return true;
  }
  return false;
}

const PRODUCTS = {
  standard: {
    name: 'QuestForge — Standard (up to 300 questions)',
    price: 1200_00, // $1,200
    description: 'Complete security questionnaire draft + confidence report + cover letter. 24-hour delivery.',
  },
  large: {
    name: 'QuestForge — Large (300–600 questions)',
    price: 1800_00, // $1,800
    description: 'Complete security questionnaire draft for large questionnaires (SIG Full, custom 500+ questions). 48-hour delivery.',
  },
  monthly: {
    name: 'QuestForge — Monthly Unlimited',
    price: 4500_00, // $4,500/month
    description: 'Unlimited security questionnaire completions per month. Dedicated answer library. Priority delivery.',
    recurring: true,
  },
};

async function createCheckoutSession(tier, customerEmail, successUrl, cancelUrl) {
  if (!stripe) throw new Error('Stripe not configured');

  const product = PRODUCTS[tier];
  if (!product) throw new Error(`Invalid tier: ${tier}`);

  const lineItem = {
    price_data: {
      currency: 'usd',
      product_data: {
        name: product.name,
        description: product.description,
      },
      unit_amount: product.price,
    },
    quantity: 1,
  };

  if (product.recurring) {
    lineItem.price_data.recurring = { interval: 'month' };
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: product.recurring ? 'subscription' : 'payment',
    customer_email: customerEmail || undefined,
    line_items: [lineItem],
    success_url: successUrl || '{CHECKOUT_SESSION_URL}/success?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: cancelUrl || '{CHECKOUT_SESSION_URL}/cancel',
    metadata: { tier, product: product.name },
  });

  return { url: session.url, sessionId: session.id };
}

async function verifyPayment(sessionId) {
  if (!stripe) throw new Error('Stripe not configured');
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  return {
    paid: session.payment_status === 'paid',
    email: session.customer_email || session.customer_details?.email,
    tier: session.metadata?.tier,
    amount: session.amount_total,
  };
}

module.exports = { initStripe, createCheckoutSession, verifyPayment, PRODUCTS };
