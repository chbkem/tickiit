const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { PasswordException, InvalidPDFException } = require("pdf-parse");
const {
  extractMarkdown,
  inferFileFormat,
  pdfExtractionError,
  SUPPORTED_EXTENSIONS,
} = require("./fileFormats");
const ApiError = require("./ApiError");

const FIXTURES = path.join(__dirname, "__fixtures__");
const fixture = (name) => Buffer.from(fs.readFileSync(path.join(FIXTURES, name), "utf8"), "base64");

describe("fileFormats", () => {
  test("supports the four upload formats in the spec", () => {
    assert.deepEqual([...SUPPORTED_EXTENSIONS].sort(), ["docx", "md", "pdf", "txt"]);
  });

  test("inferFileFormat accepts txt with a matching mime", () => {
    const format = inferFileFormat({ fileName: "notes.txt", mimeType: "text/plain" });
    assert.equal(format.extension, "txt");
  });

  test("inferFileFormat is case insensitive on the extension", () => {
    assert.equal(inferFileFormat({ fileName: "REPORT.PDF" }).extension, "pdf");
  });

  test("inferFileFormat rejects legacy .doc with a clear message", () => {
    assert.throws(
      () => inferFileFormat({ fileName: "old.doc", mimeType: "application/msword" }),
      (err) => err instanceof ApiError && err.statusCode === 415 && /\.docx/.test(err.message),
    );
  });

  test("inferFileFormat rejects an unsupported extension", () => {
    assert.throws(
      () => inferFileFormat({ fileName: "run.exe", mimeType: "application/octet-stream" }),
      (err) => err instanceof ApiError && err.statusCode === 415 && /\.exe/.test(err.message),
    );
  });

  test("inferFileFormat rejects a missing or dangling extension", () => {
    assert.throws(() => inferFileFormat({ fileName: "noext", mimeType: "text/plain" }), (err) => err.statusCode === 415);
    assert.throws(() => inferFileFormat({ fileName: "dot." }), (err) => err.statusCode === 415);
  });

  test("inferFileFormat rejects a mime type that contradicts the extension", () => {
    assert.throws(
      () => inferFileFormat({ fileName: "doc.pdf", mimeType: "text/plain" }),
      (err) => err instanceof ApiError && err.statusCode === 415 && /mime type/.test(err.message),
    );
  });

  test("txt content passes through, trimmed and sanitized", async () => {
    const out = await extractMarkdown({
      buffer: Buffer.from("  Hello <b>plain</b> world  "),
      fileName: "notes.txt",
      mimeType: "text/plain",
    });
    assert.equal(out, "Hello plain world");
  });

  test("md content keeps markdown formatting and strips markup", async () => {
    const out = await extractMarkdown({
      buffer: Buffer.from("# Title\n\nA <b>bold</b> statement."),
      fileName: "runbook.md",
      mimeType: "text/markdown",
    });
    assert.equal(out, "# Title\n\nA bold statement.");
  });

  test("a txt with no readable text fails with 422", async () => {
    await assert.rejects(
      extractMarkdown({ buffer: Buffer.from(" \n "), fileName: "empty.txt", mimeType: "text/plain" }),
      (err) => err instanceof ApiError && err.statusCode === 422 && /no readable text/.test(err.message),
    );
  });

  test("a PDF with a text layer extracts its text", async () => {
    const out = await extractMarkdown({
      buffer: fixture("sample-text.pdf.b64"),
      fileName: "brochure.pdf",
      mimeType: "application/pdf",
    });
    assert.match(out, /Hello knowledge world/);
  });

  test("a scanned PDF with no text layer fails with 422", async () => {
    await assert.rejects(
      extractMarkdown({ buffer: fixture("blank.pdf.b64"), fileName: "scan.pdf", mimeType: "application/pdf" }),
      (err) => err instanceof ApiError && err.statusCode === 422 && /scanned/.test(err.message),
    );
  });

  test("a corrupted PDF fails with 422", async () => {
    await assert.rejects(
      extractMarkdown({ buffer: Buffer.from("this is not a pdf"), fileName: "bad.pdf", mimeType: "application/pdf" }),
      (err) => err instanceof ApiError && err.statusCode === 422 && /could not be read/.test(err.message),
    );
  });

  test("a password protected PDF maps to a clear 422", () => {
    const err = pdfExtractionError(new PasswordException("encrypted"));
    assert.ok(err instanceof ApiError);
    assert.equal(err.statusCode, 422);
    assert.match(err.message, /password protected/i);
  });

  test("a structurally invalid PDF maps to a clear 422", () => {
    const err = pdfExtractionError(new InvalidPDFException("bad structure"));
    assert.equal(err.statusCode, 422);
    assert.match(err.message, /could not be read/);
  });

  test("a docx file becomes markdown", async () => {
    const out = await extractMarkdown({
      buffer: fixture("sample.docx.b64"),
      fileName: "policy.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    assert.match(out, /Refund policy for tickets/);
    assert.match(out, /Refunds are issued within 14 days/);
  });

  test("a corrupted docx file fails with 422", async () => {
    await assert.rejects(
      extractMarkdown({ buffer: Buffer.from("not a zip"), fileName: "bad.docx", mimeType: "application/zip" }),
      (err) => err instanceof ApiError && err.statusCode === 422 && /Word file could not be read/.test(err.message),
    );
  });

  test("rejects a non buffer input", async () => {
    await assert.rejects(
      extractMarkdown({ buffer: "string instead of buffer", fileName: "a.txt", mimeType: "text/plain" }),
      (err) => err instanceof ApiError && err.statusCode === 415,
    );
  });
});