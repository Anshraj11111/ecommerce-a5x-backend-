import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    kitId: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true, trim: true },
    approved: { type: Boolean, default: false },
    approvedBy: { type: String, default: null }, // Admin who approved
    approvedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

// Index for efficient queries
reviewSchema.index({ kitId: 1, approved: 1 });
reviewSchema.index({ approved: 1, createdAt: -1 });

export default mongoose.models.Review || mongoose.model("Review", reviewSchema);