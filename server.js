const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env'), override: true });
require('dotenv').config({ path: path.join(require('os').homedir(), '.cleo', 'secrets', '.env'), override: true });
const express = require('express');
const multer = require('multer');
const fs = require('fs');

const { parseDocument, extractQuestionsFromExcel, extractQuestionsFromText } = require('./src/documentParser');
const { processQuestionnaire, generateRebuttalletter } = require('./src/answerEngine');
const { writeExcelOutput, writeSummaryReport, buildConfidenceReport } = require('./src/reportBuilder');
const { initStripe, createCheckoutSession, verifyPayment, PRODUCTS } = require('./src/payments');

const app = express();
const PORT = process.env.PORT || 3000;

// Store upload files
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } }); // 20MB limit

app.use(express.json());
app.use(express.static('public'));
app.use('/output', express.static('output'));

const stripeReady = initStripe();

// ── ROUTES ────────────────────────────────────────────────────────────────────

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', apiKey: !!process.env.ANTHROPIC_API_KEY, stripe: stripeReady });
});

// ── PAYMENT ROUTES ───────────────────────────────────────────────────────────

app.get('/api/pricing', (req, res) => {
  const pricing = Object.entries(PRODUCTS).map(([tier, p]) => ({
    tier,
    name: p.name,
    price: p.price / 100,
    description: p.description,
    recurring: !!p.recurring,
  }));
  res.json(pricing);
});

app.post('/api/checkout', async (req, res) => {
  if (!stripeReady) {
    return res.status(503).json({ error: 'Payments not configured yet. Contact us directly.' });
  }
  const { tier, email } = req.body;
  try {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const session = await createCheckoutSession(
      tier || 'standard',
      email,
      `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      `${baseUrl}/cancel`
    );
    res.json(session);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/verify-payment/:sessionId', async (req, res) => {
  if (!stripeReady) return res.status(503).json({ error: 'Payments not configured' });
  try {
    const result = await verifyPayment(req.params.sessionId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Main processing endpoint
app.post('/api/process', upload.fields([
  { name: 'questionnaire', maxCount: 1 },
  { name: 'documents', maxCount: 10 },
]), async (req, res) => {
  const { companyName = 'Your Company', senderName = 'the prospect' } = req.body;

  if (!req.files?.questionnaire || !req.files?.documents) {
    return res.status(400).json({ error: 'Please upload a questionnaire file and at least one security document.' });
  }

  const jobId = `job_${Date.now()}`;
  const outputDir = path.join('output', jobId);
  fs.mkdirSync(outputDir, { recursive: true });

  // Respond immediately with job ID, processing happens async
  res.json({ jobId, message: 'Processing started. Poll /api/status/:jobId for updates.' });

  // ── ASYNC PROCESSING ──────────────────────────────────────────────────────
  try {
    const statusFile = path.join(outputDir, 'status.json');
    const writeStatus = (data) => fs.writeFileSync(statusFile, JSON.stringify(data));

    writeStatus({ stage: 'Parsing documents...', percent: 5 });

    // Parse all security documents
    const docFiles = req.files.documents;
    const parsedDocs = await Promise.all(
      docFiles.map(f => parseDocument(f.path).catch(() => ({ text: '' })))
    );

    writeStatus({ stage: 'Parsing questionnaire...', percent: 15 });

    // Parse questionnaire
    const qFile = req.files.questionnaire[0];
    const parsedQ = await parseDocument(qFile.path);

    // Extract questions
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

    // Generate answers
    const results = await processQuestionnaire(
      questions,
      parsedDocs,
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

    // Write outputs
    const summaryPath = path.join(outputDir, `${companyName}_QuestForge_Report.xlsx`);
    writeSummaryReport(results, companyName, coverLetter, summaryPath);

    // If original was Excel, also write filled-in questionnaire
    let completedQPath = null;
    if (parsedQ.type === 'excel') {
      completedQPath = path.join(outputDir, `${companyName}_Completed_Questionnaire.xlsx`);
      writeExcelOutput(parsedQ.workbook, results, completedQPath);
    }

    writeStatus({
      stage: 'Complete',
      percent: 100,
      done: true,
      report,
      coverLetter,
      files: {
        summary: `/output/${jobId}/${path.basename(summaryPath)}`,
        completedQ: completedQPath ? `/output/${jobId}/${path.basename(completedQPath)}` : null,
      },
    });

  } catch (err) {
    const statusFile = path.join(outputDir, 'status.json');
    fs.writeFileSync(statusFile, JSON.stringify({ stage: 'Error', error: err.message, percent: 0 }));
    console.error('Processing error:', err);
  }
});

// Poll job status
app.get('/api/status/:jobId', (req, res) => {
  const statusFile = path.join('output', req.params.jobId, 'status.json');
  if (!fs.existsSync(statusFile)) {
    return res.status(404).json({ error: 'Job not found' });
  }
  res.json(JSON.parse(fs.readFileSync(statusFile, 'utf-8')));
});

app.listen(PORT, () => {
  console.log(`\n✅ QuestForge running at http://localhost:${PORT}`);
  console.log(`   API key loaded: ${!!process.env.ANTHROPIC_API_KEY}\n`);
});
