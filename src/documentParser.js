const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const XLSX = require('xlsx');

async function parseDocument(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.pdf') {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return { type: 'pdf', text: data.text, pages: data.numpages };
  }

  if (ext === '.docx' || ext === '.doc') {
    const result = await mammoth.extractRawText({ path: filePath });
    return { type: 'word', text: result.value };
  }

  if (ext === '.xlsx' || ext === '.xls') {
    const workbook = XLSX.readFile(filePath);
    const rows = [];
    workbook.SheetNames.forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      json.forEach((row, rowIndex) => {
        rows.push({ sheet: sheetName, row: rowIndex + 1, cells: row });
      });
    });
    return { type: 'excel', rows, workbook };
  }

  if (ext === '.txt') {
    const text = fs.readFileSync(filePath, 'utf-8');
    return { type: 'txt', text };
  }

  throw new Error(`Unsupported file type: ${ext}`);
}

function extractQuestionsFromExcel(parsedDoc) {
  const questions = [];
  parsedDoc.rows.forEach(({ sheet, row, cells }) => {
    // Look for rows where a cell looks like a question (ends with ? or is long text)
    cells.forEach((cell, colIndex) => {
      if (typeof cell === 'string' && cell.trim().length > 20) {
        const isQuestion = cell.includes('?') ||
          cell.toLowerCase().includes('do you') ||
          cell.toLowerCase().includes('does your') ||
          cell.toLowerCase().includes('describe') ||
          cell.toLowerCase().includes('provide') ||
          cell.toLowerCase().includes('explain') ||
          cell.toLowerCase().includes('list') ||
          cell.toLowerCase().includes('what is') ||
          cell.toLowerCase().includes('how do') ||
          cell.toLowerCase().includes('please') ||
          cell.toLowerCase().includes('are there') ||
          cell.toLowerCase().includes('have you');

        if (isQuestion) {
          // Find an empty adjacent cell (likely the answer field)
          const answerColIndex = cells.findIndex((c, i) => i > colIndex && (c === '' || c === null));
          questions.push({
            id: `${sheet}_R${row}_C${colIndex + 1}`,
            question: cell.trim(),
            sheet,
            row,
            questionCol: colIndex,
            answerCol: answerColIndex >= 0 ? answerColIndex : colIndex + 1,
            currentAnswer: answerColIndex >= 0 ? cells[answerColIndex] : '',
          });
        }
      }
    });
  });
  return questions;
}

function extractQuestionsFromText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const questions = [];
  lines.forEach((line, index) => {
    const isQuestion =
      line.endsWith('?') ||
      /^\d+[\.\)]\s/.test(line) ||
      line.toLowerCase().startsWith('do you') ||
      line.toLowerCase().startsWith('does your') ||
      line.toLowerCase().startsWith('describe') ||
      line.toLowerCase().startsWith('provide') ||
      line.toLowerCase().startsWith('please') ||
      line.toLowerCase().startsWith('what is') ||
      line.toLowerCase().startsWith('how do') ||
      line.toLowerCase().startsWith('are there') ||
      line.toLowerCase().startsWith('have you');

    if (isQuestion && line.length > 15) {
      questions.push({
        id: `Q_${index + 1}`,
        question: line,
        row: index + 1,
        currentAnswer: '',
      });
    }
  });
  return questions;
}

module.exports = { parseDocument, extractQuestionsFromExcel, extractQuestionsFromText };
