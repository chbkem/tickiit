const ApiError = require("../utils/ApiError");

const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse({
    body: req.body,
    query: req.query,
    params: req.params,
  });
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
    return next(new ApiError(400, "Validation failed.", details));
  }
  Object.assign(req, result.data);
  next();
};

module.exports = validate;