import mongoose from 'mongoose';

const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: String, required: true },
  img: String,
  link: String,
  category: String,
  search_term: String,
  page_number: Number,
  extracted_at: Date
}, { timestamps: true });

ProductSchema.index({ name: 1, link: 1 }, { unique: true, sparse: true });

export default mongoose.model('Product', ProductSchema);
