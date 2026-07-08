require('dotenv').config();
const { fetchSheetValues } = require('../src/services/google-sheet.service');

async function main() {
  const spreadsheetId = process.env.TEST_SPREADSHEET_ID;
  const sheetName = process.env.TEST_SHEET_NAME || 'Sheet1';
  const range = process.env.TEST_RANGE || 'A1:Z20';
  console.log('Testing Google Sheets connection...');
  console.log('Spreadsheet:', spreadsheetId);
  console.log('Range:', `${sheetName}!${range}`);
  const data = await fetchSheetValues({ spreadsheetId, sheetName, range });
  const rows = data.values || [];
  console.log('\nConnection successful.');
  console.log('Rows found:', rows.length);
  if (rows.length) {
    console.log('\nHeaders / First Row:');
    console.log(rows[0]);
    console.log('\nSample Data:');
    rows.slice(1, 6).forEach((row, idx) => console.log(`${idx + 1}.`, row));
  }
}

main().catch((err) => {
  console.error('\nGoogle Sheets connection failed.');
  console.error(err.response?.data || err.message);
  process.exit(1);
});
