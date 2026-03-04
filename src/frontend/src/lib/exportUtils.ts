import type {
  KnowledgeGraph,
  OntologyEntry,
  TaxonomyNode,
  Triplet,
} from "../types";
import { ontologyToCSV } from "./ontology";
import { flattenTaxonomy } from "./taxonomy";
import { tripletsToCSV } from "./triplets";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadText(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  downloadBlob(blob, filename);
}

/**
 * Export all analysis results as a single JSON file.
 */
export function exportToJSON(
  graph: KnowledgeGraph,
  triplets: Triplet[],
  taxonomy: TaxonomyNode,
  ontology: OntologyEntry[],
) {
  const data = {
    exportedAt: new Date().toISOString(),
    graph: {
      nodes: graph.nodes.map((n) => ({
        id: n.id,
        label: n.label,
        weight: n.weight,
        tfidf: n.tfidf,
        group: n.group,
        position: { x: n.x, y: n.y, z: n.z },
      })),
      edges: graph.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        relationType: e.relationType,
        weight: e.weight,
      })),
    },
    triplets,
    taxonomy,
    ontology,
  };

  const json = JSON.stringify(data, null, 2);
  downloadText(json, "knowledge-graph.json", "application/json");
}

/**
 * Export article structure as a Markdown file.
 */
export function exportToMarkdown(
  graph: KnowledgeGraph,
  taxonomy: TaxonomyNode,
) {
  const topByTfidf = [...graph.nodes].sort((a, b) => b.tfidf - a.tfidf)[0];
  const h1 =
    taxonomy.label !== "Knowledge Graph" && taxonomy.label !== "Root"
      ? taxonomy.label
      : (topByTfidf?.label ?? "Статья");

  const h2nodes = taxonomy.children.slice(0, 7);

  const h2sections = h2nodes.map((h2node) => ({
    title: h2node.label,
    h3items: h2node.children.slice(0, 4).map((h3) => h3.label),
  }));

  const usedLabels = new Set<string>([
    h1.toLowerCase(),
    ...h2sections.map((s) => s.title.toLowerCase()),
    ...h2sections.flatMap((s) => s.h3items.map((h) => h.toLowerCase())),
  ]);

  const lsiWords = [...graph.nodes]
    .sort((a, b) => b.tfidf - a.tfidf)
    .filter((n) => !usedLabels.has(n.label.toLowerCase()))
    .slice(0, 20)
    .map((n) => n.label);

  const lines: string[] = [`# ${h1}`, ""];
  for (const section of h2sections) {
    lines.push(`## ${section.title}`);
    for (const h3 of section.h3items) {
      lines.push(`### ${h3}`);
    }
    lines.push("");
  }
  if (lsiWords.length > 0) {
    lines.push(`**LSI-слова:** ${lsiWords.join(", ")}`);
  }

  downloadText(lines.join("\n"), "article-structure.md", "text/markdown");
}

/**
 * Export triplets and ontology as separate CSV files.
 */
export function exportToCSV(triplets: Triplet[], ontology: OntologyEntry[]) {
  downloadText(tripletsToCSV(triplets), "triplets.csv", "text/csv");
  setTimeout(() => {
    downloadText(ontologyToCSV(ontology), "ontology.csv", "text/csv");
  }, 300);
}

// ─── Minimal XLSX writer (pure TypeScript, no dependencies) ─────────────────

type SheetRow = (string | number)[];

interface Sheet {
  name: string;
  rows: SheetRow[];
}

/**
 * Encode a string for XML (escape special characters).
 */
function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Convert a 0-based column index to Excel column letters (A, B, ..., Z, AA, ...).
 */
