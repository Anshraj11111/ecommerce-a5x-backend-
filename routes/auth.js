import express from "express";
import User from "../models/User.js";
import { generateToken, authenticateToken } from "../middleware/auth.js";
import { validate, schemas } from "../middleware/validation.js";

const router = express.Router();

// POST signup
router.post("/signup", validate(schemas.signup), async (req, res, next) => {
  try {
    const { username, email, password } = req.validatedData;

    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }] 
    });

    if (existingUser) {
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

    await user.save();

    // Generate token
    const token = generateToken(user._id, user.username, user.role);

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
    next(error);
  }
});

// POST login
router.post("/login", validate(schemas.login), async (req, res, next) => {
  try {
    console.log('Login request body:', req.body);
    console.log('Validated data:', req.validatedData);
    
    const { email, password } = req.validatedData;

    // Find user with password field
    const user = await User.findOne({ email }).select("+password");

    if (!user || !user.isActive) {
      return res.status(401).json({ 
        error: "Invalid credentials",
        code: "INVALID_CREDENTIALS"
      });
    }

    // Check if account is locked
    if (user.isLocked()) {
      return res.status(429).json({ 
        error: "Account locked due to too many login attempts. Try again later.",
        code: "ACCOUNT_LOCKED"
      });
    }

    // Verify password
    const passwordMatch = await user.comparePassword(password);

    if (!passwordMatch) {
      await user.incLoginAttempts();
      return res.status(401).json({ 
        error: "Invalid credentials",
        code: "INVALID_CREDENTIALS"
      });
    }

    // Reset login attempts on successful login
    await user.resetLoginAttempts();

    // Generate token
    const token = generateToken(user._id, user.username, user.role);

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

export default router;
