const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(require('os').homedir(), '.cleo', 'secrets', '.env') });
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const crypto = require('crypto');

const { parseDocument, extractQuestionsFromExcel, extractQuestionsFromText } = require('./src/documentParser');
const { processQuestionnaire, generateRebuttalletter } = require('./src/answerEngine');
const { writeExcelOutput, writeSummaryReport, buildConfidenceReport, buildFlaggedItemsList } = require('./src/reportBuilder');
const {
  initPayments,
  createCheckoutSession,
  getPaymentConfig,
  getPublicPricing,
  verifyPayment,
  verifyWebhookSignature,
} = require('./src/payments');

const app = express();
const PORT = process.env.PORT || 3000;
const UPLOAD_ROOT = path.join(__dirname, 'uploads');
const OUTPUT_ROOT = path.join(__dirname, 'output');
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.docx', '.txt', '.xlsx']);
const RETENTION_DAYS = Number(process.env.QUESTFORGE_RETENTION_DAYS || 30);
const rateLimitBuckets = new Map();

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' https://cdn.paddle.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https://*.paddle.com",
      "connect-src 'self' https://*.paddle.com",
      "font-src 'self'",
      "frame-src https://*.paddle.com",
      "object-src 'none'",
      "base-uri 'none'",
      "frame-ancestors 'none'",
      "form-action 'self' https://*.paddle.com",
    ].join('; ')
  );
  next();
});

function ensureWorkspaceDirs() {
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
  fs.mkdirSync(OUTPUT_ROOT, { recursive: true });
}

function safeJoin(base, ...parts) {
  const resolvedBase = path.resolve(base);
  const target = path.resolve(resolvedBase, ...parts);
  if (target !== resolvedBase && !target.startsWith(resolvedBase + path.sep)) {
    throw new Error('Unsafe file path');
  }
  return target;
}

function getRequestJobId(req) {
  if (!req.jobId) {
    req.jobId = `job_${Date.now()}_${crypto.randomUUID()}`;
  }
  return req.jobId;
}

function isSafeJobId(jobId) {
  return /^job_[A-Za-z0-9_-]+$/.test(jobId || '');
}

function sanitizeFilename(filename) {
  const base = path.basename(filename || 'upload');
  return base.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 120) || 'upload';
}

function sanitizeFileStem(value, fallback) {
  const sanitized = sanitizeFilename(value || fallback).replace(/^\.+/, '').replace(/\.+$/, '');
  return sanitized || fallback;
}

