const express = require("express");
const {
  createAuthor,
  getAuthors,
  getAuthorById,
  updateAuthor,
  deleteAuthor,
  getAuthorStats,
} = require("../controllers/authorController");
const { getBooksByAuthor } = require("../controllers/bookController");

const router = express.Router();

router.post("/", createAuthor);
router.get("/", getAuthors);
router.get("/:id", getAuthorById);
router.get("/:id/books", getBooksByAuthor);
router.get("/:id/stats", getAuthorStats);
router.put("/:id", updateAuthor);
router.delete("/:id", deleteAuthor);

module.exports = router;