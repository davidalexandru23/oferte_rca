import ExcelJS from "exceljs";
import { parse as parseCsv } from "csv-parse/sync";
import { scenarioColumns } from "../types.js";
const sheetName = "Scenarii";
const sampleRow = {
    stare_legala: "Inmatriculat",
    transfer_proprietate: "Nu",
    tip_auto: "Autoturism",
    combustibil: "Benzina",
    nr_locuri: "5",
    tip_persoana: "fizica",
    conducator_principal_acelasi: "Da",
    durata_luni: "12",
    decontare_directa: "Nu"
};
export async function createTemplateBuffer() {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "asigurare-check";
    const sheet = workbook.addWorksheet(sheetName, { views: [{ state: "frozen", ySplit: 1 }] });
    sheet.addRow([...scenarioColumns]);
    sheet.addRow(scenarioColumns.map((column) => sampleRow[column] ?? ""));
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1F4E79" }
    };
    sheet.columns = scenarioColumns.map((column) => ({
        key: column,
        width: Math.max(column.length + 2, 16)
    }));
    sheet.autoFilter = {
        from: "A1",
        to: `${sheet.getColumn(scenarioColumns.length).letter}1`
    };
    return Buffer.from(await workbook.xlsx.writeBuffer());
}
export async function parseScenarioFile(filename, content) {
    const lower = filename.toLowerCase();
    if (lower.endsWith(".csv")) {
        return parseScenarioCsv(content);
    }
    if (lower.endsWith(".xlsx")) {
        return parseScenarioWorkbook(content);
    }
    throw new Error("Fisierul trebuie sa fie .xlsx sau .csv");
}
async function parseScenarioWorkbook(content) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(content);
    const sheet = workbook.getWorksheet(sheetName) ?? workbook.worksheets[0];
    if (!sheet)
        throw new Error("Workbook fara worksheet");
    const headers = readHeaders(sheet.getRow(1).values);
    validateHeaders(headers);
    const rows = [];
    sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1)
            return;
        const scenario = rowToScenario(headers, row.values);
        if (Object.values(scenario).some((value) => value !== "")) {
            rows.push(scenario);
        }
    });
    return { workbook, sheetName: sheet.name, rows };
}
function parseScenarioCsv(content) {
    const records = parseCsv(content, {
        bom: true,
        columns: true,
        skip_empty_lines: true,
        trim: true
    });
    validateHeaders(Object.keys(records[0] ?? {}));
    const rows = records.map((record) => Object.fromEntries(scenarioColumns.map((column) => [column, normalizeCell(record[column])])));
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(sheetName);
    sheet.addRow([...scenarioColumns]);
    rows.forEach((row) => sheet.addRow(scenarioColumns.map((column) => row[column])));
    return { workbook, sheetName, rows };
}
function readHeaders(values) {
    return Array.isArray(values)
        ? values.slice(1).map((value) => normalizeCell(value))
        : Object.values(values).map((value) => normalizeCell(value));
}
function rowToScenario(headers, values) {
    const list = Array.isArray(values) ? values.slice(1) : Object.values(values);
    const raw = Object.fromEntries(headers.map((header, index) => [header, normalizeCell(list[index])]));
    return Object.fromEntries(scenarioColumns.map((column) => [column, normalizeCell(raw[column])]));
}
function validateHeaders(headers) {
    const missing = scenarioColumns.filter((column) => !headers.includes(column));
    if (missing.length) {
        throw new Error(`Lipsesc coloane obligatorii: ${missing.join(", ")}`);
    }
}
function normalizeCell(value) {
    if (value == null)
        return "";
    if (value instanceof Date)
        return value.toISOString().slice(0, 10);
    if (typeof value === "object" && "text" in value && typeof value.text === "string") {
        return value.text.trim();
    }
    if (typeof value === "object" && "result" in value) {
        return normalizeCell(value.result);
    }
    return String(value).trim();
}
