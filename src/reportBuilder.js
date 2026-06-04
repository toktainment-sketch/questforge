const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

function buildConfidenceReport(results) {
  const high = results.filter(r => r.confidence === 'HIGH').length;
  const medium = results.filter(r => r.confidence === 'MEDIUM').length;
  const low = results.filter(r => r.confidence === 'LOW').length;
  const flagged = results.filter(r => r.needsReview).length;
  const legalFlags = results.filter(r => r.isLegalFlag).length;

  return {
    total: results.length,
    autoAnswered: high + medium,
    needsReview: flagged,
    legalFlags,
    breakdown: { high, medium, low },
    readyPercent: Math.round(((high + medium) / results.length) * 100),
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
        ? 'LEGAL FLAG — contains liability/contractual language, review before submitting'
        : r.confidence === 'LOW'
        ? 'LOW CONFIDENCE — documentation did not clearly cover this topic'
        : 'NEEDS REVIEW — flagged for manual verification',
    }));
}

function writeExcelOutput(originalWorkbook, results, outputPath) {
  // Clone original workbook so we preserve all formatting and structure
  const wb = XLSX.utils.book_new();

  // Write answers back into original structure
  results.forEach(result => {
    if (!result.sheet) return;
    const ws = originalWorkbook.Sheets[result.sheet];
    if (!ws) return;

    const cellAddress = XLSX.utils.encode_cell({ r: result.row - 1, c: result.answerCol });
    ws[cellAddress] = { t: 's', v: result.answer };
  });

  originalWorkbook.SheetNames.forEach(name => {
    XLSX.utils.book_append_sheet(wb, originalWorkbook.Sheets[name], name);
  });

  XLSX.writeFile(wb, outputPath);
}

function writeSummaryReport(results, companyName, coverLetter, outputPath) {
  const report = buildConfidenceReport(results);
  const flagged = buildFlaggedItemsList(results);

  const summarySheet = XLSX.utils.aoa_to_sheet([
    ['QUESTFORGE — COMPLETION REPORT'],
    ['Company', companyName],
    ['Date', new Date().toLocaleDateString()],
    [''],
    ['SUMMARY'],
    ['Total Questions', report.total],
    ['Auto-Answered (High Confidence)', report.breakdown.high],
    ['Auto-Answered (Medium Confidence)', report.breakdown.medium],
    ['Flagged for Human Review', report.needsReview],
    ['Legal/Contractual Flags', report.legalFlags],
    ['Ready to Submit %', `${report.readyPercent}%`],
    [''],
    ['COVER LETTER'],
    [coverLetter || ''],
    [''],
    ['FLAGGED ITEMS — REVIEW BEFORE SUBMITTING'],
    ['ID', 'Question', 'Draft Answer', 'Reason'],
    ...flagged.map(f => [f.id, f.question, f.draftAnswer, f.reason]),
  ]);

  const allAnswersSheet = XLSX.utils.aoa_to_sheet([
    ['ID', 'Question', 'Answer', 'Confidence', 'Needs Review', 'Legal Flag'],
    ...results.map(r => [
      r.id,
      r.question,
      r.answer,
      r.confidence,
      r.needsReview ? 'YES' : 'no',
      r.isLegalFlag ? 'YES' : 'no',
    ]),
  ]);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary Report');
  XLSX.utils.book_append_sheet(wb, allAnswersSheet, 'All Answers');
  XLSX.writeFile(wb, outputPath);
}

module.exports = { buildConfidenceReport, buildFlaggedItemsList, writeExcelOutput, writeSummaryReport };
