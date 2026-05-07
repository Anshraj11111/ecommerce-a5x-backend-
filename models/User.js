import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    username: { 
      type: String, 
      required: true, 
      unique: true, 
      trim: true,
      minlength: 3,
      maxlength: 30
    },
    email: { 
      type: String, 
      required: true, 
      unique: true, 
      lowercase: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    },
    password: { 
      type: String, 
      required: false,
      minlength: 8,
      select: false
    },
    googleId: {
      type: String,
      default: null
    },
    avatar: {
      type: String,
      default: ''
    },
    role: { 
      type: String, 
      enum: ["user", "admin"], 
      default: "user"
    },
    isActive: { 
      type: Boolean, 
      default: true
    },
    lastLogin: { 
      type: Date, 
      default: null
    },
    loginAttempts: { 
      type: Number, 
      default: 0
    },
    lockUntil: { 
      type: Date, 
      default: null
    }
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre("save", async function(next) {
  if (!this.isModified("password")) return next();
  if (!this.password) return next(); // Skip for Google OAuth users
  
  try {
    const salt = await bcrypt.genSalt(parseInt(process.env.BCRYPT_ROUNDS || 10));
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Method to handle login attempts
userSchema.methods.incLoginAttempts = function() {
  // Reset attempts if lock has expired
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: { loginAttempts: 1, lockUntil: null }
    });
  }
  
  // Increment attempts
  return this.updateOne({
    $inc: { loginAttempts: 1 },
    $set: { lockUntil: Date.now() + 30 * 60 * 1000 } // 30 minutes
  });
};

// Method to reset login attempts
userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $set: { loginAttempts: 0, lockUntil: null, lastLogin: Date.now() }
  });
};

// Check if account is locked
userSchema.methods.isLocked = function() {
  return this.lockUntil && this.lockUntil > Date.now();
};

export default mongoose.models.User || mongoose.model("User", userSchema);
