const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const {
  DEFAULT_MAX_CHUNK_CHARS,
  DEFAULT_MAX_CHUNKS_PER_ARTICLE,
  splitParagraphs,
  hardSplit,
  chunkText,
} = require("./chunker");

describe("chunker", () => {
  test("splitParagraphs splits on blank lines and keeps single line breaks", () => {
    assert.deepEqual(splitParagraphs("a\n\nb\nc"), ["a", "b\nc"]);
    assert.deepEqual(splitParagraphs("a\r\n\r\nb"), ["a", "b"]);
    assert.deepEqual(splitParagraphs("  \n\n  "), []);
    assert.deepEqual(splitParagraphs(""), []);
    assert.deepEqual(splitParagraphs(undefined), []);
  });

  test("chunkText returns empty for empty or whitespace input", () => {
    assert.deepEqual(chunkText(""), []);
    assert.deepEqual(chunkText("   \n\n  "), []);
    assert.deepEqual(chunkText(undefined), []);
    assert.deepEqual(chunkText(null), []);
  });

  test("chunkText emits one chunk per blank line separated paragraph", () => {
    const chunks = chunkText("Alpha notes\n\nBeta logs");
    assert.equal(chunks.length, 2);
    assert.deepEqual(
      chunks.map((chunk) => chunk.body),
      ["Alpha notes", "Beta logs"],
    );
  });

  test("chunkText indexes sequentially from zero", () => {
    const text = Array.from({ length: 5 }, (_, i) => `Paragraph number ${i}`).join("\n\n");
    const chunks = chunkText(text);
    assert.equal(chunks.length, 5);
    chunks.forEach((chunk, i) => assert.equal(chunk.index, i));
  });

  test("chunkText keeps a single short paragraph as one chunk", () => {
    const chunks = chunkText("A short knowledge article about refund policy.");
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].body, "A short knowledge article about refund policy.");
  });

  test("chunkText respects the default max chunk size", () => {
    const paragraph = "The quick brown fox jumps over the lazy dog. ".repeat(40);
    const text = Array.from({ length: 12 }, (_, i) => `${paragraph} Section ${i}`).join("\n\n");
    const chunks = chunkText(text);
    assert.ok(chunks.length > 1, "long input must produce more than one chunk");
    for (const chunk of chunks) {
      assert.ok(chunk.body.length <= DEFAULT_MAX_CHUNK_CHARS);
    }
  });

  test("chunkText respects a custom max chunk size option", () => {
    const paragraph = "Alpha beta gamma delta. ".repeat(60);
    const long = Array.from({ length: 8 }, () => paragraph).join("\n");
    const chunks = chunkText(long, { maxChunkChars: 200 });
    assert.ok(chunks.length > 3);
    for (const chunk of chunks) {
      assert.ok(chunk.body.length <= 200);
    }
  });

  test("chunkText reassembles the full content across chunks", () => {
    const paragraph = "Every careful engineer checks the boundaries. ".repeat(30);
    const chunks = chunkText(paragraph);
    const joined = chunks.map((chunk) => chunk.body).join("");
    assert.equal(joined, paragraph.trim(), "hard splitting never drops characters");
  });

  test("hardSplit splits a single long unit at readable boundaries", () => {
    const unit = "One sentence. Two sentence. Three sentence. ".repeat(30);
    const pieces = hardSplit(unit, 200);
    assert.ok(pieces.length > 1);
    for (const piece of pieces) assert.ok(piece.length <= 200);
    assert.equal(pieces.join(""), unit, "hardSplit never drops characters");
  });

  test("hardSplit falls back to a hard character slice on unbroken text", () => {
    const unit = "a".repeat(500);
    const pieces = hardSplit(unit, 100);
    assert.equal(pieces.length, 5);
    for (const piece of pieces) assert.ok(piece.length <= 100);
  });

  test("exposes a chunk count cap constant for ingestion guardrails", () => {
    assert.ok(DEFAULT_MAX_CHUNKS_PER_ARTICLE >= 10);
  });
});