import express from "express";
import { promises as fs } from "fs";
import path from "path";
import mongoose from "mongoose";
import Kit from "../models/Kit.js";
import { fileURLToPath } from "url";
import { authenticateToken, authorizeRole } from "../middleware/auth.js";
import { validate, schemas } from "../middleware/validation.js";
import { uploadImage, uploadImages } from "../services/cloudinaryService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const kitsFilePath = path.join(__dirname, "../data/kits.json");

const router = express.Router();

function dbReady() {
  return mongoose.connection.readyState === 1;
}

async function readFallback() {
  try {
    const data = await fs.readFile(kitsFilePath, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeFallback(kits) {
  try {
    await fs.writeFile(kitsFilePath, JSON.stringify(kits, null, 2), "utf-8");
  } catch (error) {
    console.error("Error writing kits.json:", error);
  }
}

// GET all kits (Public)
router.get("/", async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetch from database
    if (dbReady()) {
      const total = await Kit.countDocuments();
      const kits = await Kit.find()
        .sort({ _id: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean();
      
      const response = {
        data: kits,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      };
      
      res.json(response);
      return;
    }

    // Fallback to JSON file
    const kits = await readFallback();
    const paginated = kits.slice(skip, skip + parseInt(limit));
    
    const response = {
      data: paginated,
      pagination: {
        total: kits.length,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(kits.length / parseInt(limit))
      }
    };
    
    res.json(response);
  } catch (error) {
    next(error);
  }
});

// GET single kit by ID (Public)
router.get("/:id", async (req, res, next) => {
  try {
    // Fetch from database
    if (dbReady()) {
      const kit = await Kit.findOne({ id: req.params.id });
      if (!kit) return res.status(404).json({ error: "Kit not found", code: "NOT_FOUND" });
      
      res.json(kit);
      return;
    }

    // Fallback to JSON file
    const kits = await readFallback();
    const kit = kits.find(k => k.id === req.params.id);
    if (!kit) return res.status(404).json({ error: "Kit not found", code: "NOT_FOUND" });
    
    res.json(kit);
  } catch (error) {
    next(error);
  }
});

// POST create kit (Admin only)
router.post("/", authenticateToken, authorizeRole(["admin"]), validate(schemas.kit), async (req, res, next) => {
  try {
    const kitId = req.validatedData.id || `kit-${Date.now()}`;

    // Upload images to Cloudinary if base64
    const imageUrl = await uploadImage(req.validatedData.imageUrl || "", `kit-${kitId}`, 'kits');
    const images = await uploadImages(req.validatedData.images || [], `kit-${kitId}`, 'kits');

    const kit = {
      id: kitId,
      name: req.validatedData.name,
      tier: req.validatedData.tier,
      price: req.validatedData.price || 0,
      description: req.validatedData.description || "",
      includes: req.validatedData.includes || [],
      rating: req.validatedData.rating || 4.5,
      imageUrl,
      images,
      videoUrl: req.validatedData.videoUrl || "",
      videoDuration: req.validatedData.videoDuration || 0,
      overview: req.validatedData.overview || "",
      features: req.validatedData.features || [],
      dimensions: req.validatedData.dimensions || "",
      weight: req.validatedData.weight || "",
      power: req.validatedData.power || "",
      temperature: req.validatedData.temperature || "",
      compatibility: req.validatedData.compatibility || [],
      software: req.validatedData.software || [],
      isPublished: req.validatedData.isPublished !== undefined ? req.validatedData.isPublished : true
    };

    if (dbReady()) {
      const created = await Kit.create(kit);
      res.status(201).json(created);
      return;
    }

    const kits = await readFallback();
    kits.unshift(kit);
    await writeFallback(kits);
    res.status(201).json(kit);
  } catch (error) {
    next(error);
  }
});

// PUT update kit (Admin only)
router.put("/:id", authenticateToken, authorizeRole(["admin"]), validate(schemas.kit), async (req, res, next) => {
  try {
    // Upload images to Cloudinary if base64
    const imageUrl = await uploadImage(req.validatedData.imageUrl || "", `kit-${req.params.id}`, 'kits');
    const images = await uploadImages(req.validatedData.images || [], `kit-${req.params.id}`, 'kits');
    const updateData = { ...req.validatedData, imageUrl, images };

    if (dbReady()) {
      const updated = await Kit.findOneAndUpdate(
        { id: req.params.id }, 
        { $set: updateData }, 
        { new: true, runValidators: true }
      );
      if (!updated) return res.status(404).json({ error: "Kit not found", code: "NOT_FOUND" });
      res.json(updated);
      return;
    }
    const kits = await readFallback();
    const index = kits.findIndex(k => k.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: "Kit not found", code: "NOT_FOUND" });
    kits[index] = { ...kits[index], ...updateData };
    await writeFallback(kits);
    res.json(kits[index]);
  } catch (error) {
    next(error);
  }
});

// DELETE kit (Admin only)
router.delete("/:id", authenticateToken, authorizeRole(["admin"]), async (req, res, next) => {
  try {
    if (dbReady()) {
      const deleted = await Kit.findOneAndDelete({ id: req.params.id });
      if (!deleted) return res.status(404).json({ error: "Kit not found", code: "NOT_FOUND" });
      
      res.json({ message: "Kit deleted", kit: deleted });
      return;
    }
    const kits = await readFallback();
    const index = kits.findIndex(k => k.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: "Kit not found", code: "NOT_FOUND" });
    const deleted = kits.splice(index, 1)[0];
    await writeFallback(kits);
    
    res.json({ message: "Kit deleted", kit: deleted });
  } catch (error) {
    next(error);
  }
});

router.use((error, _req, res, _next) => {
  res.status(400).json({ error: error.message || "Kit request failed", code: "KIT_ERROR" });
});

export default router;
