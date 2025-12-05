const XLSX = require("xlsx");
const fs = require("fs");


/**
 * Convert Excel file to JSON
 * @param {string} filePath - Path to the Excel file
 * @returns {Array} JSON data from the first sheet
 */
function excelToJson(filePath) {
  // Read Excel file
  const workbook = XLSX.readFile(filePath);

  // Get first sheet name
  const sheetName = workbook.SheetNames[0];

  // Get sheet data
  const sheet = workbook.Sheets[sheetName];

  // Convert sheet to JSON
  const jsonData = XLSX.utils.sheet_to_json(sheet);

  fs.unlinkSync(filePath);


  return jsonData;
}

module.exports = { excelToJson };
