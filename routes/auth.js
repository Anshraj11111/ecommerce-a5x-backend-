import express from "express";
import passport from "passport";
import User from "../models/User.js";
import mongoose from "mongoose";
import { generateToken, authenticateToken } from "../middleware/auth.js";
import { validate, schemas } from "../middleware/validation.js";

const router = express.Router();

// ── Google OAuth Routes ────────────────────────────────────────────────────

// GET /api/auth/google - Initiate Google OAuth
router.get("/google", passport.authenticate("google", {
  scope: ["profile", "email"],
  session: false
}));

// GET /api/auth/google/callback - Google OAuth callback
router.get("/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=google_failed` }),
  (req, res) => {
    try {
      const user = req.user;
      const token = generateToken(user._id, user.username, user.role);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

      // Redirect to frontend with token
      res.redirect(`${frontendUrl}/auth/google/success?token=${token}&userId=${user._id}&username=${encodeURIComponent(user.username)}&email=${encodeURIComponent(user.email)}&role=${user.role}`);
    } catch (error) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}/login?error=token_failed`);
    }
  }
);

// POST signup
router.post("/signup", validate(schemas.signup), async (req, res, next) => {
  try {
    console.log('=== SIGNUP REQUEST ===');
    console.log('Request body:', req.body);
    console.log('Validated data:', req.validatedData);
    console.log('MongoDB connection state:', mongoose.connection.readyState);
    
    const { username, email, password } = req.validatedData;

    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }] 
    });

    if (existingUser) {
      console.log('User already exists:', existingUser.email);
      return res.status(409).json({ 
        error: existingUser.email === email 
          ? "Email already registered" 
          : "Username already taken",
        code: "USER_EXISTS"
      });
    }

    // Create new user
    const user = new User({
      username,
      email,
      password
    });

    console.log('Saving new user to MongoDB...');
    await user.save();
    console.log('User saved successfully:', user._id);

    // Generate token
    const token = generateToken(user._id, user.username, user.role);

    console.log('=== SIGNUP SUCCESS ===');
    res.status(201).json({
      message: "Account created successfully",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      },
      token
    });
  } catch (error) {
    console.error('=== SIGNUP ERROR ===', error);
    next(error);
  }
});

// POST login
router.post("/login", validate(schemas.login), async (req, res, next) => {
  try {
    console.log('=== LOGIN REQUEST ===');
    console.log('Request body:', req.body);
    console.log('Validated data:', req.validatedData);
    console.log('MongoDB connection state:', mongoose.connection.readyState);
    
    const { email, password } = req.validatedData;

    // Find user with password field
    const user = await User.findOne({ email }).select("+password");
    console.log('User found:', user ? user._id : 'NOT FOUND');

    if (!user || !user.isActive) {
      console.log('Login failed: Invalid credentials or inactive user');
      return res.status(401).json({ 
        error: "Invalid credentials",
        code: "INVALID_CREDENTIALS"
      });
    }

    // Check if account is locked
    if (user.isLocked()) {
      console.log('Login failed: Account locked');
      return res.status(429).json({ 
        error: "Account locked due to too many login attempts. Try again later.",
        code: "ACCOUNT_LOCKED"
      });
    }

    // Verify password
    const passwordMatch = await user.comparePassword(password);
    console.log('Password match:', passwordMatch);

    if (!passwordMatch) {
      await user.incLoginAttempts();
      console.log('Login failed: Invalid password');
      return res.status(401).json({ 
        error: "Invalid credentials",
        code: "INVALID_CREDENTIALS"
      });
    }

    // Reset login attempts on successful login
    await user.resetLoginAttempts();

    // Generate token
    const token = generateToken(user._id, user.username, user.role);

    console.log('=== LOGIN SUCCESS ===');
    res.json({
      message: "Login successful",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      },
      token
    });
  } catch (error) {
    console.error('=== LOGIN ERROR ===', error);
    next(error);
  }
});

// GET current user (Protected)
router.get("/me", authenticateToken, async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        error: "Not authenticated",
        code: "NOT_AUTHENTICATED"
      });
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ 
        error: "User not found",
        code: "USER_NOT_FOUND"
      });
    }

    res.json({
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
});

// Error handler
router.use((error, _req, res, _next) => {
  res.status(400).json({ 
    message: error.message || "Authentication request failed",
    code: "AUTH_ERROR"
  });
});

// POST /api/auth/make-admin - Set user role to admin by email (secured with admin secret)
router.post("/make-admin", async (req, res) => {
  try {
    const { email, secret } = req.body;
    
    // Verify admin secret to prevent unauthorized access
    const adminSecret = process.env.ADMIN_SETUP_SECRET || 'a5x-admin-setup-2026';
    if (secret !== adminSecret) {
      return res.status(403).json({ error: 'Invalid secret' });
    }
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'User not found', email });
    }
    
    user.role = 'admin';
    await user.save();
    
    // Generate new token with admin role
    const token = generateToken(user._id, user.username, 'admin');
    
    res.json({ 
      success: true, 
      message: `User ${email} is now admin`,
      token,
      user: { id: user._id, username: user.username, email: user.email, role: user.role }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
