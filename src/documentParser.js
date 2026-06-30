const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const readExcelFile = require('read-excel-file/node');

function normalizeCell(cell) {
  if (cell === undefined || cell === null) return '';
  if (cell instanceof Date) return cell.toISOString().slice(0, 10);
  return cell;
}

async function parseDocument(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.pdf') {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return { type: 'pdf', text: data.text, pages: data.numpages };
  }

  if (ext === '.docx') {
    const result = await mammoth.extractRawText({ path: filePath });
    return { type: 'word', text: result.value };
  }

  if (ext === '.xlsx') {
    const sheets = await readExcelFile(filePath, { trim: false });
    const rows = [];
    const textLines = [];

    sheets.forEach(({ sheet, data }) => {
      data.forEach((row, rowIndex) => {
        const cells = row.map(normalizeCell);
        rows.push({
          sheet,
          row: rowIndex + 1,
          cells,
        });
        const line = cells.filter(cell => cell !== '').join(' | ');
        if (line) textLines.push(`${sheet} row ${rowIndex + 1}: ${line}`);
      });
    });

    return { type: 'excel', rows, workbook: { sheets }, text: textLines.join('\n') };
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
    cells.forEach((cell, colIndex) => {
      if (typeof cell === 'string' && cell.trim().length > 20) {
        const lower = cell.toLowerCase();
        const isQuestion = cell.includes('?') ||
          lower.includes('do you') ||
          lower.includes('does your') ||
          lower.includes('describe') ||
          lower.includes('provide') ||
          lower.includes('explain') ||
          lower.includes('list') ||
          lower.includes('what is') ||
          lower.includes('how do') ||
          lower.includes('please') ||
          lower.includes('are there') ||
          lower.includes('have you');

        if (isQuestion) {
          const answerColIndex = cells.findIndex((c, i) => i > colIndex && (c === '' || c === null || c === undefined));
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
    const lower = line.toLowerCase();
    const isQuestion =
      line.endsWith('?') ||
      /^\d+[\.\)]\s/.test(line) ||
      lower.startsWith('do you') ||
      lower.startsWith('does your') ||
      lower.startsWith('describe') ||
      lower.startsWith('provide') ||
      lower.startsWith('please') ||
      lower.startsWith('what is') ||
      lower.startsWith('how do') ||
      lower.startsWith('are there') ||
      lower.startsWith('have you');

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
