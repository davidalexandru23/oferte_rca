import ExcelJS from "exceljs";

async function run() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Test");

  sheet.getRow(1).values = ["", "Header1", "Header2"];
  sheet.getRow(2).values = ["Val1", "Val2"];

  await workbook.xlsx.writeFile("test.xlsx");
  console.log("Written test.xlsx");
}
run().catch(console.error);
