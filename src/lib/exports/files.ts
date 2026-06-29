import ExcelJS from "exceljs";

export type ExportCellValue = string | number | boolean | Date | null | undefined;

export interface ExportColumn<Row> {
  key: keyof Row & string;
  header: string;
}

function normaliseCell(value: ExportCellValue): string | number | boolean {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  return value;
}

function csvEscape(value: ExportCellValue): string {
  const text = String(normaliseCell(value));
  if (/[",\r\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

export function serialiseCsv<Row extends Record<string, ExportCellValue>>(
  columns: ExportColumn<Row>[],
  rows: Row[],
): string {
  const header = columns.map((column) => csvEscape(column.header)).join(",");
  const body = rows.map((row) =>
    columns.map((column) => csvEscape(row[column.key])).join(","),
  );
  return [header, ...body].join("\r\n") + "\r\n";
}

export async function serialiseXlsx<Row extends Record<string, ExportCellValue>>(
  columns: ExportColumn<Row>[],
  rows: Row[],
  sheetName: string,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Convo";
  workbook.created = new Date();
  const worksheet = workbook.addWorksheet(sheetName);
  worksheet.columns = columns.map((column) => ({
    key: column.key,
    header: column.header,
  }));

  for (const row of rows) {
    worksheet.addRow(
      Object.fromEntries(
        columns.map((column) => [column.key, normaliseCell(row[column.key])]),
      ),
    );
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function exportFilename(
  scope: "cases" | "contacts" | "audit",
  tenantSlug: string,
  format: "csv" | "xlsx",
  now: Date = new Date(),
): string {
  const safeSlug = tenantSlug.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const date = now.toISOString().slice(0, 10);
  return `convo-${scope}-${safeSlug}-${date}.${format}`;
}

export function contentTypeForFormat(format: "csv" | "xlsx"): string {
  return format === "csv"
    ? "text/csv; charset=utf-8"
    : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
}
