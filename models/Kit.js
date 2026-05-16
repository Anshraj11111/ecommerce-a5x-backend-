import mongoose from "mongoose";

const kitSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    tier: { type: String, required: true },
    price: { type: Number, required: true },
    description: { type: String, required: true },
    includes: [{ type: String }],
    rating: { type: Number, default: 4.5 },
    imageUrl: { type: String, default: "" },
    images: [{ type: String }], // Multiple images support
    videoUrl: { type: String, default: "" },
    videoDuration: { type: Number, default: 0 },
    
    // Additional fields for tabs
    overview: { type: String, default: "" },
    features: [{ type: String }],
    dimensions: { type: String, default: "" },
    weight: { type: String, default: "" },
    power: { type: String, default: "" },
    temperature: { type: String, default: "" },
    compatibility: [{ type: String }],
    software: [{ type: String }],
    
    // Publishing status
    isPublished: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export default mongoose.models.Kit || mongoose.model("Kit", kitSchema);