function colIndexToLetter(idx: number): string {
  let result = "";
  let n = idx + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

/**
 * Build the XML content for a single worksheet.
 */
function buildSheetXML(
  rows: SheetRow[],
  sharedStrings: Map<string, number>,
): string {
  let xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetData>`;

  rows.forEach((row, rowIdx) => {
    xml += `<row r="${rowIdx + 1}">`;
    row.forEach((cell, colIdx) => {
      const cellRef = `${colIndexToLetter(colIdx)}${rowIdx + 1}`;
      if (typeof cell === "number") {
        xml += `<c r="${cellRef}"><v>${cell}</v></c>`;
      } else {
        const str = String(cell);
        let ssIdx = sharedStrings.get(str);
        if (ssIdx === undefined) {
          ssIdx = sharedStrings.size;
          sharedStrings.set(str, ssIdx);
        }
        xml += `<c r="${cellRef}" t="s"><v>${ssIdx}</v></c>`;
      }
    });
    xml += "</row>";
  });

  xml += "</sheetData></worksheet>";
  return xml;
}

/**
 * Build the shared strings XML.
 */
function buildSharedStringsXML(sharedStrings: Map<string, number>): string {
  const count = sharedStrings.size;
  let xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${count}" uniqueCount="${count}">`;

  const sorted = Array.from(sharedStrings.entries()).sort(
    (a, b) => a[1] - b[1],
  );
  for (const [str] of sorted) {
    xml += `<si><t xml:space="preserve">${xmlEscape(str)}</t></si>`;
  }
  xml += "</sst>";
  return xml;
}

/**
 * Build workbook XML.
 */
function buildWorkbookXML(sheets: Sheet[]): string {
  let xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>`;
  sheets.forEach((sheet, i) => {
    xml += `<sheet name="${xmlEscape(sheet.name)}" sheetId="${i + 1}" r:id="rId${i + 2}"/>`;
  });
  xml += "</sheets></workbook>";
  return xml;
}

/**
 * Build workbook relationships XML.
 */
function buildWorkbookRelsXML(sheets: Sheet[]): string {
  let xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>`;
  sheets.forEach((_, i) => {
    xml += `<Relationship Id="rId${i + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`;
  });
  xml += "</Relationships>";
  return xml;
}

/**
 * Build [Content_Types].xml
 */
function buildContentTypesXML(sheets: Sheet[]): string {
  let xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>`;
  sheets.forEach((_, i) => {
    xml += `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`;
  });
  xml += "</Types>";
  return xml;
}

/**
 * Build _rels/.rels
 */
function buildRootRelsXML(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
}

// ─── ZIP writer (store-only, no compression) ────────────────────────────────

function strToUint8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function uint32LE(n: number): Uint8Array {
  const buf = new ArrayBuffer(4);
  new DataView(buf).setUint32(0, n, true);
  return new Uint8Array(buf);
}

function uint16LE(n: number): Uint8Array {
  const buf = new ArrayBuffer(2);
  new DataView(buf).setUint16(0, n, true);
  return new Uint8Array(buf);
}

function crc32(data: Uint8Array): number {
  const table = makeCRC32Table();
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

let _crc32Table: Uint32Array | null = null;
function makeCRC32Table(): Uint32Array {
  if (_crc32Table) return _crc32Table;
  _crc32Table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    _crc32Table[i] = c;
  }
  return _crc32Table;
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  // Use a plain ArrayBuffer to avoid SharedArrayBuffer ambiguity
  const resultBuffer = new ArrayBuffer(total);
  const result = new Uint8Array(resultBuffer);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

interface ZipFileRecord {
  name: Uint8Array;
  data: Uint8Array;
  crc: number;
  localHeaderOffset: number;
}

/**
 * Build a ZIP archive (store method, no compression) from a map of filename -> content.
 * Returns a Uint8Array backed by a plain ArrayBuffer (compatible with Blob constructor).
 */
function buildZip(files: Map<string, string>): Uint8Array {
  const records: ZipFileRecord[] = [];
  const localHeaders: Uint8Array[] = [];
  let offset = 0;

  for (const [name, content] of files) {
    const nameBytes = strToUint8(name);
    const dataBytes = strToUint8(content);
    const crc = crc32(dataBytes);

    const localHeader = concat(
      new Uint8Array([0x50, 0x4b, 0x03, 0x04]), // signature
      uint16LE(20), // version needed
      uint16LE(0), // general purpose bit flag
      uint16LE(0), // compression method (stored)
      uint16LE(0), // last mod time
      uint16LE(0), // last mod date
      uint32LE(crc), // crc-32
      uint32LE(dataBytes.length), // compressed size
      uint32LE(dataBytes.length), // uncompressed size
      uint16LE(nameBytes.length), // file name length
      uint16LE(0), // extra field length
      nameBytes,
      dataBytes,
    );

    records.push({
      name: nameBytes,
      data: dataBytes,
      crc,
      localHeaderOffset: offset,
    });
    localHeaders.push(localHeader);
    offset += localHeader.length;
  }

  // Central directory
  const centralDirEntries: Uint8Array[] = [];
  for (const rec of records) {
    const entry = concat(
      new Uint8Array([0x50, 0x4b, 0x01, 0x02]), // signature
      uint16LE(20), // version made by
      uint16LE(20), // version needed
      uint16LE(0), // general purpose bit flag
      uint16LE(0), // compression method
      uint16LE(0), // last mod time
      uint16LE(0), // last mod date
      uint32LE(rec.crc), // crc-32
      uint32LE(rec.data.length), // compressed size
      uint32LE(rec.data.length), // uncompressed size
      uint16LE(rec.name.length), // file name length
      uint16LE(0), // extra field length
      uint16LE(0), // file comment length
      uint16LE(0), // disk number start
      uint16LE(0), // internal file attributes
      uint32LE(0), // external file attributes
      uint32LE(rec.localHeaderOffset), // relative offset of local header
      rec.name,
    );
    centralDirEntries.push(entry);
  }

  const centralDir = concat(...centralDirEntries);
  const centralDirOffset = offset;
  const centralDirSize = centralDir.length;

  // End of central directory record
  const eocd = concat(
    new Uint8Array([0x50, 0x4b, 0x05, 0x06]), // signature
    uint16LE(0), // disk number
    uint16LE(0), // disk with start of central directory
    uint16LE(records.length), // entries on this disk
    uint16LE(records.length), // total entries
    uint32LE(centralDirSize), // size of central directory
    uint32LE(centralDirOffset), // offset of central directory
    uint16LE(0), // comment length
  );

  // Final concat — result is backed by a plain ArrayBuffer
  return concat(...localHeaders, centralDir, eocd);
}

/**
 * Export all analysis results as an Excel (.xlsx) file with multiple worksheets.
 * Pure TypeScript implementation — no external dependencies.
 */
export function exportToExcel(
  graph: KnowledgeGraph,
  triplets: Triplet[],
  taxonomy: TaxonomyNode,
  ontology: OntologyEntry[],
) {
  const sheets: Sheet[] = [
    {
      name: "Nodes",
      rows: [
        ["ID", "Label", "Weight", "TFIDF", "Group", "X", "Y", "Z"],
        ...graph.nodes.map((n) => [
          n.id,
          n.label,
          n.weight,
          n.tfidf,
          n.group,
          n.x,
          n.y,
          n.z,
        ]),
      ],
    },
    {
      name: "Edges",
      rows: [
        ["ID", "Source", "Target", "RelationType", "Weight"],
        ...graph.edges.map((e) => [
          e.id,
          e.source,
          e.target,
          e.relationType,
          e.weight,
        ]),
      ],
    },
    {
      name: "Triplets",
      rows: [
        ["Subject", "Predicate", "Object", "Weight"],
        ...triplets.map((t) => [t.subject, t.predicate, t.object, t.weight]),
      ],
    },
    {
      name: "Taxonomy",
      rows: [
        ["ID", "Label", "Depth", "Parent", "Weight", "TFIDF"],
        ...flattenTaxonomy(taxonomy).map((t) => [
          t.id,
          t.label,
          t.depth,
          t.parent,
          t.weight,
          t.tfidf,
        ]),
      ],
    },
    {
      name: "Ontology",
      rows: [
        ["Entity A", "Entity B", "Relation Type", "Confidence"],
        ...ontology.map((o) => [
          o.entityA,
          o.entityB,
          o.relationType,
          o.confidence,
        ]),
      ],
    },
  ];

  // Build shared strings map (shared across all sheets)
  const sharedStrings = new Map<string, number>();

  for (const sheet of sheets) {
    for (const row of sheet.rows) {
      for (const cell of row) {
        if (typeof cell === "string" && !sharedStrings.has(cell)) {
          sharedStrings.set(cell, sharedStrings.size);
        }
      }
    }
  }

  // Build all XML files
  const files = new Map<string, string>();
  files.set("[Content_Types].xml", buildContentTypesXML(sheets));
  files.set("_rels/.rels", buildRootRelsXML());
  files.set("xl/workbook.xml", buildWorkbookXML(sheets));
  files.set("xl/_rels/workbook.xml.rels", buildWorkbookRelsXML(sheets));
  files.set("xl/sharedStrings.xml", buildSharedStringsXML(sharedStrings));

  sheets.forEach((sheet, i) => {
    files.set(
      `xl/worksheets/sheet${i + 1}.xml`,
      buildSheetXML(sheet.rows, sharedStrings),
    );
  });

  const zipBytes = buildZip(files);

  // Explicitly use zipBytes.buffer cast to ArrayBuffer to satisfy TypeScript's Blob constructor types
  const blob = new Blob([zipBytes.buffer as ArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  downloadBlob(blob, "knowledge-graph.xlsx");
}
