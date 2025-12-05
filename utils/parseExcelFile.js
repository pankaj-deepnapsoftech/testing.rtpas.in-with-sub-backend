// utils/parseExcelFile.js
const XLSX = require('xlsx');

function parseExcelFile(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" }); // defval: "" prevents undefined

  return jsonData;
}

module.exports = { parseExcelFile };
