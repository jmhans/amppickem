import path from 'path';
import ExcelJS from 'exceljs';

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join(process.cwd(), 'app/lib/templates/pickem-template.xlsx'));
  const sheet = wb.getWorksheet('Sheet1');
  if (!sheet) throw new Error('no Sheet1');
  for (let row = 1; row <= 25; row++) {
    const vals: string[] = [];
    for (const col of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P']) {
      const cell = sheet.getCell(`${col}${row}`);
      let v: unknown = cell.value;
      if (v && typeof v === 'object' && 'formula' in (v as object)) v = `=${(v as { formula: string }).formula}`;
      if (v != null && v !== '') vals.push(`${col}${row}=${JSON.stringify(v)}`);
    }
    if (vals.length) console.log(vals.join(' | '));
  }
}

main();
