const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const multer = require("multer");
const ApiError = require("../utils/ApiError");
const { errorHandler } = require("./errorHandler");
const { mapUploadError, createKnowledgeFileUpload } = require("./kbUpload");
const { getKnowledgeConfig, DEFAULT_MAX_UPLOAD_BYTES, DEFAULT_MAX_TEXT_CHARS } = require("../config/knowledge");

describe("mapUploadError", () => {
  test("maps an oversized file to 413 with the configured limit", () => {
    const error = mapUploadError(new multer.MulterError("LIMIT_FILE_SIZE"), {
      maxBytes: DEFAULT_MAX_UPLOAD_BYTES,
    });
    assert.ok(error instanceof ApiError);
    assert.equal(error.statusCode, 413);
    assert.match(error.message, /10 MB/);
  });

  test("maps a wrong multipart field to 400", () => {
    const error = mapUploadError(new multer.MulterError("LIMIT_UNEXPECTED_FILE"), {
      maxBytes: DEFAULT_MAX_UPLOAD_BYTES,
    });
    assert.equal(error.statusCode, 400);
    assert.match(error.message, /"file" field/);
  });

  test("keeps a format ApiError from the file filter", () => {
    const original = new ApiError(415, "Unsupported file type.");
    assert.equal(mapUploadError(original, { maxBytes: DEFAULT_MAX_UPLOAD_BYTES }), original);
  });

  test("passes unknown errors through", () => {
    const original = new Error("socket hang up");
    assert.equal(mapUploadError(original, { maxBytes: DEFAULT_MAX_UPLOAD_BYTES }), original);
  });
});

describe("getKnowledgeConfig", () => {
  test("uses the documented defaults", () => {
    assert.deepEqual(getKnowledgeConfig({}), {
      maxUploadBytes: DEFAULT_MAX_UPLOAD_BYTES,
      maxTextChars: DEFAULT_MAX_TEXT_CHARS,
    });
  });

  test("reads positive integer overrides", () => {
    assert.deepEqual(getKnowledgeConfig({ KB_MAX_UPLOAD_BYTES: "2048", KB_MAX_TEXT_CHARS: "500" }), {
      maxUploadBytes: 2048,
      maxTextChars: 500,
    });
  });

  test("fails loudly on an invalid override", () => {
    assert.throws(() => getKnowledgeConfig({ KB_MAX_UPLOAD_BYTES: "0" }), /KB_MAX_UPLOAD_BYTES/);
    assert.throws(() => getKnowledgeConfig({ KB_MAX_TEXT_CHARS: "many" }), /KB_MAX_TEXT_CHARS/);
  });
});

describe("createKnowledgeFileUpload", () => {
  test("rejects a non positive limit", () => {
    assert.throws(() => createKnowledgeFileUpload({ maxBytes: 0 }), /positive integer/);
  });

  test("accepts one in memory file", async () => {
    const response = await postUpload({ maxBytes: 1024 });
    assert.equal(response.status, 200);
    assert.equal(response.body.fileName, "notes.txt");
    assert.equal(response.body.size, 5);
  });

  test("returns 413 for a file over the byte limit", async () => {
    const response = await postUpload({ maxBytes: 1024, contents: "x".repeat(2048) });
    assert.equal(response.status, 413);
    assert.match(response.body.error, /1 KB upload limit/);
  });

  test("returns 415 for a legacy doc file before any body is read", async () => {
    const response = await postUpload({ fileName: "old.doc", mimeType: "application/msword" });
    assert.equal(response.status, 415);
    assert.match(response.body.error, /\.docx/);
  });

  test("returns 400 when the file field is missing", async () => {
    const app = createApp({ maxBytes: 1024 });
    const server = app.listen(0);
    try {
      const response = await fetch(baseUrl(server), { method: "POST", body: new FormData() });
      assert.equal(response.status, 400);
      assert.match((await response.json()).error, /required/);
    } finally {
      await closeServer(server);
    }
  });
});

const createApp = ({ maxBytes }) => {
  const app = express();
  app.post("/upload", createKnowledgeFileUpload({ maxBytes }), (req, res) => {
    res.json({ fileName: req.file.originalname, size: req.file.size });
  });
  app.use(errorHandler);
  return app;
};

const baseUrl = (server) => `http://127.0.0.1:${server.address().port}/upload`;

const closeServer = (server) => new Promise((resolve) => server.close(resolve));

const postUpload = async ({ maxBytes, contents = "hello", fileName = "notes.txt", mimeType = "text/plain" }) => {
  const server = createApp({ maxBytes: maxBytes ?? 1024 }).listen(0);
  try {
    const form = new FormData();
    form.append("file", new Blob([contents], { type: mimeType }), fileName);
    const response = await fetch(baseUrl(server), { method: "POST", body: form });
    return { status: response.status, body: await response.json() };
  } finally {
    await closeServer(server);
  }
};
