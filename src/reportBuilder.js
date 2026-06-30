const writeExcelFile = require('write-excel-file/node');

function buildConfidenceReport(results) {
  const total = results.length;
  const high = results.filter(r => r.confidence === 'HIGH').length;
  const medium = results.filter(r => r.confidence === 'MEDIUM').length;
  const low = results.filter(r => r.confidence === 'LOW').length;
  const flagged = results.filter(r => r.needsReview).length;
  const legalFlags = results.filter(r => r.isLegalFlag).length;

  return {
    total,
    autoAnswered: high + medium,
    needsReview: flagged,
    legalFlags,
    breakdown: { high, medium, low },
    readyPercent: total === 0 ? 0 : Math.round(((high + medium) / total) * 100),
  };
}

function buildFlaggedItemsList(results) {
  return results
    .filter(r => r.needsReview)
    .map(r => ({
      id: r.id,
      question: r.question,
      draftAnswer: r.answer,
      reason: r.isLegalFlag
        ? 'LEGAL FLAG, contains liability/contractual language, review before submitting'
        : r.confidence === 'LOW'
        ? 'LOW CONFIDENCE, documentation did not clearly cover this topic'
        : 'NEEDS REVIEW, flagged for manual verification',
    }));
}

function normalizeCell(value) {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  return String(value);
}

function headerCell(value) {
  return {
    value,
    fontWeight: 'bold',
    backgroundColor: '#E8EEF7',
  };
}

function titleCell(value) {
  return {
    value,
    fontWeight: 'bold',
    fontSize: 14,
  };
}

function buildColumns(widths) {
  return widths.map(width => ({ width }));
}

async function writeExcelOutput(originalWorkbook, results, outputPath) {
  const sheets = originalWorkbook?.sheets || [];
  const sheetsByName = new Map(
    sheets.map(({ sheet, data }) => [sheet, data.map(row => row.map(normalizeCell))])
  );

  results.forEach(result => {
    if (!result.sheet) return;
    const sheetRows = sheetsByName.get(result.sheet);
    if (!sheetRows) return;

    const rowIndex = result.row - 1;
    if (!sheetRows[rowIndex]) sheetRows[rowIndex] = [];
    while (sheetRows[rowIndex].length <= result.answerCol) {
      sheetRows[rowIndex].push(null);
    }
    sheetRows[rowIndex][result.answerCol] = result.answer;
  });

  const sheetPayload = Array.from(sheetsByName.entries()).map(([sheet, data]) => ({
    sheet: sheet.slice(0, 31),
    data,
    columns: buildColumns([14, 18, 60, 80, 24, 24, 24, 24]),
    stickyRowsCount: 1,
  }));

  await writeExcelFile(sheetPayload).toFile(outputPath);
}

async function writeSummaryReport(results, companyName, coverLetter, outputPath) {
  const report = buildConfidenceReport(results);
  const flagged = buildFlaggedItemsList(results);

  const summarySheet = [
    [titleCell('QUESTFORGEAI COMPLETION REPORT')],
    ['Company', companyName],
    ['Date', new Date().toLocaleDateString()],
    [],
    [headerCell('SUMMARY')],
    ['Total Questions', report.total],
    ['Auto-Answered, High Confidence', report.breakdown.high],
    ['Auto-Answered, Medium Confidence', report.breakdown.medium],
    ['Flagged for Human Review', report.needsReview],
    ['Legal/Contractual Flags', report.legalFlags],
    ['Ready to Submit %', `${report.readyPercent}%`],
    [],
    [headerCell('COVER LETTER')],
    [coverLetter || ''],
    [],
    [headerCell('FLAGGED ITEMS, REVIEW BEFORE SUBMITTING')],
    [headerCell('ID'), headerCell('Question'), headerCell('Draft Answer'), headerCell('Reason')],
    ...flagged.map(f => [f.id, f.question, f.draftAnswer, f.reason]),
  ];

  const allAnswersSheet = [
    [
      headerCell('ID'),
      headerCell('Question'),
      headerCell('Answer'),
      headerCell('Confidence'),
      headerCell('Needs Review'),
      headerCell('Legal Flag'),
    ],
    ...results.map(r => [
      r.id,
      r.question,
      r.answer,
      r.confidence,
      r.needsReview ? 'YES' : 'no',
      r.isLegalFlag ? 'YES' : 'no',
    ]),
  ];

  await writeExcelFile([
    {
      sheet: 'Summary Report',
      data: summarySheet,
      columns: buildColumns([28, 90, 90, 70]),
      stickyRowsCount: 1,
    },
    {
      sheet: 'All Answers',
      data: allAnswersSheet,
      columns: buildColumns([24, 80, 100, 16, 16, 16]),
      stickyRowsCount: 1,
    },
  ]).toFile(outputPath);
}

module.exports = { buildConfidenceReport, buildFlaggedItemsList, writeExcelOutput, writeSummaryReport };
