const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const writeExcelFile = require('write-excel-file/node');

const { parseDocument, extractQuestionsFromExcel, extractQuestionsFromText } = require('../src/documentParser');
const { buildConfidenceReport, writeExcelOutput, writeSummaryReport } = require('../src/reportBuilder');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'questforge-test-'));
}

test('extractQuestionsFromText finds questionnaire-style prompts', () => {
  const questions = extractQuestionsFromText(`
    Welcome to the questionnaire
    1. Describe your incident response process.
    This line is context only.
    Do you enforce MFA for production access?
  `);

  assert.equal(questions.length, 2);
  assert.equal(questions[0].id, 'Q_2');
  assert.match(questions[1].question, /MFA/);
});

test('parseDocument reads xlsx files and extracts answer targets', async () => {
  const dir = tempDir();
  const inputPath = path.join(dir, 'questionnaire.xlsx');
  await writeExcelFile([
    ['ID', 'Category', 'Question', 'Vendor Response'],
    ['Q1', 'Access', 'Do you enforce MFA for production access?', ''],
    ['Q2', 'Privacy', 'Describe your data retention policy.', ''],
  ], {
    sheet: 'Questionnaire',
    columns: [{ width: 8 }, { width: 16 }, { width: 70 }, { width: 60 }],
  }).toFile(inputPath);

  const parsed = await parseDocument(inputPath);
  const questions = extractQuestionsFromExcel(parsed);

  assert.equal(parsed.type, 'excel');
  assert.equal(questions.length, 2);
  assert.equal(questions[0].sheet, 'Questionnaire');
  assert.equal(questions[0].answerCol, 3);
  assert.match(parsed.text, /Do you enforce MFA/);
});

test('buildConfidenceReport handles empty and populated results', () => {
  assert.equal(buildConfidenceReport([]).readyPercent, 0);

  const report = buildConfidenceReport([
    { confidence: 'HIGH', needsReview: false },
    { confidence: 'MEDIUM', needsReview: false },
    { confidence: 'LOW', needsReview: true, isLegalFlag: true },
  ]);

  assert.equal(report.total, 3);
  assert.equal(report.autoAnswered, 2);
  assert.equal(report.needsReview, 1);
  assert.equal(report.legalFlags, 1);
  assert.equal(report.readyPercent, 67);
});

test('writeSummaryReport writes a parseable xlsx report', async () => {
  const dir = tempDir();
  const outputPath = path.join(dir, 'report.xlsx');

  await writeSummaryReport([
    {
      id: 'Q1',
      question: 'Do you enforce MFA?',
      answer: 'Yes, MFA is enforced.',
      confidence: 'HIGH',
      needsReview: false,
      isLegalFlag: false,
    },
  ], 'Acme', 'Please review the attached draft.', outputPath);

  assert.equal(fs.existsSync(outputPath), true);
  const parsed = await parseDocument(outputPath);
  assert.equal(parsed.type, 'excel');
  assert.ok(parsed.rows.some(row => row.cells.includes('QUESTFORGE COMPLETION REPORT')));
});

test('writeExcelOutput writes generated answers into the questionnaire sheet', async () => {
  const dir = tempDir();
  const inputPath = path.join(dir, 'questionnaire.xlsx');
  const outputPath = path.join(dir, 'completed.xlsx');
  await writeExcelFile([
    ['ID', 'Category', 'Question', 'Vendor Response'],
    ['Q1', 'Access', 'Do you enforce MFA for production access?', ''],
  ], { sheet: 'Questionnaire' }).toFile(inputPath);

  const parsed = await parseDocument(inputPath);
  const [question] = extractQuestionsFromExcel(parsed);

  await writeExcelOutput(parsed.workbook, [{
    ...question,
    answer: 'Yes. MFA is enforced for production access.',
  }], outputPath);

  const completed = await parseDocument(outputPath);
  const completedRow = completed.rows.find(row => row.row === 2);
  assert.equal(completedRow.cells[3], 'Yes. MFA is enforced for production access.');
});
