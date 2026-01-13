/**
 * txt-to-pdf-auto.mjs
 * Convierte TXT a PDF detectando encoding (UTF-8 / UTF-16 LE / UTF-16 BE)
 * y normalizando saltos de línea para evitar caracteres como "Ð".
 *
 * Requiere:
 *   npm install pdfkit iconv-lite
 */

import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import iconv from "iconv-lite";

// =========================
// VARIABLES
// =========================
const INPUT_TXT_PATH = "./08inde-SitemapRobotsTxt.txt";
const OUTPUT_PDF_PATH = "./08inde-SitemapRobotsTxt.pdf";

// =========================
// HELPERS
// =========================
function ensureDirExists(filePath) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

function detectEncodingFromBOM(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return "utf8"; // UTF-8 BOM
  }
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return "utf16-le"; // UTF-16 LE BOM
  }
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    return "utf16-be"; // UTF-16 BE BOM
  }
  return "utf8"; // default seguro para la mayoría de txt modernos
}

function stripBOMIfPresent(text) {
  return text.replace(/^\uFEFF/, "");
}

function normalizeContent(text) {
  return stripBOMIfPresent(text)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

// =========================
// CONVERSIÓN
// =========================
async function txtToPdf(inputPath, outputPath) {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`No existe el archivo: ${inputPath}`);
  }

  ensureDirExists(outputPath);

  // Leer como buffer
  const buffer = fs.readFileSync(inputPath);

  // Detectar encoding (BOM si existe; si no, utf8)
  const enc = detectEncodingFromBOM(buffer);

  // Decodificar según encoding detectado
  let content = iconv.decode(buffer, enc);

  // Normalizar para evitar caracteres raros por CR/otros
  content = normalizeContent(content);

  // Si el PDF existe y está cerrado, lo borramos para evitar conflictos
  if (fs.existsSync(outputPath)) {
    try {
      fs.unlinkSync(outputPath);
    } catch {
      // Si está bloqueado (OneDrive / visor PDF), caerá en el EBUSY del stream igual
    }
  }

  const doc = new PDFDocument({
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
  });

  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);

  doc
    .font("Times-Roman")
    .fontSize(11)
    .text(content, {
      align: "left",
      width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
      lineGap: 2,
    });

  doc.end();

  return new Promise((resolve, reject) => {
    stream.on("finish", () => resolve({ outputPath, enc }));
    stream.on("error", reject);
  });
}

// =========================
// EJECUCIÓN
// =========================
try {
  const { outputPath, enc } = await txtToPdf(INPUT_TXT_PATH, OUTPUT_PDF_PATH);
  console.log(`PDF generado correctamente en: ${outputPath}`);
  console.log(`Encoding detectado: ${enc}`);
} catch (err) {
  console.error("Error:");
  console.error(err?.message || err);
  process.exitCode = 1;
}
