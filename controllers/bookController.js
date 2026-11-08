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

// Escape regex special characters so a title like "C++" or "Home (Part 2)"
// is matched literally instead of breaking the query.
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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

// Rule 2: no duplicate titles per author (case-insensitive).
// The check is scoped to one author, so two different authors can both have a
// book called "Home". excludeId keeps a book from conflicting with itself on
// update. Returns the clashing book, or null.
const findDuplicateTitle = async (authorId, title, excludeId) => {
  if (typeof title !== "string" || title.trim() === "") {
    return null; // a missing or blank title is the schema's job (400)
  }
  const filter = {
    author: authorId,
    title: new RegExp("^" + escapeRegex(title.trim()) + "$", "i"),
  };
  if (excludeId) {
    filter._id = { $ne: excludeId };
  }
  return Book.findOne(filter);
};

// POST /books
const createBook = async (req, res) => {
  try {
    // Check order: 1) price and year (422), 2) author exists (400),
    // 3) duplicate title (409), then save.
    const ruleError = validatePriceAndYear(req.body.price, req.body.publishedYear);
    if (ruleError) {
      return res.status(422).json({ message: ruleError });
    }

    const authorError = await getAuthorError(req.body.author);
    if (authorError) {
      return res.status(400).json({ message: authorError });
    }

    const duplicate = await findDuplicateTitle(req.body.author, req.body.title);
    if (duplicate) {
      return res.status(409).json({
        message: `This author already has a book titled "${duplicate.title}"`,
      });
    }

    const book = await Book.create(req.body);
    await book.populate("author");
    res.status(201).json(book);
  } catch (err) {
    // Duplicate key from the unique index: another request got in first
    if (err.code === 11000) {
      return res.status(409).json({ message: "This author already has a book with that title" });
    }
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// GET /books
// Rule 5 + pagination: optional filters, search, sorting and paging. The filter object is built
// dynamically, so only the parameters that are actually present are applied.
// With no parameters the filter stays {} and every book is returned.
const getBooks = async (req, res) => {
  try {
    const { genre, minPrice, maxPrice, author, search, sort, order, page, limit } = req.query;

    // A parameter counts as present only if it is not missing or empty
    const has = (value) => value !== undefined && value !== "";

    // Text parameters must be plain strings (blocks ?genre[]=a and ?genre[$ne]=a)
    const textParams = { genre, author, search, sort, order };
    for (const [name, value] of Object.entries(textParams)) {
      if (has(value) && typeof value !== "string") {
        return res.status(400).json({ message: `${name} must be a single text value` });
      }
    }

    const filter = {};

    // genre: only books of that genre (case-insensitive exact match)
    if (has(genre)) {
      filter.genre = new RegExp("^" + escapeRegex(genre.trim()) + "$", "i");
    }

    // author: only books by that author id
    if (has(author)) {
      if (!mongoose.isValidObjectId(author)) {
        return res.status(400).json({ message: "author must be a valid author id" });
      }
      filter.author = author;
    }

    // search: title contains this text (case-insensitive)
    if (has(search)) {
      filter.title = new RegExp(escapeRegex(search.trim()), "i");
    }

    // minPrice / maxPrice: either, both, or neither. Both share one "price"
    // object: { $gte: min }, { $lte: max } or { $gte: min, $lte: max }.
    if (has(minPrice) || has(maxPrice)) {
      filter.price = {};
      if (has(minPrice)) {
        const min = toNumber(minPrice);
        if (!Number.isFinite(min)) {
          return res.status(400).json({ message: "minPrice must be a number" });
        }
        filter.price.$gte = min;
      }
      if (has(maxPrice)) {
        const max = toNumber(maxPrice);
        if (!Number.isFinite(max)) {
          return res.status(400).json({ message: "maxPrice must be a number" });
        }
        filter.price.$lte = max;
      }
    }

    // sort + order: only these fields are allowed, ascending by default.
    // _id is always the final tie-breaker so pages stay stable: without it,
    // books with equal prices could swap places between page 1 and page 2.
    let sortSpec = { _id: 1 };
    if (has(order) && !["asc", "desc"].includes(order)) {
      return res.status(400).json({ message: "order must be asc or desc" });
    }
    if (has(sort)) {
      const allowed = ["price", "title", "publishedYear"];
      if (!allowed.includes(sort)) {
        return res.status(400).json({ message: `sort must be one of: ${allowed.join(", ")}` });
      }
      sortSpec = { [sort]: order === "desc" ? -1 : 1, _id: 1 };
    }

    // Pagination: bad or missing values fall back to the defaults, and the
    // numbers are clamped (page at least 1, limit between 1 and 100)
    let pageNum = parseInt(page, 10);
    if (Number.isNaN(pageNum) || pageNum < 1) pageNum = 1;
    let limitNum = parseInt(limit, 10);
    if (Number.isNaN(limitNum)) limitNum = 10;
    limitNum = Math.min(Math.max(limitNum, 1), 100);

    // total uses the same filter, so it counts every match, not just this page.
    // strength 2 makes title sorting ignore case ("apple" next to "Apple")
    const [total, results] = await Promise.all([
      Book.countDocuments(filter),
      Book.find(filter)
        .populate("author")
        .sort(sortSpec)
        .collation({ locale: "en", strength: 2 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
    ]);

    res.json({ page: pageNum, limit: limitNum, total, results });
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

    // We need the stored book to work out the "effective" title and author
    const existing = await Book.findById(id);
    if (!existing) {
      return res.status(404).json({ message: "Book not found" });
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

    // Rule 2 on update: only needed if the title or the author is changing.
    // Effective values are the new ones from the body, else the stored ones.
    if (req.body.title !== undefined || req.body.author !== undefined) {
      const effectiveTitle = req.body.title !== undefined ? req.body.title : existing.title;
      const effectiveAuthor =
        req.body.author !== undefined ? req.body.author : String(existing.author);
      const duplicate = await findDuplicateTitle(effectiveAuthor, effectiveTitle, id);
      if (duplicate) {
        return res.status(409).json({
          message: `This author already has a book titled "${duplicate.title}"`,
        });
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
    // Duplicate key from the unique index: another request got in first
    if (err.code === 11000) {
      return res.status(409).json({ message: "This author already has a book with that title" });
    }
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