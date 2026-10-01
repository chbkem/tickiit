const multer = require("multer");
const ApiError = require("../utils/ApiError");
const { inferFileFormat } = require("../utils/fileFormats");
const { getKnowledgeConfig } = require("../config/knowledge");

const formatBytes = (bytes) => {
  if (bytes >= 1024 * 1024) {
    const megabytes = bytes / (1024 * 1024);
    return `${Number.isInteger(megabytes) ? megabytes : Math.round(megabytes * 10) / 10} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.round((bytes / 1024) * 10) / 10} KB`;
  }
  return `${bytes} bytes`;
};

const mapUploadError = (error, { maxBytes }) => {
  if (error instanceof ApiError) return error;
  if (!(error instanceof multer.MulterError)) return error;

  if (error.code === "LIMIT_FILE_SIZE") {
    return new ApiError(413, `The file is larger than the ${formatBytes(maxBytes)} upload limit.`);
  }
  if (error.code === "LIMIT_UNEXPECTED_FILE") {
    return new ApiError(400, 'Upload one document in the "file" field.');
  }
  if (error.code === "LIMIT_FILE_COUNT") {
    return new ApiError(400, "Upload one file at a time.");
  }
  return new ApiError(400, "The upload could not be processed.");
};

const createKnowledgeFileUpload = ({ maxBytes } = {}) => {
  const limit = maxBytes ?? getKnowledgeConfig().maxUploadBytes;
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error("The knowledge base upload limit must be a positive integer.");
  }

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: limit, files: 1, fields: 0 },
    fileFilter: (req, file, callback) => {
      try {
        inferFileFormat({ fileName: file.originalname, mimeType: file.mimetype });
        callback(null, true);
      } catch (error) {
        callback(error);
      }
    },
  });

  const handleSingle = upload.single("file");
  return (req, res, next) => {
    handleSingle(req, res, (error) => {
      if (error) return next(mapUploadError(error, { maxBytes: limit }));
      if (!req.file) return next(new ApiError(400, 'A file is required in the "file" field.'));
      next();
    });
  };
};

const uploadKnowledgeFile = createKnowledgeFileUpload();

module.exports = {
  createKnowledgeFileUpload,
  mapUploadError,
  uploadKnowledgeFile,
};
