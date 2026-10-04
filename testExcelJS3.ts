import ExcelJS from "exceljs";

async function run() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Test");

  sheet.addRow(["A_row", "B_row"]);
  sheet.getRow(2).values = ["A_val", "B_val"];

  await workbook.xlsx.writeFile("test3.xlsx");
  const wb2 = new ExcelJS.Workbook();
  await wb2.xlsx.readFile("test3.xlsx");
  const sh2 = wb2.getWorksheet(1);
  console.log("addRow:", sh2?.getRow(1).values);
  console.log("values=:", sh2?.getRow(2).values);
}
run().catch(console.error);
