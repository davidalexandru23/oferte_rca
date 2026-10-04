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

  const offerKeys = Array.from(
    new Set(results.flatMap((result) => result.offers.map((offer) => slug(`${offer.insurer}_${offer.details}`))))
  ).sort();
  
  // Create a mapping from offerKey to original names for the header
  const headerNames = new Map<string, string>();
  results.forEach(res => {
    res.offers.forEach(o => {
      const key = slug(`${o.insurer}_${o.details}`);
      if (!headerNames.has(key)) {
        headerNames.set(key, `${o.insurer} ${o.details}`);
      }
    });
  });

  const headers = [
    ...scenarioColumns,
    ...fixedResultColumns,
    ...offerKeys.map((key) => `pret_${headerNames.get(key)}`)
  ];

  sheet.getRow(1).values = headers;
  results.forEach((result, index) => {
    const row = sheet.getRow(index + 2);
    const byOfferKey = new Map(result.offers.map((offer) => [slug(`${offer.insurer}_${offer.details}`), offer]));
    const values = [
      result.status,
      result.error ?? "",
      result.reference ?? "",
      result.minOffer ?? "",
      ...offerKeys.map((key) => byOfferKey.get(key)?.price ?? "")
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
