const path = require("node:path");
const ApiError = require("./ApiError");
const { sanitizeText } = require("./sanitize");
const { PDFParse, PasswordException, InvalidPDFException } = require("pdf-parse");
const mammoth = require("mammoth");
const TurndownService = require("turndown");

const SUPPORTED_EXTENSIONS = Object.freeze(["txt", "md", "pdf", "docx"]);
const FALLBACK_TITLE = "Untitled document";

const FILE_FORMATS = Object.freeze({
  txt: Object.freeze({
    extension: "txt",
    label: "text file",
    mimeTypes: Object.freeze(["text/plain", "application/octet-stream"]),
  }),
  md: Object.freeze({
    extension: "md",
    label: "markdown file",
    mimeTypes: Object.freeze(["text/markdown", "text/x-markdown", "text/plain", "application/octet-stream"]),
  }),
  pdf: Object.freeze({
    extension: "pdf",
    label: "PDF file",
    mimeTypes: Object.freeze(["application/pdf", "application/x-pdf", "application/octet-stream"]),
  }),
  docx: Object.freeze({
    extension: "docx",
    label: "Word file",
    mimeTypes: Object.freeze([
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/zip",
      "application/octet-stream",
    ]),
  }),
});

const getExtension = (fileName) => {
  if (typeof fileName !== "string" || !fileName) return null;
  const base = path.basename(fileName);
  const dot = base.lastIndexOf(".");
  if (dot <= 0 || dot === base.length - 1) return null;
  return base.slice(dot + 1).toLowerCase();
};

const inferFileFormat = ({ fileName, mimeType } = {}) => {
  const extension = getExtension(fileName);
  if (!extension) {
    throw new ApiError(415, "No file name was provided. Upload a txt, md, pdf, or docx file.");
  }
  if (extension === "doc") {
    throw new ApiError(415, 'Legacy ".doc" files are not supported. Save the document as .docx and upload it again.');
  }
  const format = FILE_FORMATS[extension];
  if (!format) {
    throw new ApiError(415, `Unsupported file type ".${extension}". Upload a txt, md, pdf, or docx file.`);
  }
  if (mimeType && !format.mimeTypes.includes(mimeType)) {
    throw new ApiError(415, `The file "${fileName}" declares mime type "${mimeType}", which does not match a .${extension} file.`);
  }
  return format;
};

const titleFromFileName = (fileName) => {
  const base = path.basename(typeof fileName === "string" ? fileName : "");
  const extension = getExtension(base);
  const stem = extension ? base.slice(0, -(extension.length + 1)) : base;
  const clean = sanitizeText(stem).replace(/\s+/g, " ").trim();
  return clean || FALLBACK_TITLE;
};

const extractPlainText = (buffer) => {
  let text = buffer.toString("utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return text;
};

const extractPdfText = async (buffer) => {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText({ pageJoiner: "" });
    return result && result.text ? result.text : "";
  } finally {
    await parser.destroy().catch(() => {});
  }
};

const extractDocxMarkdown = async (buffer) => {
  const result = await mammoth.convertToHtml({ buffer });
  const turndown = new TurndownService();
  return result && result.value ? turndown.turndown(result.value) : "";
};

const pdfExtractionError = (err) => {
  if (err instanceof PasswordException) {
    return new ApiError(422, "This PDF is password protected. Remove the password and upload it again.");
  }
  if (err instanceof InvalidPDFException) {
    return new ApiError(422, "The PDF could not be read. It may be corrupted or not a real PDF file.");
  }
  return new ApiError(422, "The PDF could not be read. It may be corrupted, scanned, or an unsupported format.");
};

const docxExtractionError = () =>
  new ApiError(422, "The Word file could not be read. It may be damaged or not a valid .docx file.");

const extractMarkdown = async ({ buffer, fileName, mimeType, maxChars } = {}) => {
  if (!Buffer.isBuffer(buffer)) {
    throw new ApiError(415, "A file buffer is required.");
  }
  const format = inferFileFormat({ fileName, mimeType });
  let markdown;
  try {
    if (format.extension === "txt" || format.extension === "md") {
      markdown = extractPlainText(buffer);
    } else if (format.extension === "pdf") {
      markdown = await extractPdfText(buffer);
    } else if (format.extension === "docx") {
      markdown = await extractDocxMarkdown(buffer);
    }
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (format.extension === "pdf") throw pdfExtractionError(err);
    if (format.extension === "docx") throw docxExtractionError();
    throw new ApiError(422, "The file could not be read.");
  }
  const clean = sanitizeText(markdown);
  if (!clean) {
    if (format.extension === "pdf") {
      throw new ApiError(422, "No text could be extracted from this PDF. It may be a scanned document with no text layer.");
    }
    if (format.extension === "docx") {
      throw new ApiError(422, "The Word file contains no extractable text.");
    }
    throw new ApiError(422, "The file contains no readable text.");
  }
  if (Number.isInteger(maxChars) && maxChars > 0 && clean.length > maxChars) {
    throw new ApiError(
      422,
      `The extracted text is too large. It is ${clean.length} characters but the limit is ${maxChars}.`,
    );
  }
  return clean;
};

module.exports = {
  SUPPORTED_EXTENSIONS,
  FILE_FORMATS,
  FALLBACK_TITLE,
  getExtension,
  inferFileFormat,
  titleFromFileName,
  extractPlainText,
  extractPdfText,
  extractDocxMarkdown,
  pdfExtractionError,
  docxExtractionError,
  extractMarkdown,
};