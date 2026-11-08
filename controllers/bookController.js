const mongoose = require("mongoose");
const Book = require("../models/Book");
const Author = require("../models/Author");

// Rule 1: no orphan books.
// The schema's "required" only proves the field exists. A made-up id still has
// the right format, so we look the author up. Returns an error message or null.
const getAuthorError = async (authorId) => {
  if (!authorId || typeof authorId !== "string" || !mongoose.isValidObjectId(authorId)) {
    return "A valid author id is required";
  }
  const author = await Author.findById(authorId);
  if (!author) {
    return "Author does not exist";
  }
  return null;
};

// POST /books
const createBook = async (req, res) => {
  try {
    // Rule 1 runs before Book.create, so nothing is saved when it fails
    const authorError = await getAuthorError(req.body.author);
    if (authorError) {
      return res.status(400).json({ message: authorError });
    }

    const book = await Book.create(req.body);
    await book.populate("author");
    res.status(201).json(book);
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// GET /books
const getBooks = async (req, res) => {
  try {
    const books = await Book.find().populate("author");
    res.json(books);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// GET /books/:id
const getBookById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid book id" });
    }
    const book = await Book.findById(id).populate("author");
    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }
    res.json(book);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// PUT /books/:id
const updateBook = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid book id" });
    }

    // Rule 1 on update: only when the author is actually being changed
    if (req.body.author !== undefined) {
      const authorError = await getAuthorError(req.body.author);
      if (authorError) {
        return res.status(400).json({ message: authorError });
      }
    }

    const book = await Book.findByIdAndUpdate(id, req.body, {
      returnDocument: "after",
      runValidators: true,
    }).populate("author");
    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }
    res.json(book);
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// DELETE /books/:id
const deleteBook = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid book id" });
    }
    const book = await Book.findByIdAndDelete(id);
    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }
    res.json({ message: "Book deleted" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// GET /authors/:id/books
const getBooksByAuthor = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid author id" });
    }
    const author = await Author.findById(id);
    if (!author) {
      return res.status(404).json({ message: "Author not found" });
    }
    // An empty array is correct here: the author exists but has no books.
    const books = await Book.find({ author: id });
    res.json(books);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

module.exports = {
  createBook,
  getBooks,
  getBookById,
  updateBook,
  deleteBook,
  getBooksByAuthor,
};