import ExcelJS from "exceljs";

async function run() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile("test.xlsx");
  const sheet = workbook.getWorksheet(1);
  console.log("Row 1:", sheet?.getRow(1).values);
  console.log("Row 2:", sheet?.getRow(2).values);
}
run().catch(console.error);
