import express from "express";
import { promises as fs } from "fs";
import path from "path";
import mongoose from "mongoose";
import Kit from "../models/Kit.js";
import { fileURLToPath } from "url";
import { authenticateToken, authorizeRole } from "../middleware/auth.js";
import { validate, schemas } from "../middleware/validation.js";
import { getCacheManager } from "../database/CacheManager.js";

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

    // Generate cache key for kit list with pagination
    const cacheKey = `kits:list:page${page}:limit${limit}`;
    const cacheManager = getCacheManager();

    // Try to get from cache first (cache-aside pattern)
    const cachedData = await cacheManager.get(cacheKey);
    if (cachedData) {
      res.json(cachedData);
      return;
    }

    // Cache miss - fetch from database
    if (dbReady()) {
      const total = await Kit.countDocuments();
      const kits = await Kit.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));
      
      const response = {
        data: kits,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      };

      // Populate cache with TTL of 300 seconds
      await cacheManager.set(cacheKey, response, cacheManager.getTTL('kitList'));
      
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

    // Populate cache even for fallback data
    await cacheManager.set(cacheKey, response, cacheManager.getTTL('kitList'));
    
    res.json(response);
  } catch (error) {
    next(error);
  }
});

// GET single kit by ID (Public)
router.get("/:id", async (req, res, next) => {
  try {
    // Generate cache key for kit detail
    const cacheKey = `kits:detail:${req.params.id}`;
    const cacheManager = getCacheManager();

    // Try to get from cache first (cache-aside pattern)
    const cachedData = await cacheManager.get(cacheKey);
    if (cachedData) {
      res.json(cachedData);
      return;
    }

    // Cache miss - fetch from database
    if (dbReady()) {
      const kit = await Kit.findOne({ id: req.params.id });
      if (!kit) return res.status(404).json({ error: "Kit not found", code: "NOT_FOUND" });
      
      // Populate cache with TTL of 300 seconds (same as list)
      await cacheManager.set(cacheKey, kit, cacheManager.getTTL('kitList'));
      
      res.json(kit);
      return;
    }

    // Fallback to JSON file
    const kits = await readFallback();
    const kit = kits.find(k => k.id === req.params.id);
    if (!kit) return res.status(404).json({ error: "Kit not found", code: "NOT_FOUND" });
    
    // Populate cache even for fallback data
    await cacheManager.set(cacheKey, kit, cacheManager.getTTL('kitList'));
    
    res.json(kit);
  } catch (error) {
    next(error);
  }
});

// POST create kit (Admin only)
router.post("/", authenticateToken, authorizeRole(["admin"]), validate(schemas.kit), async (req, res, next) => {
  try {
    const kit = {
      id: req.validatedData.id || `kit-${Date.now()}`,
      name: req.validatedData.name,
      tier: req.validatedData.tier,
      price: req.validatedData.price || 0,
      description: req.validatedData.description || "",
      includes: req.validatedData.includes || [],
      rating: req.validatedData.rating || 4.5,
      imageUrl: req.validatedData.imageUrl || ""
    };

    if (dbReady()) {
      const created = await Kit.create(kit);
      
      // Invalidate kit list cache (all variations)
      const cacheManager = getCacheManager();
      await cacheManager.deletePattern('kits:list:*');
      
      res.status(201).json(created);
      return;
    }

    const kits = await readFallback();
    kits.unshift(kit);
    await writeFallback(kits);
    
    // Invalidate kit list cache (all variations)
    const cacheManager = getCacheManager();
    await cacheManager.deletePattern('kits:list:*');
    
    res.status(201).json(kit);
  } catch (error) {
    next(error);
  }
});

// PUT update kit (Admin only)
router.put("/:id", authenticateToken, authorizeRole(["admin"]), validate(schemas.kit), async (req, res, next) => {
  try {
    if (dbReady()) {
      const updated = await Kit.findOneAndUpdate({ id: req.params.id }, req.validatedData, { new: true });
      if (!updated) return res.status(404).json({ error: "Kit not found", code: "NOT_FOUND" });
      
      // Invalidate cache for this kit and kit list (all variations)
      const cacheManager = getCacheManager();
      await cacheManager.delete(`kits:detail:${req.params.id}`);
      await cacheManager.deletePattern('kits:list:*');
      
      res.json(updated);
      return;
    }
    const kits = await readFallback();
    const index = kits.findIndex(k => k.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: "Kit not found", code: "NOT_FOUND" });
    kits[index] = { ...kits[index], ...req.validatedData };
    await writeFallback(kits);
    
    // Invalidate cache for this kit and kit list (all variations)
    const cacheManager = getCacheManager();
    await cacheManager.delete(`kits:detail:${req.params.id}`);
    await cacheManager.deletePattern('kits:list:*');
    
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
      
      // Invalidate cache for this kit and kit list (all variations)
      const cacheManager = getCacheManager();
      await cacheManager.delete(`kits:detail:${req.params.id}`);
      await cacheManager.deletePattern('kits:list:*');
      
      res.json({ message: "Kit deleted", kit: deleted });
      return;
    }
    const kits = await readFallback();
    const index = kits.findIndex(k => k.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: "Kit not found", code: "NOT_FOUND" });
    const deleted = kits.splice(index, 1)[0];
    await writeFallback(kits);
    
    // Invalidate cache for this kit and kit list (all variations)
    const cacheManager = getCacheManager();
    await cacheManager.delete(`kits:detail:${req.params.id}`);
    await cacheManager.deletePattern('kits:list:*');
    
    res.json({ message: "Kit deleted", kit: deleted });
  } catch (error) {
    next(error);
  }
});

router.use((error, _req, res, _next) => {
  res.status(400).json({ error: error.message || "Kit request failed", code: "KIT_ERROR" });
});

export default router;
