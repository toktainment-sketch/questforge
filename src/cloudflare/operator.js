import mammoth from 'mammoth';
import readExcelFile from 'read-excel-file/browser';
import writeExcelFile from 'write-excel-file/browser';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

const params = new URLSearchParams(window.location.search);
const tokenFromUrl = params.get('token');
if (tokenFromUrl) {
  sessionStorage.setItem('questforgeOperatorToken', tokenFromUrl);
  window.history.replaceState({}, document.title, window.location.pathname);
}

const operatorToken = tokenFromUrl || sessionStorage.getItem('questforgeOperatorToken') || '';
const uploadForm = document.getElementById('uploadForm');
const qFile = document.getElementById('qFile');
const docsFiles = document.getElementById('docsFiles');
const qFileList = document.getElementById('qFileList');
const docsFileList = document.getElementById('docsFileList');
const submitBtn = document.getElementById('submitBtn');
const progressSection = document.getElementById('progressSection');
const progressLabel = document.getElementById('progressLabel');
const progressPercent = document.getElementById('progressPercent');
const progressBar = document.getElementById('progressBar');
const resultGrid = document.getElementById('resultGrid');
const downloadLinks = document.getElementById('downloadLinks');
const flaggedList = document.getElementById('flaggedList');
const coverLetterText = document.getElementById('coverLetterText');
const errorBox = document.getElementById('errorBox');
const tokenState = document.getElementById('tokenState');

if (tokenState) {
  tokenState.textContent = operatorToken ? 'Token active' : 'Token missing';
  tokenState.className = `status-pill ${operatorToken ? 'green' : 'amber'}`;
}

function authHeaders() {
  return operatorToken ? { 'x-questforge-token': operatorToken } : {};
}

function setFilesLabel(target, files) {
  target.textContent = !files?.length
    ? 'No file selected'
    : Array.from(files).map(file => file.name).join(', ');
}

function showError(message) {
  errorBox.style.display = 'block';
  errorBox.textContent = `Error: ${message}`;
  submitBtn.disabled = false;
}

function clearError() {
  errorBox.style.display = 'none';
  errorBox.textContent = '';
}

function setProgress(label, percent) {
  progressSection.style.display = 'block';
  progressLabel.textContent = label || 'Processing';
  progressPercent.textContent = `${percent || 0}%`;
  progressBar.style.width = `${percent || 0}%`;
}

function makeStat(value, label) {
  const stat = document.createElement('div');
  stat.className = 'result-stat';
  const strong = document.createElement('strong');
  strong.textContent = value;
  const span = document.createElement('span');
  span.textContent = label;
  stat.append(strong, span);
  return stat;
}

function addDownloadButton(label, blob, filename) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'dl-btn';
  button.textContent = label;
  button.addEventListener('click', () => {
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  });
  downloadLinks.appendChild(button);
}

function renderFlaggedItems(items = []) {
  flaggedList.innerHTML = '';
  if (!items.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No items were flagged in the generated report.';
    flaggedList.appendChild(empty);
    return;
  }
  items.forEach(item => {
    const row = document.createElement('div');
    row.className = 'review-item';
    const title = document.createElement('strong');
    title.textContent = `${item.id}: ${item.question}`;
    const reason = document.createElement('span');
    reason.textContent = item.reason;
    row.append(title, reason);
    flaggedList.appendChild(row);
  });
}

function showResults(report, flaggedItems, coverLetter, files) {
  resultGrid.innerHTML = '';
  resultGrid.append(
    makeStat(report.total, 'Total questions'),
    makeStat(`${report.readyPercent}%`, 'Draft-ready'),
    makeStat(report.needsReview, 'Need review')
  );
  resultGrid.style.display = 'grid';
  downloadLinks.innerHTML = '';
  addDownloadButton('Download report', files.summary.blob, files.summary.filename);
  if (files.completedQuestionnaire) {
    addDownloadButton('Download questionnaire', files.completedQuestionnaire.blob, files.completedQuestionnaire.filename);
  }
  coverLetterText.textContent = coverLetter || 'No cover note returned.';
  renderFlaggedItems(flaggedItems);
}

