import mongoose from "mongoose";

const videoSchema = new mongoose.Schema({
  id: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String },
  videoUrl: { type: String, default: "" },
  thumbnailUrl: { type: String, default: "" },
  duration: { type: Number, default: 0 },
  relatedProducts: [{ type: String }],
  publishedAt: { type: Date, default: Date.now }
});

const courseSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    level: { type: String, enum: ["BEGINNER", "INTERMEDIATE", "ADVANCED"], default: "BEGINNER" },
    category: { type: String, required: true },
    thumbnailUrl: { type: String, default: "" },
    instructor: { type: String, required: true },
    tags: [{ type: String }],
    isPublished: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },
    videos: [videoSchema],
    pdfUrl: { type: String, default: "" },
    pdfName: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

export default mongoose.models.Course || mongoose.model("Course", courseSchema);
