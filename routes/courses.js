import express from "express";
import { promises as fs } from "fs";
import path from "path";
import mongoose from "mongoose";
import Course from "../models/Course.js";
import { fileURLToPath } from "url";
import { authenticateToken, authorizeRole } from "../middleware/auth.js";
import { validate, schemas } from "../middleware/validation.js";
import { getCacheManager } from "../database/CacheManager.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const coursesFilePath = path.join(__dirname, "../data/courses.json");

const router = express.Router();

function dbReady() {
  return mongoose.connection.readyState === 1;
}

async function readFallback() {
  try {
    const data = await fs.readFile(coursesFilePath, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeFallback(courses) {
  try {
    await fs.writeFile(coursesFilePath, JSON.stringify(courses, null, 2), "utf-8");
  } catch (error) {
    console.error("Error writing courses.json:", error);
  }
}

// GET all courses (Public - only published)
router.get("/", async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(String(page)) - 1) * parseInt(String(limit));

    // Generate cache key for course list with pagination
    const cacheKey = `courses:list:page${page}:limit${limit}`;
    const cacheManager = getCacheManager();

    // Try to get from cache first (cache-aside pattern)
    const cachedData = await cacheManager.get(cacheKey);
    if (cachedData) {
      res.json(cachedData);
      return;
    }

    // Cache miss - fetch from database
    if (dbReady()) {
      const filter = { isPublished: true };
      const total = await Course.countDocuments(filter);
      const courses = await Course.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(String(limit)));
      
      const response = {
        data: courses,
        pagination: {
          total,
          page: parseInt(String(page)),
          limit: parseInt(String(limit)),
          pages: Math.ceil(total / parseInt(String(limit)))
        }
      };

      // Populate cache with TTL of 300 seconds
      await cacheManager.set(cacheKey, response, cacheManager.getTTL('courseList'));
      
      res.json(response);
      return;
    }

    // Fallback to JSON file
    const courses = await readFallback();
    const published = courses.filter(c => c.isPublished !== false);
    const paginated = published.slice(skip, skip + parseInt(String(limit)));
    
    const response = {
      data: paginated,
      pagination: {
        total: published.length,
        page: parseInt(String(page)),
        limit: parseInt(String(limit)),
        pages: Math.ceil(published.length / parseInt(String(limit)))
      }
    };

    // Populate cache even for fallback data
    await cacheManager.set(cacheKey, response, cacheManager.getTTL('courseList'));
    
    res.json(response);
  } catch (error) {
    next(error);
  }
});

// GET single course by ID (Public)
router.get("/:id", async (req, res, next) => {
  try {
    // Generate cache key for course detail
    const cacheKey = `courses:detail:${req.params.id}`;
    const cacheManager = getCacheManager();

    // Try to get from cache first (cache-aside pattern)
    const cachedData = await cacheManager.get(cacheKey);
    if (cachedData) {
      res.json(cachedData);
      return;
    }

    // Cache miss - fetch from database
    if (dbReady()) {
      const course = await Course.findOne({ id: req.params.id });
      if (!course) return res.status(404).json({ error: "Course not found", code: "NOT_FOUND" });
      
      // Populate cache with TTL of 300 seconds (same as list)
      await cacheManager.set(cacheKey, course, cacheManager.getTTL('courseList'));
      
      res.json(course);
      return;
    }

    // Fallback to JSON file
    const courses = await readFallback();
    const course = courses.find(c => c.id === req.params.id);
    if (!course) return res.status(404).json({ error: "Course not found", code: "NOT_FOUND" });
    
    // Populate cache even for fallback data
    await cacheManager.set(cacheKey, course, cacheManager.getTTL('courseList'));
    
    res.json(course);
  } catch (error) {
    next(error);
  }
});

// POST create course (Admin only)
router.post("/", authenticateToken, authorizeRole(["admin"]), validate(schemas.course), async (req, res, next) => {
  try {
    const course = {
      id: req.validatedData.id || `course-${Date.now()}`,
      title: req.validatedData.title,
      description: req.validatedData.description || "",
      level: req.validatedData.level || "BEGINNER",
      category: req.validatedData.category || "",
      thumbnailUrl: req.validatedData.thumbnailUrl || "",
      instructor: req.validatedData.instructor || "",
      tags: req.validatedData.tags || [],
      isPublished: req.validatedData.isPublished || false,
      isFeatured: req.validatedData.isFeatured || false,
      videos: req.validatedData.videos || []
    };

    if (dbReady()) {
      const created = await Course.create(course);
      
      // Invalidate course list cache (all variations)
      const cacheManager = getCacheManager();
      await cacheManager.deletePattern('courses:list:*');
      
      res.status(201).json(created);
      return;
    }

    const courses = await readFallback();
    courses.unshift(course);
    await writeFallback(courses);
    
    // Invalidate course list cache (all variations)
    const cacheManager = getCacheManager();
    await cacheManager.deletePattern('courses:list:*');
    
    res.status(201).json(course);
  } catch (error) {
    next(error);
  }
});

