import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
  name: String,
  price: String,
  img: String,
  category: String  // "portatiles" o "smartphones"
});

export default mongoose.model("Product", productSchema);
