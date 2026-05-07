import dotenv from "dotenv";
import mongoose from "mongoose";
import Product from "./models/Product.js";
import Kit from "./models/Kit.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend directory
dotenv.config({ path: path.join(__dirname, '.env') });

async function cleanDatabase() {
  try {
    console.log("Connecting to MongoDB Atlas...");
    console.log("MongoDB URI:", process.env.MONGODB_URI ? "Found" : "NOT FOUND");
    
    if (!process.env.MONGODB_URI) {
      console.error("❌ MONGODB_URI not found in .env file!");
      process.exit(1);
    }
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB Atlas");
    
    // Delete all products and kits
    const productResult = await Product.deleteMany({});
    const kitResult = await Kit.deleteMany({});
    
    console.log(`✅ Deleted ${productResult.deletedCount} products`);
    console.log(`✅ Deleted ${kitResult.deletedCount} kits`);
    console.log("✅ Database cleaned successfully!");
    
    await mongoose.disconnect();
    console.log("✅ Disconnected from MongoDB");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error cleaning database:", error);
    process.exit(1);
  }
}

cleanDatabase();