// PUT update course (Admin only)
router.put("/:id", authenticateToken, authorizeRole(["admin"]), validate(schemas.course), async (req, res, next) => {
  try {
    if (dbReady()) {
      const updated = await Course.findOneAndUpdate({ id: req.params.id }, req.validatedData, { new: true });
      if (!updated) return res.status(404).json({ error: "Course not found", code: "NOT_FOUND" });
      
      // Invalidate cache for this course and course list (all variations)
      const cacheManager = getCacheManager();
      await cacheManager.delete(`courses:detail:${req.params.id}`);
      await cacheManager.deletePattern('courses:list:*');
      
      res.json(updated);
      return;
    }
    const courses = await readFallback();
    const index = courses.findIndex(c => c.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: "Course not found", code: "NOT_FOUND" });
    courses[index] = { ...courses[index], ...req.validatedData };
    await writeFallback(courses);
    
    // Invalidate cache for this course and course list (all variations)
    const cacheManager = getCacheManager();
    await cacheManager.delete(`courses:detail:${req.params.id}`);
    await cacheManager.deletePattern('courses:list:*');
    
    res.json(courses[index]);
  } catch (error) {
    next(error);
  }
});

// POST add video to course (Admin only)
router.post("/:id/videos", authenticateToken, authorizeRole(["admin"]), async (req, res, next) => {
  try {
    if (dbReady()) {
      const course = await Course.findOne({ id: req.params.id });
      if (!course) return res.status(404).json({ error: "Course not found", code: "NOT_FOUND" });

      const video = {
        id: req.body.id || `video-${Date.now()}`,
        title: req.body.title,
        description: req.body.description || "",
        videoUrl: req.body.videoUrl || "",
        thumbnailUrl: req.body.thumbnailUrl || "",
        duration: req.body.duration || 0,
        relatedProducts: req.body.relatedProducts || [],
        publishedAt: new Date()
      };

      course.videos.push(video);
      await course.save();
      
      // Invalidate cache for this course and course list (all variations)
      const cacheManager = getCacheManager();
      await cacheManager.delete(`courses:detail:${req.params.id}`);
      await cacheManager.deletePattern('courses:list:*');
      
      res.status(201).json(video);
      return;
    }

    const courses = await readFallback();
    const index = courses.findIndex(c => c.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: "Course not found", code: "NOT_FOUND" });

    const video = {
      id: req.body.id || `video-${Date.now()}`,
      title: req.body.title,
      description: req.body.description || "",
      videoUrl: req.body.videoUrl || "",
      thumbnailUrl: req.body.thumbnailUrl || "",
      duration: req.body.duration || 0,
      relatedProducts: req.body.relatedProducts || [],
      publishedAt: new Date()
    };

    courses[index].videos = courses[index].videos || [];
    courses[index].videos.push(video);
    await writeFallback(courses);
    
    // Invalidate cache for this course and course list (all variations)
    const cacheManager = getCacheManager();
    await cacheManager.delete(`courses:detail:${req.params.id}`);
    await cacheManager.deletePattern('courses:list:*');
    
    res.status(201).json(video);
  } catch (error) {
    next(error);
  }
});

// DELETE course (Admin only)
router.delete("/:id", authenticateToken, authorizeRole(["admin"]), async (req, res, next) => {
  try {
    if (dbReady()) {
      const deleted = await Course.findOneAndDelete({ id: req.params.id });
      if (!deleted) return res.status(404).json({ error: "Course not found", code: "NOT_FOUND" });
      
      // Invalidate cache for this course and course list (all variations)
      const cacheManager = getCacheManager();
      await cacheManager.delete(`courses:detail:${req.params.id}`);
      await cacheManager.deletePattern('courses:list:*');
      
      res.json({ message: "Course deleted", course: deleted });
      return;
    }
    const courses = await readFallback();
    const index = courses.findIndex(c => c.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: "Course not found", code: "NOT_FOUND" });
    const deleted = courses.splice(index, 1)[0];
    await writeFallback(courses);
    
    // Invalidate cache for this course and course list (all variations)
    const cacheManager = getCacheManager();
    await cacheManager.delete(`courses:detail:${req.params.id}`);
    await cacheManager.deletePattern('courses:list:*');
    
    res.json({ message: "Course deleted", course: deleted });
  } catch (error) {
    next(error);
  }
});

router.use((error, _req, res, _next) => {
  res.status(400).json({ error: error.message || "Course request failed", code: "COURSE_ERROR" });
});

export default router;
