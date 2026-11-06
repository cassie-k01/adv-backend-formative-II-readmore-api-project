const mongoose = require("mongoose");

const authorSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, "name is required"], trim: true },
    country: { type: String, required: [true, "country is required"], trim: true },
    bio: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Author", authorSchema);