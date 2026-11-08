const mongoose = require("mongoose");

const bookSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, "title is required"], trim: true },
    genre: { type: String, required: [true, "genre is required"], trim: true },
    price: { type: Number, required: [true, "price is required"] },
    publishedYear: { type: Number, required: [true, "publishedYear is required"] },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Author",
      required: [true, "author is required"],
    },
  },
  { timestamps: true }
);

// Rule 2 backstop: one title per author, case-insensitive.
// strength: 2 makes "The Silent Sea" and "the silent sea" count as equal.
// The controller still checks first to give a friendly message; this index
// stops two simultaneous requests from both slipping through.
bookSchema.index(
  { author: 1, title: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } }
);

const Book = mongoose.model("Book", bookSchema);

// Index builds happen in the background after connecting. If existing data
// already contains duplicates, the build fails, so an appropriate message is logged.
Book.on("index", (err) => {
  if (err) console.error("Book index build failed:", err.message);
});

module.exports = Book;