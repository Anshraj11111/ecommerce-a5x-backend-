import mongoose from "mongoose";

const bulkPricingSchema = new mongoose.Schema(
  {
    min: Number,
    max: Number,
    price: Number
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true },
    mrp: { type: Number, required: true },
    minQty: { type: Number, default: 1 },
    category: { type: String, required: true },
    sku: { type: String, required: true, unique: true },
    rating: { type: Number, default: 4.5 },
    reviewCount: { type: Number, default: 0 },
    inStock: { type: Boolean, default: true },
    stockCount: { type: Number, default: 0 },
    shortDescription: { type: String, default: "" },
    features: [{ type: String }],
    specs: { type: mongoose.Schema.Types.Mixed, default: {} },
    compatibility: [{ type: String }],
    bulkPricing: [bulkPricingSchema],
    badges: [{ type: String }],
    frequentlyBoughtWith: [{ type: String }],
    relatedIds: [{ type: String }],
    imageUrl: { type: String, default: "" },
    images: [{ type: String }]
  },
  { timestamps: true }
);

export default mongoose.models.Product || mongoose.model("Product", productSchema);