function timingSafeTokenMatch(provided, expected) {
  if (!provided || !expected) return false;
  const providedBuffer = Buffer.from(String(provided));
  const expectedBuffer = Buffer.from(String(expected));
  if (providedBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}

function hasPilotAccess(req) {
  const expected = process.env.QUESTFORGE_OPERATOR_TOKEN;
  const provided = req.get('x-questforge-token') || req.query.token;
  return timingSafeTokenMatch(provided, expected);
}

function requirePilotAccess(req, res, next) {
  res.setHeader('Cache-Control', 'no-store');

  if (!process.env.QUESTFORGE_OPERATOR_TOKEN) {
    return res.status(503).json({
      error: 'QuestForgeAI upload processing is disabled for public access. Set QUESTFORGE_OPERATOR_TOKEN for operator-only pilot processing.',
    });
  }

  if (!hasPilotAccess(req)) {
    return res.status(401).json({ error: 'Operator access token required.' });
  }

  next();
}

function rateLimit(name, limit, windowMs) {
  return (req, res, next) => {
    const key = `${name}:${req.ip || req.socket.remoteAddress || 'unknown'}`;
    const now = Date.now();
    const current = rateLimitBuckets.get(key);

    if (!current || current.resetAt <= now) {
      rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (current.count >= limit) {
      res.setHeader('Retry-After', Math.ceil((current.resetAt - now) / 1000));
      return res.status(429).json({ error: 'Too many requests. Try again later.' });
    }

    current.count += 1;
    next();
  };
}

function sendPilotAccessPage(res) {
  res.status(403).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>QuestForgeAI Pilot Access</title>
  <link rel="stylesheet" href="/styles.css" />
</head>
<body class="app-body">
  <main class="legal-layout">
    <article class="legal-panel">
    <p class="section-kicker">Private pilot</p>
    <h1>QuestForgeAI is in private pilot mode.</h1>
    <p>The upload processor is reserved for operator-reviewed concierge engagements. To start a questionnaire, contact <a href="mailto:admin@kamtobecreations.com">admin@kamtobecreations.com</a>.</p>
    </article>
   </main>
</body>
</html>`);
}

function cleanupExpiredJobs() {
  if (!Number.isFinite(RETENTION_DAYS) || RETENTION_DAYS <= 0) return;
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;

  for (const root of [UPLOAD_ROOT, OUTPUT_ROOT]) {
    if (!fs.existsSync(root)) continue;

    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory() || !entry.name.startsWith('job_')) continue;
      const target = safeJoin(root, entry.name);
      const stat = fs.statSync(target);
      if (stat.mtimeMs < cutoff) {
        fs.rmSync(target, { recursive: true, force: true });
        console.log(`Deleted expired QuestForgeAI job folder: ${target}`);
      }
    }
  }
}

function startRetentionCleanup() {
  cleanupExpiredJobs();
  const interval = setInterval(cleanupExpiredJobs, 6 * 60 * 60 * 1000);
  interval.unref?.();
}

function removeJobFolders(jobId) {
  if (!isSafeJobId(jobId)) return;
  for (const root of [UPLOAD_ROOT, OUTPUT_ROOT]) {
    const target = safeJoin(root, jobId);
    if (fs.existsSync(target)) {
      fs.rmSync(target, { recursive: true, force: true });
    }
  }
}

function requireAnthropicKey(req, res, next) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({
      error: 'QuestForgeAI processing is not configured. Set ANTHROPIC_API_KEY before running jobs.',
    });
  }
  next();
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const uploadDir = safeJoin(UPLOAD_ROOT, getRequestJobId(req));
      fs.mkdirSync(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${crypto.randomUUID()}-${sanitizeFilename(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024,
    files: 11,
    fields: 4,
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return cb(new Error(`Unsupported file type "${ext || 'unknown'}". Allowed formats: PDF, DOCX, TXT, XLSX.`));
    }
    cb(null, true);
  },
});

const processUploadFields = upload.fields([
  { name: 'questionnaire', maxCount: 1 },
  { name: 'documents', maxCount: 10 },
]);

// Paddle webhook needs the raw body for signature verification, so it must be
// registered with a raw body parser before the global JSON parser.
app.post('/api/paddle/webhook', express.raw({ type: 'application/json', limit: '1mb' }), (req, res) => {
  const signature = req.get('Paddle-Signature');
  const rawBody = req.body;
  if (!verifyWebhookSignature(rawBody, signature)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  let event;
  try {
    event = JSON.parse(rawBody.toString('utf-8'));
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }
  const eventName = event?.event_type || event?.eventType || 'unknown';
  const customerEmail = event?.data?.customer?.email || event?.data?.customer_email || event?.data?.email;
  const tier = event?.data?.custom_data?.tier || event?.data?.customData?.tier;
  console.log(`Paddle webhook: ${eventName} | tier=${tier || 'unknown'} | email=${customerEmail || 'unknown'}`);
  res.json({ received: true });
});

app.use(express.json({ limit: '64kb' }));

// The sales landing page is public. The upload tool is operator-only during pilots.
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'landing.html')));
app.get('/index.html', (req, res) => res.redirect('/'));
app.get('/pricing', (req, res) => res.sendFile(path.join(__dirname, 'public', 'pricing.html')));
app.get('/pricing.html', (req, res) => res.redirect('/pricing'));
app.get('/privacy', (req, res) => res.sendFile(path.join(__dirname, 'public', 'privacy.html')));
app.get('/privacy.html', (req, res) => res.redirect('/privacy'));
app.get('/terms', (req, res) => res.sendFile(path.join(__dirname, 'public', 'terms.html')));
app.get('/terms.html', (req, res) => res.redirect('/terms'));
app.get('/refund', (req, res) => res.sendFile(path.join(__dirname, 'public', 'refund.html')));
app.get('/refund.html', (req, res) => res.redirect('/refund'));
app.get('/security', (req, res) => res.sendFile(path.join(__dirname, 'public', 'security.html')));
app.get('/security.html', (req, res) => res.redirect('/security'));
app.get('/success', (req, res) => res.sendFile(path.join(__dirname, 'public', 'success.html')));
app.get('/success.html', (req, res) => res.redirect('/success'));
app.get('/cancel', (req, res) => res.redirect('/pricing'));
app.get('/app', (req, res) => {
  if (!hasPilotAccess(req)) return sendPilotAccessPage(res);
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use(express.static(path.join(__dirname, 'public'), { index: false }));

const paymentsReady = initPayments();

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    apiKey: !!process.env.ANTHROPIC_API_KEY,
    payments: paymentsReady,
    pilotAccessConfigured: !!process.env.QUESTFORGE_OPERATOR_TOKEN,
    retentionDays: RETENTION_DAYS,
  });
});

app.get('/api/pricing', (req, res) => {
  res.json(getPublicPricing());
});

app.get('/api/payment-config', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const config = getPaymentConfig();
  res.json({
    provider: config.provider,
    ready: config.ready,
    environment: config.environment,
    clientToken: config.clientToken,
    products: config.products.map(({ priceId, ...product }) => ({
      ...product,
      checkoutAvailable: !!priceId && !!config.clientToken,
    })),
  });
});

app.post('/api/checkout', rateLimit('checkout', 20, 15 * 60 * 1000), async (req, res) => {
  if (!paymentsReady) {
    return res.status(503).json({ error: 'Payments not configured yet. Contact us directly.' });
  }
  const { tier, email } = req.body;
  try {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const session = await createCheckoutSession(
      tier || 'standard',
      email,
      `${baseUrl}/success`,
      `${baseUrl}/cancel`
    );
    res.json(session);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/verify-payment/:orderId', async (req, res) => {
  if (!paymentsReady) return res.status(503).json({ error: 'Payments not configured' });
  try {
    const result = await verifyPayment(req.params.orderId);
    res.json(result);
  } catch (err) {
    res.status(410).json({ error: err.message });
  }
});

app.post('/api/process', rateLimit('process', 30, 60 * 60 * 1000), requirePilotAccess, requireAnthropicKey, (req, res, next) => {
  processUploadFields(req, res, (err) => {
    if (!err) return next();
    removeJobFolders(req.jobId);
    const message = err instanceof multer.MulterError ? err.message : err.message || 'Upload failed';
    return res.status(400).json({ error: message });
  });
}, async (req, res) => {
  const { companyName = 'Your Company', senderName = 'the prospect' } = req.body;

  if (!req.files?.questionnaire || !req.files?.documents) {
    removeJobFolders(req.jobId);
    return res.status(400).json({ error: 'Please upload a questionnaire file and at least one security document.' });
  }

  const jobId = req.jobId || getRequestJobId(req);
  const outputDir = safeJoin(OUTPUT_ROOT, jobId);
  fs.mkdirSync(outputDir, { recursive: true });

  res.json({ jobId, message: 'Processing started. Poll /api/status/:jobId for updates.' });

  try {
    const statusFile = path.join(outputDir, 'status.json');
    const writeStatus = (data) => fs.writeFileSync(statusFile, JSON.stringify(data, null, 2));
    const safeCompanyName = sanitizeFileStem(companyName, 'QuestForgeAI_Client');

    writeStatus({ stage: 'Parsing documents...', percent: 5 });

    const docFiles = req.files.documents;
    const parsedDocs = await Promise.all(
      docFiles.map(f => parseDocument(f.path).catch(err => ({
        text: '',
        error: `Could not parse ${f.originalname}: ${err.message}`,
      })))
    );
    const parseErrors = parsedDocs.filter(d => d.error).map(d => d.error);
    const readableDocs = parsedDocs.filter(d => (d.text || '').trim().length > 0);

    if (readableDocs.length === 0) {
      writeStatus({
        stage: 'Error',
        error: 'No readable supporting document text found. Provide at least one readable PDF, DOCX, TXT, or XLSX evidence file.',
        parseErrors,
        percent: 0,
      });
      return;
    }

    writeStatus({ stage: 'Parsing questionnaire...', percent: 15 });

    const qFile = req.files.questionnaire[0];
    const parsedQ = await parseDocument(qFile.path);

    let questions = [];
    if (parsedQ.type === 'excel') {
      questions = extractQuestionsFromExcel(parsedQ);
    } else {
      questions = extractQuestionsFromText(parsedQ.text);
    }

    if (questions.length === 0) {
      writeStatus({ stage: 'Error', error: 'No questions found in questionnaire file. Please check the file format.', percent: 0 });
      return;
    }

    writeStatus({ stage: `Found ${questions.length} questions. Generating answers...`, percent: 20 });

    const results = await processQuestionnaire(
      questions,
      readableDocs,
      companyName,
      ({ completed, total, percent }) => {
        writeStatus({
          stage: `Answering questions... (${completed}/${total})`,
          percent: 20 + Math.round(percent * 0.6),
        });
      }
    );

    writeStatus({ stage: 'Generating cover letter...', percent: 82 });

    const report = buildConfidenceReport(results);
    const coverLetter = await generateRebuttalletter(
      companyName, senderName, report.autoAnswered, report.needsReview
    );

    writeStatus({ stage: 'Building output files...', percent: 90 });

    const summaryPath = path.join(outputDir, `${safeCompanyName}_QuestForgeAI_Report.xlsx`);
    await writeSummaryReport(results, companyName, coverLetter, summaryPath);

    let completedQPath = null;
    if (parsedQ.type === 'excel') {
      completedQPath = path.join(outputDir, `${safeCompanyName}_Completed_Questionnaire.xlsx`);
      await writeExcelOutput(parsedQ.workbook, results, completedQPath);
    }

    writeStatus({
      stage: 'Complete',
      percent: 100,
      done: true,
      report,
      flaggedItems: buildFlaggedItemsList(results),
      coverLetter,
      files: {
        summary: `/api/download/${jobId}/${encodeURIComponent(path.basename(summaryPath))}`,
        completedQ: completedQPath ? `/api/download/${jobId}/${encodeURIComponent(path.basename(completedQPath))}` : null,
      },
    });
  } catch (err) {
    const statusFile = path.join(outputDir, 'status.json');
    fs.writeFileSync(statusFile, JSON.stringify({ stage: 'Error', error: err.message, percent: 0 }, null, 2));
    console.error('Processing error:', err);
  }
});

app.get('/api/status/:jobId', requirePilotAccess, (req, res) => {
  if (!isSafeJobId(req.params.jobId)) {
    return res.status(400).json({ error: 'Invalid job id' });
  }

  const statusFile = safeJoin(OUTPUT_ROOT, req.params.jobId, 'status.json');
  if (!fs.existsSync(statusFile)) {
    return res.status(404).json({ error: 'Job not found' });
  }
  res.json(JSON.parse(fs.readFileSync(statusFile, 'utf-8')));
});

app.get('/api/download/:jobId/:filename', requirePilotAccess, (req, res) => {
  if (!isSafeJobId(req.params.jobId)) {
    return res.status(400).json({ error: 'Invalid job id' });
  }

  const filename = sanitizeFilename(req.params.filename);
  const filePath = safeJoin(OUTPUT_ROOT, req.params.jobId, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  res.download(filePath, filename);
});

ensureWorkspaceDirs();
startRetentionCleanup();

app.listen(PORT, () => {
  console.log(`\nQuestForgeAI running at http://localhost:${PORT}`);
  console.log(`   API key loaded: ${!!process.env.ANTHROPIC_API_KEY}`);
  console.log(`   Pilot access configured: ${!!process.env.QUESTFORGE_OPERATOR_TOKEN}\n`);
});
