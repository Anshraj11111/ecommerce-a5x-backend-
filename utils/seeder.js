import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import Product from "../models/Product.js";
import Kit from "../models/Kit.js";
import Course from "../models/Course.js";
import User from "../models/User.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");

/**
 * Seed data from JSON files into MongoDB
 */
export async function seedDatabase() {
  console.log("Checking database for existing data...");
  
  try {
    // Check if data already exists
    const productCount = await Product.countDocuments();
    const kitCount = await Kit.countDocuments();
    const courseCount = await Course.countDocuments();
    const userCount = await User.countDocuments();
    
    if (productCount > 0 || kitCount > 0 || courseCount > 0) {
      console.log(`Database already seeded: ${productCount} products, ${kitCount} kits, ${courseCount} courses, ${userCount} users`);
      
      // Always ensure admin user exists with correct role
      const adminEmail = process.env.ADMIN_EMAIL || "admin@a5xrobotics.com";
      const adminUser = await User.findOne({ email: adminEmail });
      if (!adminUser) {
        console.log("No admin user found. Creating default admin...");
        await createDefaultAdmin();
      } else if (adminUser.role !== 'admin') {
        // Fix role if it's wrong
        adminUser.role = 'admin';
        await adminUser.save();
        console.log(`✅ Fixed admin role for ${adminEmail}`);
      }
      
      return false;
    }
    
    console.log("No data found. Seeding database...");
    
    // Create default admin user first
    await createDefaultAdmin();
    
    // Load and import products
    try {
      const productsData = await fs.readFile(path.join(dataDir, "products.json"), "utf-8");
      const products = JSON.parse(productsData);
      if (products.length > 0) {
        await Product.insertMany(products);
        console.log(`Seeded ${products.length} products`);
      }
    } catch (err) {
      console.warn("No products.json found or error seeding products:", err.message);
    }
    
    // Load and import kits
    try {
      const kitsData = await fs.readFile(path.join(dataDir, "kits.json"), "utf-8");
      const kits = JSON.parse(kitsData);
      if (kits.length > 0) {
        await Kit.insertMany(kits);
        console.log(`Seeded ${kits.length} kits`);
      }
    } catch (err) {
      console.warn("No kits.json found or error seeding kits:", err.message);
    }
    
    // Load and import courses
    try {
      const coursesData = await fs.readFile(path.join(dataDir, "courses.json"), "utf-8");
      const courses = JSON.parse(coursesData);
      if (courses.length > 0) {
        await Course.insertMany(courses);
        console.log(`Seeded ${courses.length} courses`);
      }
    } catch (err) {
      console.warn("No courses.json found or error seeding courses:", err.message);
    }
    
    console.log("Database seeding complete!");
    return true;
  } catch (error) {
    console.error("Error seeding database:", error.message);
    return false;
  }
}

/**
 * Create default admin user
 */
async function createDefaultAdmin() {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || "admin@a5xrobotics.com";
    const adminPassword = process.env.ADMIN_PASSWORD || "Admin@123456";
    const adminUsername = process.env.ADMIN_USERNAME || "admin";
    
    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: adminEmail });
    if (existingAdmin) {
      console.log(`Admin user already exists: ${adminEmail}`);
      return;
    }
    
    // Create admin user
    const adminUser = new User({
      username: adminUsername,
      email: adminEmail,
      password: adminPassword,
      role: "admin",
      isActive: true
    });
    
    await adminUser.save();
    console.log(`✅ Default admin user created successfully!`);
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Password: ${adminPassword}`);
    console.log(`   Username: ${adminUsername}`);
    console.log(`   ⚠️  Please change the password after first login!`);
  } catch (error) {
    console.error("Error creating default admin user:", error.message);
  }
}

export default { seedDatabase };