function normalizeCell(cell) {
  if (cell === undefined || cell === null) return '';
  if (cell instanceof Date) return cell.toISOString().slice(0, 10);
  return cell;
}

async function parseExcel(file) {
  const sheets = await readExcelFile(file, { trim: false });
  const rows = [];
  const textLines = [];
  sheets.forEach(({ sheet, data }) => {
    data.forEach((row, rowIndex) => {
      const cells = row.map(normalizeCell);
      rows.push({ sheet, row: rowIndex + 1, cells });
      const line = cells.filter(cell => cell !== '').join(' | ');
      if (line) textLines.push(`${sheet} row ${rowIndex + 1}: ${line}`);
    });
  });
  return { type: 'excel', rows, workbook: { sheets }, text: textLines.join('\n') };
}

async function parsePdf(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const document = await pdfjs.getDocument({ data: bytes }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map(item => item.str || '').join(' '));
  }
  return { type: 'pdf', text: pages.join('\n\n'), pages: document.numPages };
}

async function parseDocument(file) {
  const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (file.size > 20 * 1024 * 1024) throw new Error(`${file.name} is larger than the 20 MB limit.`);
  if (extension === '.xlsx') return parseExcel(file);
  if (extension === '.pdf') return parsePdf(file);
  if (extension === '.docx') {
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return { type: 'word', text: result.value };
  }
  if (extension === '.txt') return { type: 'txt', text: await file.text() };
  throw new Error(`Unsupported file type: ${extension || 'unknown'}`);
}

function extractQuestionsFromExcel(parsedDocument) {
  const questions = [];
  parsedDocument.rows.forEach(({ sheet, row, cells }) => {
    cells.forEach((cell, columnIndex) => {
      if (typeof cell !== 'string' || cell.trim().length <= 20) return;
      const lower = cell.toLowerCase();
      const isQuestion = cell.includes('?') || [
        'do you', 'does your', 'describe', 'provide', 'explain', 'list',
        'what is', 'how do', 'please', 'are there', 'have you',
      ].some(phrase => lower.includes(phrase));
      if (!isQuestion) return;
      const answerColumnIndex = cells.findIndex((value, index) => index > columnIndex && (value === '' || value === null || value === undefined));
      questions.push({
        id: `${sheet}_R${row}_C${columnIndex + 1}`,
        question: cell.trim(),
        sheet,
        row,
        questionCol: columnIndex,
        answerCol: answerColumnIndex >= 0 ? answerColumnIndex : columnIndex + 1,
        currentAnswer: answerColumnIndex >= 0 ? cells[answerColumnIndex] : '',
      });
    });
  });
  return questions;
}

function extractQuestionsFromText(text) {
  return String(text || '').split('\n').map(line => line.trim()).filter(Boolean).flatMap((line, index) => {
    const lower = line.toLowerCase();
    const isQuestion = line.endsWith('?') || /^\d+[.)]\s/.test(line) || [
      'do you', 'does your', 'describe', 'provide', 'please',
      'what is', 'how do', 'are there', 'have you',
    ].some(phrase => lower.startsWith(phrase));
    return isQuestion && line.length > 15
      ? [{ id: `Q_${index + 1}`, question: line, row: index + 1, currentAnswer: '' }]
      : [];
  });
}

function buildReport(results) {
  const breakdown = {
    high: results.filter(result => result.confidence === 'HIGH').length,
    medium: results.filter(result => result.confidence === 'MEDIUM').length,
    low: results.filter(result => result.confidence === 'LOW').length,
  };
  const needsReview = results.filter(result => result.needsReview).length;
  const autoAnswered = breakdown.high + breakdown.medium;
  return {
    total: results.length,
    autoAnswered,
    needsReview,
    legalFlags: results.filter(result => result.isLegalFlag).length,
    breakdown,
    readyPercent: results.length ? Math.round((autoAnswered / results.length) * 100) : 0,
  };
}

