import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import passport from "passport";
import productRoutes from "./routes/products.js";
import kitRoutes from "./routes/kits.js";
import courseRoutes from "./routes/courses.js";
import authRoutes from "./routes/auth.js";
import orderRoutes from "./routes/orders.js";
import contactRoutes from "./routes/contacts.js";
import reviewRoutes from "./routes/reviews.js";
import aiRoutes from "./routes/ai.js";
import logger from "./utils/logger.js";
import { seedDatabase } from "./utils/seeder.js";
import { testEmailConfig, sendOrderConfirmationEmail } from "./services/emailService.js";
import { initGoogleStrategy } from "./config/passport.js";

dotenv.config(); // Load .env variables
initGoogleStrategy(); // Init Google OAuth AFTER dotenv

const app = express();
const port = process.env.PORT || 3001;

// CORS Configuration
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : [];

// Always include these defaults
const defaultOrigins = [
  'https://shop.a5x.in',
  'https://www.shop.a5x.in',
  'https://ecommerce-a5x-frontend.vercel.app',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174'
];

const corsOrigins = [...new Set([...defaultOrigins, ...allowedOrigins])];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    if (corsOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// Security Middleware (after CORS)
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Gzip compression — reduces response size by ~70%
app.use(compression());

// Body parser middleware - 50mb to support up to 10 base64 images per request
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Passport middleware (for Google OAuth)
app.use(passport.initialize());

// Logging
app.use(morgan("combined"));

// Trust proxy when behind a load balancer
app.set("trust proxy", 1);

// Rate Limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || 900000), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || 500), // limit each IP to 500 requests per windowMs
  message: { error: "Too many requests from this IP, please try again later.", code: "RATE_LIMITED" },
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

// Email test endpoint (No auth — for debugging only)
app.get("/api/test-email", async (req, res) => {
  const result = await testEmailConfig();
  if (result.ok) {
    try {
      const toEmail = process.env.EMAIL_USER || 'anshrajbaghel30@gmail.com';
      await sendOrderConfirmationEmail({
        customerName: 'Test User',
        customerEmail: toEmail,
        orderNumber: 'TEST-000001',
        createdAt: new Date(),
        items: [{ name: 'ESP32 DevKit', quantity: 1, price: 350 }],
        total: 350,
        address: { street: '123 Test St', city: 'Mumbai', state: 'MH', pincode: '400001' },
        paymentMethod: 'cod'
      });
      res.json({ ok: true, message: `Test email sent to ${toEmail}` });
    } catch (err) {
      res.json({ ok: false, error: err.message });
    }
  } else {
    res.json({ ok: false, error: result.error });
  }
});

// Public API routes
app.use("/api/products", productRoutes);
app.use("/api/kits", kitRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/contacts", contactRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/ai", aiRoutes);

// API root response
app.get("/", (_req, res) => {
  res.json({ 
    message: "A5X Robotics API is running!",
    version: "1.0.0",
    status: "ok"
  });
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

  const server = app.listen(port, () => {
    console.log(`A5X server running on http://localhost:${port}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Port ${port} is already in use. Please kill the existing process and restart.`);
      process.exit(1);
    } else {
      throw err;
    }
  });
}

start();
