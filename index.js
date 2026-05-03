import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import productRoutes from "./routes/products.js";
import kitRoutes from "./routes/kits.js";
import courseRoutes from "./routes/courses.js";
import authRoutes from "./routes/auth.js";
import orderRoutes from "./routes/orders.js";
import contactRoutes from "./routes/contacts.js";
import logger from "./utils/logger.js";
import { seedDatabase } from "./utils/seeder.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CORS Configuration - Allow all origins in development
app.use(cors({
  origin: true, // Allow all origins in development
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// Security Middleware (after CORS)
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Body parser middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Logging
app.use(morgan("combined"));

// Trust proxy when behind a load balancer
app.set("trust proxy", 1);

// Rate Limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || 900000), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || 100), // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === "/api/health" // Don't count health checks
});

app.use("/api/", limiter);

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const userInfo = req.user ? ` [User: ${req.user.username}]` : "";
  logger.info(`${req.method} ${req.path}${userInfo}`);
  next();
});

// Auth Routes (No authentication required)
app.use("/api/auth", authRoutes);

// Health check (No authentication required)
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    database: mongoose.connection.readyState === 1 ? "mongodb" : "json-fallback",
    timestamp: new Date().toISOString()
  });
});

// Public API routes
app.use("/api/products", productRoutes);
app.use("/api/kits", kitRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/contacts", contactRoutes);

// Static files
const distPath = path.join(__dirname, "..", "client", "dist");
app.use(express.static(distPath));

// Fallback to index.html
app.get("*", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

// Global error handler
app.use((err, _req, res, _next) => {
  logger.error(err.message, { stack: err.stack });
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal server error";
  res.status(status).json({ 
    error: message,
    status,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === "development" && { stack: err.stack })
  });
});

async function start() {
  const uri = process.env.MONGODB_URI;
  if (uri) {
    try {
      await mongoose.connect(uri);
      console.log("MongoDB connected");
      
      // Seed database with sample data if empty
      await seedDatabase();
    } catch (error) {
      console.warn("MongoDB unavailable, using JSON fallback:", error.message);
    }
  } else {
    console.warn("MONGODB_URI not set, using JSON fallback storage");
  }

  app.listen(port, () => {
    console.log(`A5X server running on http://localhost:${port}`);
  });
}

start();
