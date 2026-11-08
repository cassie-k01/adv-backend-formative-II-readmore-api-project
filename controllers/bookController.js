const mongoose = require("mongoose");
const Book = require("../models/Book");
const Author = require("../models/Author");

// Accepts real numbers and numeric strings like "21.5". Everything else
// (letters, empty string, null, booleans, arrays) becomes NaN and is rejected.
const toNumber = (value) => {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") return Number(value);
  return NaN;
};

// Rule 3: rules the schema can't express. Returns an error message or null.
// A field that is undefined is skipped, so on update only the fields present
// in the body are checked. On create, a missing field is caught by the
// schema's "required" check instead (400).
const validatePriceAndYear = (price, year) => {
  if (price !== undefined) {
    const p = toNumber(price);
    if (!Number.isFinite(p) || p <= 0) {
      return "price must be a number greater than 0";
    }
  }
  if (year !== undefined) {
    const y = toNumber(year);
    const currentYear = new Date().getFullYear();
    if (!Number.isInteger(y) || y < 1450 || y > currentYear) {
      return `publishedYear must be a whole year between 1450 and ${currentYear}`;
    }
  }
  return null;
};

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
    // Check order: 1) price and year (422), 2) author exists (400)
    const ruleError = validatePriceAndYear(req.body.price, req.body.publishedYear);
    if (ruleError) {
      return res.status(422).json({ message: ruleError });
    }

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

    // Rule 3 on update: only the fields present in the body are checked
    const ruleError = validatePriceAndYear(req.body.price, req.body.publishedYear);
    if (ruleError) {
      return res.status(422).json({ message: ruleError });
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