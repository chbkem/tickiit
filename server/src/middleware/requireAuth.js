const { getAuth } = require("@clerk/express");
const asyncHandler = require("./asyncHandler");

const requireAuth = asyncHandler(async (req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  req.userId = userId;
  next();
});

module.exports = requireAuth;