const mongoose = require("mongoose");
const Author = require("../models/Author");
const Book = require("../models/Book");

// POST /authors
const createAuthor = async (req, res) => {
  try {
    const author = await Author.create(req.body);
    res.status(201).json(author);
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// GET /authors
const getAuthors = async (req, res) => {
  try {
    const authors = await Author.find();
    res.json(authors);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// GET /authors/:id
const getAuthorById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid author id" });
    }
    const author = await Author.findById(id);
    if (!author) {
      return res.status(404).json({ message: "Author not found" });
    }
    res.json(author);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// PUT /authors/:id
const updateAuthor = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid author id" });
    }
    // returnDocument: "after" returns the updated document instead of the old one.
    // runValidators: true makes the schema's required checks apply to updates.
    const author = await Author.findByIdAndUpdate(id, req.body, {
      returnDocument: "after",
      runValidators: true,
    });
    if (!author) {
      return res.status(404).json({ message: "Author not found" });
    }
    res.json(author);
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// DELETE /authors/:id
// Rule 4, Option A (block): an author who still has books cannot be deleted.
// The person must delete or move the books first, so no book is ever left
// pointing at an author who no longer exists.
const deleteAuthor = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid author id" });
    }

    const author = await Author.findById(id);
    if (!author) {
      return res.status(404).json({ message: "Author not found" });
    }

    const bookCount = await Book.countDocuments({ author: id });
    if (bookCount > 0) {
      return res.status(409).json({
        message: `Cannot delete this author: they still have ${bookCount} book(s). Delete or move those books first.`,
        bookCount,
      });
    }

    await author.deleteOne();
    res.json({ message: "Author deleted" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

module.exports = {
  createAuthor,
  getAuthors,
  getAuthorById,
  updateAuthor,
  deleteAuthor,
};