function buildFlaggedItems(results) {
  return results.filter(result => result.needsReview).map(result => ({
    id: result.id,
    question: result.question,
    draftAnswer: result.answer,
    reason: result.isLegalFlag
      ? 'LEGAL FLAG, contains liability or contractual language, review before submitting'
      : result.confidence === 'LOW'
        ? 'LOW CONFIDENCE, documentation did not clearly cover this topic'
        : 'NEEDS REVIEW, flagged for manual verification',
  }));
}

function cell(value, style = {}) {
  return { value: value ?? '', ...style };
}

function row(values, style = {}) {
  return values.map(value => cell(value, style));
}

function sanitizeFileStem(value, fallback) {
  return String(value || fallback).replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 120) || fallback;
}

async function buildSummaryWorkbook(results, companyName, coverLetter) {
  const report = buildReport(results);
  const flagged = buildFlaggedItems(results);
  const header = { fontWeight: 'bold', backgroundColor: '#E8EEF7' };
  const summaryData = [
    [cell('QUESTFORGEAI COMPLETION REPORT', { fontWeight: 'bold', fontSize: 14 })],
    row(['Company', companyName]),
    row(['Date', new Date().toLocaleDateString()]),
    [],
    [cell('SUMMARY', header)],
    row(['Total Questions', report.total]),
    row(['Auto-Answered, High Confidence', report.breakdown.high]),
    row(['Auto-Answered, Medium Confidence', report.breakdown.medium]),
    row(['Flagged for Human Review', report.needsReview]),
    row(['Legal or Contractual Flags', report.legalFlags]),
    row(['Ready to Submit %', `${report.readyPercent}%`]),
    [],
    [cell('COVER LETTER', header)],
    [cell(coverLetter || '')],
    [],
    [cell('FLAGGED ITEMS, REVIEW BEFORE SUBMITTING', header)],
    row(['ID', 'Question', 'Draft Answer', 'Reason'], header),
    ...flagged.map(item => row([item.id, item.question, item.draftAnswer, item.reason])),
  ];
  const answerData = [
    row(['ID', 'Question', 'Answer', 'Confidence', 'Needs Review', 'Legal Flag'], header),
    ...results.map(result => row([
      result.id,
      result.question,
      result.answer,
      result.confidence,
      result.needsReview ? 'YES' : 'no',
      result.isLegalFlag ? 'YES' : 'no',
    ])),
  ];
  return writeExcelFile([
    { sheet: 'Summary Report', data: summaryData, columns: [{ width: 28 }, { width: 90 }, { width: 90 }, { width: 70 }] },
    { sheet: 'All Answers', data: answerData, columns: [{ width: 24 }, { width: 80 }, { width: 100 }, { width: 16 }, { width: 16 }, { width: 16 }] },
  ]).toBlob();
}

async function buildCompletedWorkbook(originalWorkbook, results) {
  if (!originalWorkbook?.sheets) return null;
  const sheetsByName = new Map(originalWorkbook.sheets.map(({ sheet, data }) => [sheet, data.map(sourceRow => sourceRow.map(normalizeCell))]));
  results.forEach(result => {
    if (!result.sheet || !sheetsByName.has(result.sheet)) return;
    const rows = sheetsByName.get(result.sheet);
    const rowIndex = result.row - 1;
    if (!rows[rowIndex]) rows[rowIndex] = [];
    while (rows[rowIndex].length <= result.answerCol) rows[rowIndex].push('');
    rows[rowIndex][result.answerCol] = result.answer;
  });
  const workbook = Array.from(sheetsByName.entries()).map(([sheet, data]) => ({
    sheet: sheet.slice(0, 31),
    data: data.map(sourceRow => sourceRow.map(value => cell(value))),
    columns: [{ width: 14 }, { width: 18 }, { width: 60 }, { width: 80 }, { width: 24 }, { width: 24 }],
  }));
  return writeExcelFile(workbook).toBlob();
}

