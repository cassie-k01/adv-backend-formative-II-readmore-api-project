const express = require("express");
const {
  createAuthor,
  getAuthors,
  getAuthorById,
  updateAuthor,
  deleteAuthor,
} = require("../controllers/authorController");

const router = express.Router();

router.post("/", createAuthor);
router.get("/", getAuthors);
router.get("/:id", getAuthorById);
router.put("/:id", updateAuthor);
router.delete("/:id", deleteAuthor);

module.exports = router;