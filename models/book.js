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

module.exports = mongoose.model("Book", bookSchema);