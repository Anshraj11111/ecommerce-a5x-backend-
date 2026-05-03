import jwt from "jsonwebtoken";

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Extract token from "Bearer TOKEN"

  if (!token) {
    return res.status(401).json({ 
      error: "Access token required",
      code: "NO_TOKEN"
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ 
        error: "Token expired",
        code: "TOKEN_EXPIRED"
      });
    }
    return res.status(403).json({ 
      error: "Invalid token",
      code: "INVALID_TOKEN"
    });
  }
};

export const authorizeRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: "User not authenticated",
        code: "NOT_AUTHENTICATED"
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: "Insufficient permissions",
        code: "FORBIDDEN",
        requiredRole: allowedRoles
      });
    }

    next();
  };
};

export const generateToken = (userId, username, role) => {
  return jwt.sign(
    { 
      id: userId, 
      username: username,
      role: role 
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || "7d" }
  );
};
