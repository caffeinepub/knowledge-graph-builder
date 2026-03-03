import type { IntentGroup, QueryEntry } from "../types";

// ─── Minimal ZIP reader using native browser DecompressionStream ───────────

interface ZipEntry {
  name: string;
  getData: () => Promise<ArrayBuffer>;
}

async function deflateRaw(compressed: ArrayBuffer): Promise<ArrayBuffer> {
  const ds = new DecompressionStream("deflate-raw");
  const writer = ds.writable.getWriter();
  writer.write(new Uint8Array(compressed));
  writer.close();
  return new Response(ds.readable).arrayBuffer();
}

async function readZipEntries(
  buffer: ArrayBuffer,
): Promise<Map<string, ZipEntry>> {
  const view = new DataView(buffer);
  const entries = new Map<string, ZipEntry>();

  // Find End of Central Directory record (signature 0x06054b50)
  let eocdOffset = -1;
  for (let i = buffer.byteLength - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) throw new Error("Not a valid ZIP file");

  const cdOffset = view.getUint32(eocdOffset + 16, true);
  const cdCount = view.getUint16(eocdOffset + 8, true);

  let offset = cdOffset;
  for (let i = 0; i < cdCount; i++) {
    if (view.getUint32(offset, true) !== 0x02014b50) break;

    const compressionMethod = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);

    const nameBytes = new Uint8Array(buffer, offset + 46, fileNameLength);
    const name = new TextDecoder().decode(nameBytes);

    const capturedOffset = localHeaderOffset;
    const capturedCompressedSize = compressedSize;
    const capturedMethod = compressionMethod;

    entries.set(name, {
      name,
      getData: async () => {
        const localView = new DataView(buffer);
        const localFileNameLen = localView.getUint16(capturedOffset + 26, true);
        const localExtraLen = localView.getUint16(capturedOffset + 28, true);
        const dataStart =
          capturedOffset + 30 + localFileNameLen + localExtraLen;
        const compressedData = buffer.slice(
          dataStart,
          dataStart + capturedCompressedSize,
        );

        if (capturedMethod === 0) {
          // Stored (no compression)
          return compressedData;
        }
        if (capturedMethod === 8) {
          // Deflate
          return deflateRaw(compressedData);
        }
        throw new Error(`Unsupported compression method: ${capturedMethod}`);
      },
    });

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

// ─── Minimal XLSX XML parser ────────────────────────────────────────────────

function parseXML(xmlText: string): Document {
  return new DOMParser().parseFromString(xmlText, "application/xml");
}

function getCellValue(
  cell: Element,
  cellType: string | null,
  sharedStrings: string[],
): string | number | null {
  const vEl = cell.querySelector("v");
  if (!vEl) return null;
  const raw = vEl.textContent ?? "";

  if (cellType === "s") {
    // Shared string index
    const idx = Number.parseInt(raw, 10);
    return sharedStrings[idx] ?? "";
  }
  if (cellType === "str" || cellType === "inlineStr") {
    return raw;
  }
  // Number or date
  const num = Number.parseFloat(raw);
  return Number.isNaN(num) ? raw : num;
}

function colLetterToIndex(col: string): number {
  let result = 0;
  for (let i = 0; i < col.length; i++) {
    result = result * 26 + (col.charCodeAt(i) - 64);
  }
  return result - 1; // 0-based
}

function parseCellRef(ref: string): { col: number; row: number } {
  const match = ref.match(/^([A-Z]+)(\d+)$/);
  if (!match) return { col: 0, row: 0 };
  return {
    col: colLetterToIndex(match[1]),
    row: Number.parseInt(match[2], 10) - 1,
  };
}

/**
 * Parse an .xlsx file into an array of intent groups.
 * Column A: keyword queries
 * Column B: integer frequencies
 * Empty rows in Column A delimit intent groups.
 */
export async function parseExcelFile(file: File): Promise<IntentGroup[]> {
  const arrayBuffer = await file.arrayBuffer();
  const zipEntries = await readZipEntries(arrayBuffer);

  // Load shared strings
  const sharedStrings: string[] = [];
  const ssEntry = zipEntries.get("xl/sharedStrings.xml");
  if (ssEntry) {
    const ssBuffer = await ssEntry.getData();
    const ssText = new TextDecoder().decode(ssBuffer);
    const ssDoc = parseXML(ssText);
    const siElements = ssDoc.querySelectorAll("si");
    for (const si of siElements) {
      // Concatenate all <t> elements within <si>
      const tElements = si.querySelectorAll("t");
      let value = "";
      for (const t of tElements) {
        value += t.textContent ?? "";
      }
      sharedStrings.push(value);
    }
  }

  // Find first sheet
  let sheetEntry = zipEntries.get("xl/worksheets/sheet1.xml");
  if (!sheetEntry) {
    // Try to find any sheet
    for (const [key, entry] of zipEntries) {
      if (key.startsWith("xl/worksheets/sheet") && key.endsWith(".xml")) {
        sheetEntry = entry;
        break;
      }
    }
  }
  if (!sheetEntry) throw new Error("No worksheet found in the Excel file");

  const sheetBuffer = await sheetEntry.getData();
  const sheetText = new TextDecoder().decode(sheetBuffer);
  const sheetDoc = parseXML(sheetText);

  // Build a map of row -> { colA, colB }
  const rowMap = new Map<
    number,
    { colA: string | number | null; colB: string | number | null }
  >();

  const rowElements = sheetDoc.querySelectorAll("row");
  for (const rowEl of rowElements) {
    const rowNum = Number.parseInt(rowEl.getAttribute("r") ?? "0", 10) - 1; // 0-based
    const cells = rowEl.querySelectorAll("c");
    let colA: string | number | null = null;
    let colB: string | number | null = null;

    for (const cell of cells) {
      const ref = cell.getAttribute("r") ?? "";
      const { col } = parseCellRef(ref);
      const cellType = cell.getAttribute("t");
      const value = getCellValue(cell, cellType, sharedStrings);

      if (col === 0) colA = value;
      else if (col === 1) colB = value;
    }

    rowMap.set(rowNum, { colA, colB });
  }

  if (rowMap.size === 0) return [];

  // Sort rows by row number
  const sortedRows = Array.from(rowMap.entries()).sort((a, b) => a[0] - b[0]);

  // Fill in gaps (empty rows not in XML are implicit delimiters)
  const maxRow = sortedRows[sortedRows.length - 1][0];
  const allRows: Array<{
    colA: string | number | null;
    colB: string | number | null;
  }> = [];

  for (let r = 0; r <= maxRow; r++) {
    allRows.push(rowMap.get(r) ?? { colA: null, colB: null });
  }

  // Parse into intent groups
  const intentGroups: IntentGroup[] = [];
  let currentGroup: QueryEntry[] = [];

  for (const row of allRows) {
    const query = row.colA != null ? String(row.colA).trim() : "";
    const freqRaw = row.colB != null ? String(row.colB).trim() : "";
    const frequency =
      freqRaw !== "" ? Math.abs(Number.parseInt(freqRaw, 10)) || 1 : 1;

    if (query === "") {
      if (currentGroup.length > 0) {
        intentGroups.push(currentGroup);
        currentGroup = [];
      }
    } else {
      currentGroup.push({ query, frequency });
    }
  }

  if (currentGroup.length > 0) {
    intentGroups.push(currentGroup);
  }

  return intentGroups.filter((g) => g.length > 0);
}
