import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import mongoose from "mongoose";
import Product from "../models/Product.js";
import { authenticateToken, authorizeRole } from "../middleware/auth.js";
import { validate, schemas } from "../middleware/validation.js";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fallbackPath = path.join(__dirname, "..", "data", "products.json");

async function readFallback() {
  const data = await fs.readFile(fallbackPath, "utf8");
  return JSON.parse(data);
}

async function writeFallback(products) {
  await fs.writeFile(fallbackPath, JSON.stringify(products, null, 2));
}

function dbReady() {
  return mongoose.connection.readyState === 1;
}

// GET all products (Public)
router.get("/", async (req, res, next) => {
  try {
    const { category, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    console.log(`[Products GET] Fetching products - category: ${category}, page: ${page}, limit: ${limit}`);

    // Cache miss - fetch from database
    if (dbReady()) {
      const filter = category ? { category } : {};
      const total = await Product.countDocuments(filter);
      console.log(`[Products GET] Found ${total} products in database`);
      
      const products = await Product.find(filter)
        .sort({ _id: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean();
      
      console.log(`[Products GET] Fetched ${products.length} products`);
      
      const response = {
        data: products,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      };
      
      console.log(`[Products GET] Sending response with ${products.length} products`);
      res.json(response);
      return;
    }

    // Fallback to JSON file
    const products = await readFallback();
    const filtered = category ? products.filter((product) => product.category === category) : products;
    const paginated = filtered.slice(skip, skip + parseInt(limit));
    
    const response = {
      data: paginated,
      pagination: {
        total: filtered.length,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(filtered.length / parseInt(limit))
      }
    };
    
    res.json(response);
  } catch (error) {
    console.error('[Products GET] Error:', error);
    next(error);
  }
});

// GET single product by ID (Public)
router.get("/:id", async (req, res, next) => {
  try {
    // Fetch from database
    if (dbReady()) {
      const product = await Product.findOne({ id: req.params.id });
      if (!product) return res.status(404).json({ error: "Product not found", code: "NOT_FOUND" });
      
      res.json(product);
      return;
    }

    // Fallback to JSON file
    const products = await readFallback();
    const product = products.find((p) => p.id === req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found", code: "NOT_FOUND" });
    
    res.json(product);
  } catch (error) {
    next(error);
  }
});

// POST create product (Admin only)
router.post("/", authenticateToken, authorizeRole(["admin"]), validate(schemas.product), async (req, res, next) => {
  try {
    const product = {
      id: req.validatedData.id || `product-${Date.now()}`,
      name: req.validatedData.name,
      price: req.validatedData.price || 0,
      mrp: req.validatedData.mrp || 0,
      minQty: req.validatedData.minQty || 1,
      category: req.validatedData.category,
      sku: req.validatedData.sku || `SKU-${Date.now()}`,
      rating: req.validatedData.rating || 4.5,
      reviewCount: req.validatedData.reviewCount || 0,
      inStock: req.validatedData.inStock !== false,
      stockCount: req.validatedData.stockCount || 0,
      shortDescription: req.validatedData.shortDescription || "",
      features: req.validatedData.features || [],
      specs: req.validatedData.specs || {},
      compatibility: req.validatedData.compatibility || [],
      bulkPricing: req.validatedData.bulkPricing || [],
      badges: req.validatedData.badges || [],
      frequentlyBoughtWith: req.validatedData.frequentlyBoughtWith || [],
      relatedIds: req.validatedData.relatedIds || [],
      imageUrl: req.validatedData.imageUrl || ""
    };

    if (dbReady()) {
      const created = await Product.create(product);
      res.status(201).json(created);
      return;
    }

    const products = await readFallback();
    products.unshift(product);
    await writeFallback(products);
    res.status(201).json(product);
  } catch (error) {
    next(error);
  }
});

// POST bulk create products (Admin only)
router.post("/bulk", authenticateToken, authorizeRole(["admin"]), async (req, res, next) => {
  try {
    const { products } = req.body;
    
    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ 
        error: "Products array is required and must not be empty", 
        code: "INVALID_BULK_DATA" 
      });
    }

    console.log(`[Bulk Upload] Received ${products.length} products`);

    // Prepare products with defaults
    const preparedProducts = products.map((item, index) => ({
      id: item.id || `product-${Date.now()}-${index}`,
      name: item.name || `Product ${index + 1}`,
      price: parseFloat(item.price) || 0,
      mrp: parseFloat(item.mrp) || Math.round((parseFloat(item.price) || 0) * 1.4),
      minQty: parseInt(item.minQty) || 1,
      category: item.category || 'Electronics',
      sku: item.sku || `A5X-${Date.now().toString(36).toUpperCase()}-${index}`,
      rating: parseFloat(item.rating) || 4.7,
      reviewCount: parseInt(item.reviewCount) || 0,
      inStock: item.inStock !== false,
      stockCount: parseInt(item.stockCount) || parseInt(item.qty) || 10,
      shortDescription: item.shortDescription || item.name || '',
      features: item.features || [],
      specs: item.specs || {},
      compatibility: item.compatibility || [],
      bulkPricing: item.bulkPricing || [],
      badges: item.badges || [],
      frequentlyBoughtWith: item.frequentlyBoughtWith || [],
      relatedIds: item.relatedIds || [],
      imageUrl: item.imageUrl || '',
      quickDelivery: item.quickDelivery || false
    }));

    if (dbReady()) {
      // Use insertMany for bulk insert (much faster than individual creates)
      const created = await Product.insertMany(preparedProducts, { ordered: false });
      console.log(`[Bulk Upload] Successfully inserted ${created.length} products to MongoDB`);
      
      res.status(201).json({ 
        success: true,
        message: `Successfully added ${created.length} products to database`,
        count: created.length,
        products: created 
      });
      return;
    }

    // Fallback to JSON file
    const existingProducts = await readFallback();
    existingProducts.unshift(...preparedProducts);
    await writeFallback(existingProducts);
    
    console.log(`[Bulk Upload] Successfully added ${preparedProducts.length} products to JSON fallback`);
    
    res.status(201).json({ 
      success: true,
      message: `Successfully added ${preparedProducts.length} products to fallback storage`,
      count: preparedProducts.length,
      products: preparedProducts 
    });
  } catch (error) {
    console.error('[Bulk Upload] Error:', error);
    next(error);
  }
});

// PUT update product (Admin only)
router.put("/:id", authenticateToken, authorizeRole(["admin"]), validate(schemas.product), async (req, res, next) => {
  try {
    if (dbReady()) {
      const updated = await Product.findOneAndUpdate({ id: req.params.id }, req.validatedData, { new: true });
      if (!updated) return res.status(404).json({ error: "Product not found", code: "NOT_FOUND" });
      
      res.json(updated);
      return;
    }

    const products = await readFallback();
    const index = products.findIndex((p) => p.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: "Product not found", code: "NOT_FOUND" });
    products[index] = { ...products[index], ...req.validatedData };
    await writeFallback(products);
    
    res.json(products[index]);
  } catch (error) {
    next(error);
  }
});

// DELETE product (Admin only)
router.delete("/:id", authenticateToken, authorizeRole(["admin"]), async (req, res, next) => {
  try {
    if (dbReady()) {
      const deleted = await Product.findOneAndDelete({ id: req.params.id });
      if (!deleted) return res.status(404).json({ error: "Product not found", code: "NOT_FOUND" });
      
      res.json({ message: "Product deleted", product: deleted });
      return;
    }

    const products = await readFallback();
    const index = products.findIndex((p) => p.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: "Product not found", code: "NOT_FOUND" });
    const deleted = products.splice(index, 1);
    await writeFallback(products);
    
    res.json({ message: "Product deleted", product: deleted[0] });
  } catch (error) {
    next(error);
  }
});

router.use((error, _req, res, _next) => {
  console.error('❌ Products route error:', error);
  console.error('Error stack:', error.stack);
  res.status(400).json({ error: error.message || "Product request failed", code: "PRODUCT_ERROR" });
});

export default router;
