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
    videoUrl: { type: String, default: "" },
    videoDuration: { type: Number, default: 0 }
  },
  { timestamps: true }
);

export default mongoose.models.Kit || mongoose.model("Kit", kitSchema);
