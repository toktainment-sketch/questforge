const canvas = document.getElementById('signalScene');

if (canvas) {
  const ctx = canvas.getContext('2d');
  let width = 0;
  let height = 0;
  let frame = 0;

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function roundedRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawDocument(x, y, w, h, phase) {
    ctx.save();
    ctx.globalAlpha = 0.82;
    roundedRect(x, y, w, h, 12);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.stroke();

    for (let i = 0; i < 6; i += 1) {
      const rowY = y + 28 + i * 28;
      const shimmer = Math.sin(phase + i) * 18;
      ctx.fillStyle = i === 4 ? 'rgba(255,190,84,0.20)' : 'rgba(255,255,255,0.10)';
      roundedRect(x + 18, rowY, w - 36 - Math.abs(shimmer), 10, 5);
      ctx.fill();
    }

    ctx.fillStyle = 'rgba(8,122,99,0.90)';
    roundedRect(x + w - 96, y + h - 46, 70, 22, 11);
    ctx.fill();
    ctx.restore();
  }

  function drawNode(x, y, label, color) {
    ctx.save();
    ctx.globalAlpha = 0.92;
    roundedRect(x, y, 128, 38, 10);
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.78)';
    ctx.font = '12px Segoe UI, Arial, sans-serif';
    ctx.fillText(label, x + 14, y + 24);
    ctx.restore();
  }

  function draw() {
    frame += 0.012;
    ctx.clearRect(0, 0, width, height);

    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#0d1320');
    grad.addColorStop(0.48, '#172035');
    grad.addColorStop(1, '#102b28');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(255,255,255,0.055)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const right = Math.max(width * 0.54, 520);
    drawDocument(right, 78 + Math.sin(frame) * 8, 330, 230, frame);
    drawDocument(right + 130, 280 + Math.cos(frame * 0.8) * 10, 290, 202, frame + 1.8);

    drawNode(right - 46, 336, 'SOC 2 evidence', 'rgba(86,126,224,0.82)');
    drawNode(right + 296, 170, 'legal review', 'rgba(255,190,84,0.78)');
    drawNode(right + 40, 542, 'client approval', 'rgba(83,209,177,0.78)');

    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(right + 82, 374);
    ctx.bezierCurveTo(right + 180, 346, right + 230, 242, right + 314, 207);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(right + 160, 560);
    ctx.bezierCurveTo(right + 230, 510, right + 284, 438, right + 324, 396);
    ctx.stroke();

    requestAnimationFrame(draw);
  }

  resize();
  draw();
  window.addEventListener('resize', resize);
}

const checkoutLinks = [...document.querySelectorAll('[data-checkout-tier]')];
const paymentStatus = document.querySelector('[data-payment-status]');

function setPaymentStatus(message, state) {
  if (!paymentStatus) return;
  paymentStatus.textContent = message;
  paymentStatus.dataset.state = state || 'idle';
}

function setCheckoutButtonLoading(link, isLoading) {
  if (!link) return;
  if (!link.dataset.originalText) link.dataset.originalText = link.textContent;
  link.classList.toggle('is-loading', isLoading);
  link.setAttribute('aria-busy', isLoading ? 'true' : 'false');
  link.textContent = isLoading ? 'Opening secure checkout...' : link.dataset.originalText;
}

async function getCheckoutPayload(tier) {
  const response = await fetch('/api/checkout', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ tier }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Checkout is not available yet.');
  }
  return payload;
}

function openCheckout(payload) {
  if (!window.Paddle?.Checkout?.open) {
    throw new Error('Paddle Checkout is still loading. Try again in a moment.');
  }

  window.Paddle.Checkout.open(payload.checkout);
}

async function setupPaddleCheckout() {
  if (!checkoutLinks.length) return;

  let config;
  try {
    const response = await fetch('/api/payment-config', {
      headers: { 'Accept': 'application/json' },
    });
    config = await response.json();
  } catch {
    setPaymentStatus('Email intake is available while secure checkout finishes connecting.', 'fallback');
    return;
  }

  if (!config.ready || !config.clientToken || !window.Paddle) {
    setPaymentStatus('Email intake is available while secure checkout finishes connecting.', 'fallback');
    return;
  }

  try {
    if (config.environment === 'sandbox' && window.Paddle.Environment?.set) {
      window.Paddle.Environment.set('sandbox');
    }

    window.Paddle.Initialize({ token: config.clientToken });
    setPaymentStatus('Secure Paddle checkout is ready.', 'ready');

    checkoutLinks.forEach(link => {
      link.addEventListener('click', async event => {
        event.preventDefault();
        const tier = link.dataset.checkoutTier;
        setCheckoutButtonLoading(link, true);
        setPaymentStatus('Opening secure Paddle checkout...', 'ready');

        try {
          const payload = await getCheckoutPayload(tier);
          openCheckout(payload);
          setPaymentStatus('Checkout opened securely through Paddle.', 'ready');
        } catch (error) {
          setPaymentStatus(error.message || 'Checkout is not available yet. Use email intake for now.', 'error');
        } finally {
          setCheckoutButtonLoading(link, false);
        }
      });
    });
  } catch {
    setPaymentStatus('Email intake is available while secure checkout finishes connecting.', 'fallback');
  }
}

setupPaddleCheckout();