async function postJson(path, body) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'QuestForgeAI could not complete the request.');
  return payload;
}

function wireUploadZone(zoneId, input) {
  const zone = document.getElementById(zoneId);
  zone.addEventListener('dragover', event => {
    event.preventDefault();
    zone.classList.add('drag');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag'));
  zone.addEventListener('drop', event => {
    event.preventDefault();
    zone.classList.remove('drag');
    input.files = event.dataTransfer.files;
    input.dispatchEvent(new Event('change'));
  });
}

qFile.addEventListener('change', event => setFilesLabel(qFileList, event.target.files));
docsFiles.addEventListener('change', event => setFilesLabel(docsFileList, event.target.files));
wireUploadZone('qZone', qFile);
wireUploadZone('docsZone', docsFiles);

uploadForm.addEventListener('submit', async event => {
  event.preventDefault();
  clearError();
  if (!operatorToken) return showError('Operator token missing. Open /app?token=YOUR_TOKEN once to activate this console.');
  if (!qFile.files[0] || docsFiles.files.length === 0) return showError('Upload one questionnaire and at least one supporting document.');
  if (docsFiles.files.length > 10) return showError('Use no more than 10 supporting documents in one job.');

  submitBtn.disabled = true;
  resultGrid.style.display = 'none';
  downloadLinks.innerHTML = '';
  renderFlaggedItems([]);
  coverLetterText.textContent = 'Cover note will appear after processing.';

  try {
    setProgress('Reading files privately in this browser', 5);
    const questionnaire = await parseDocument(qFile.files[0]);
    const parsedDocuments = await Promise.all(Array.from(docsFiles.files).map(parseDocument));
    const readableDocuments = parsedDocuments.filter(document => document.text?.trim());
    if (!readableDocuments.length) throw new Error('No readable supporting document text was found.');

    const questions = questionnaire.type === 'excel'
      ? extractQuestionsFromExcel(questionnaire)
      : extractQuestionsFromText(questionnaire.text);
    if (!questions.length) throw new Error('No questions were found in the questionnaire. Check the file format.');

    const knowledgeBase = readableDocuments.map(document => document.text).join('\n\n---\n\n').slice(0, 12000);
    const companyName = document.getElementById('companyName').value.trim() || 'Your Company';
    const senderName = document.getElementById('senderName').value.trim() || 'the prospect';
    const results = [];
    const batchSize = 5;

    for (let index = 0; index < questions.length; index += batchSize) {
      const batch = questions.slice(index, index + batchSize);
      const percent = 20 + Math.round((index / questions.length) * 55);
      setProgress(`Drafting answers (${Math.min(index + batch.length, questions.length)}/${questions.length})`, percent);
      const payload = await postJson('/api/answer-batch', { companyName, knowledgeBase, questions: batch });
      results.push(...payload.results);
    }

    const report = buildReport(results);
    setProgress('Writing cover note', 80);
    const { coverLetter } = await postJson('/api/cover-letter', {
      companyName,
      senderName,
      autoAnswered: report.autoAnswered,
      needsReview: report.needsReview,
    });

    setProgress('Building Excel files in this browser', 90);
    const safeCompanyName = sanitizeFileStem(companyName, 'QuestForgeAI_Client');
    const summaryBlob = await buildSummaryWorkbook(results, companyName, coverLetter);
    const completedBlob = questionnaire.type === 'excel' ? await buildCompletedWorkbook(questionnaire.workbook, results) : null;
    showResults(report, buildFlaggedItems(results), coverLetter, {
      summary: { blob: summaryBlob, filename: `${safeCompanyName}_QuestForgeAI_Report.xlsx` },
      completedQuestionnaire: completedBlob
        ? { blob: completedBlob, filename: `${safeCompanyName}_Completed_Questionnaire.xlsx` }
        : null,
    });
    setProgress('Complete. Run mandatory QA before delivery.', 100);
  } catch (error) {
    showError(error.message || 'QuestForgeAI could not complete this job.');
  } finally {
    submitBtn.disabled = false;
  }
});
