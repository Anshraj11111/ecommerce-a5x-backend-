/**
 * Migration Script: Base64 images → Cloudinary URLs
 * Run: node --env-file=.env utils/migrateImagesToCloudinary.js
 */

import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';
import Product from '../models/Product.js';
import Kit from '../models/Kit.js';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function uploadBase64ToCloudinary(base64String, publicId, folder) {
  if (!base64String || !base64String.startsWith('data:')) return null;
  try {
    const result = await cloudinary.uploader.upload(base64String, {
      public_id: publicId,
      folder: `a5x/${folder}`,
      overwrite: true,
      resource_type: 'image',
      transformation: [
        { width: 800, height: 800, crop: 'limit', quality: 'auto', fetch_format: 'auto' }
      ]
    });
    return result.secure_url;
  } catch (err) {
    console.error(`Failed to upload ${publicId}:`, err.message);
    return null;
  }
}

async function migrateProducts() {
  console.log('\n📦 Migrating Products...');
  const products = await Product.find({});
  let updated = 0, skipped = 0;

  for (const product of products) {
    let changed = false;

    // Migrate main imageUrl
    if (product.imageUrl && product.imageUrl.startsWith('data:')) {
      console.log(`  Uploading product image: ${product.name.substring(0, 40)}`);
      const url = await uploadBase64ToCloudinary(
        product.imageUrl,
        `product-${product.id}`,
        'products'
      );
      if (url) { product.imageUrl = url; changed = true; }
    }

    // Migrate extra images array
    if (product.images && product.images.length > 0) {
      const newImages = [];
      for (let i = 0; i < product.images.length; i++) {
        const img = product.images[i];
        if (img && img.startsWith('data:')) {
          const url = await uploadBase64ToCloudinary(img, `product-${product.id}-img${i}`, 'products');
          newImages.push(url || img);
          if (url) changed = true;
        } else {
          newImages.push(img);
        }
      }
      product.images = newImages;
    }

    if (changed) {
      await product.save();
      updated++;
      console.log(`  ✅ ${product.name.substring(0, 40)}`);
    } else {
      skipped++;
    }
  }
  console.log(`  Products: ${updated} migrated, ${skipped} skipped (already URL)`);
}

async function migrateKits() {
  console.log('\n🤖 Migrating Kits...');
  const kits = await Kit.find({});
  let updated = 0, skipped = 0;

  for (const kit of kits) {
    let changed = false;

    // Migrate main imageUrl
    if (kit.imageUrl && kit.imageUrl.startsWith('data:')) {
      console.log(`  Uploading kit image: ${kit.name.substring(0, 40)}`);
      const url = await uploadBase64ToCloudinary(kit.imageUrl, `kit-${kit.id}`, 'kits');
      if (url) { kit.imageUrl = url; changed = true; }
    }

    // Migrate extra images array
    if (kit.images && kit.images.length > 0) {
      const newImages = [];
      for (let i = 0; i < kit.images.length; i++) {
        const img = kit.images[i];
        if (img && img.startsWith('data:')) {
          const url = await uploadBase64ToCloudinary(img, `kit-${kit.id}-img${i}`, 'kits');
          newImages.push(url || img);
          if (url) changed = true;
        } else {
          newImages.push(img);
        }
      }
      kit.images = newImages;
    }

    if (changed) {
      await kit.save();
      updated++;
      console.log(`  ✅ ${kit.name.substring(0, 40)}`);
    } else {
      skipped++;
    }
  }
  console.log(`  Kits: ${updated} migrated, ${skipped} skipped (already URL)`);
}

async function main() {
  console.log('🚀 Starting Cloudinary migration...');
  console.log(`   Cloud: ${process.env.CLOUDINARY_CLOUD_NAME}`);

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ MongoDB connected');

  await migrateProducts();
  await migrateKits();

  await mongoose.disconnect();
  console.log('\n🎉 Migration complete! All base64 images moved to Cloudinary.');
  console.log('   Products and Kits will now load instantly.');
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
