import type ExcelJS from "exceljs";
import { scenarioColumns, type ScenarioResult } from "../types.js";

const fixedResultColumns = ["status", "eroare", "referinta_cotatie", "oferta_minima"];

export async function writeResultsWorkbook(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  results: ScenarioResult[]
) {
  const sheet = workbook.getWorksheet(sheetName) ?? workbook.worksheets[0];
  if (!sheet) throw new Error("Workbook fara worksheet pentru export");

  const insurers = Array.from(
    new Set(results.flatMap((result) => result.offers.map((offer) => slug(offer.insurer))))
  ).sort();
  const headers = [
    ...scenarioColumns,
    ...fixedResultColumns,
    ...insurers.map((insurer) => `pret_${insurer}`),
    ...insurers.map((insurer) => `detalii_${insurer}`)
  ];

  sheet.getRow(1).values = headers;
  results.forEach((result, index) => {
    const row = sheet.getRow(index + 2);
    const byInsurer = new Map(result.offers.map((offer) => [slug(offer.insurer), offer]));
    const values = [
      result.status,
      result.error ?? "",
      result.reference ?? "",
      result.minOffer ?? "",
      ...insurers.map((insurer) => byInsurer.get(insurer)?.price ?? ""),
      ...insurers.map((insurer) => byInsurer.get(insurer)?.details ?? "")
    ];
    values.forEach((value, offset) => {
      row.getCell(scenarioColumns.length + offset + 1).value = value;
    });
    row.commit();
  });

  sheet.columns?.forEach((column) => {
    const header = String(column.header ?? "");
    column.width = Math.min(Math.max(header.length + 2, 14), 32);
  });
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}
