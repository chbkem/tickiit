const express = require("express");
const rateLimit = require("express-rate-limit");
const commentsController = require("../controllers/comments");
const validate = require("../middleware/validate");
const requireAuth = require("../middleware/requireAuth");
const {
  ticketIdParamSchema,
  commentParamsSchema,
  createCommentSchema,
  updateCommentSchema,
} = require("../validators/commentSchemas");

const router = express.Router({ mergeParams: true });

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

router.use(requireAuth);

router.get("/", validate(ticketIdParamSchema), commentsController.listComments);
router.post("/", writeLimiter, validate(createCommentSchema), commentsController.createComment);
router.patch("/:commentId", writeLimiter, validate(updateCommentSchema), commentsController.updateComment);
router.delete("/:commentId", writeLimiter, validate(commentParamsSchema), commentsController.deleteComment);

module.exports = router;