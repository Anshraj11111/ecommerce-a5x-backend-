import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import { sendOrderConfirmationEmail, sendShippingEmail } from '../services/emailService.js';

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ordersFilePath = path.join(__dirname, '..', 'data', 'orders.json');

function dbReady() {
  return mongoose.connection.readyState === 1;
}

function generateOrderNumber() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `A5X-${ts}-${rand}`;
}

async function getNextOrderNumber() {
  // Try MongoDB first
  if (dbReady()) {
    try {
      const count = await mongoose.model('Order').countDocuments();
      return `A5X-${String(count + 1).padStart(6, '0')}`;
    } catch {
      // fall through to JSON fallback counter
    }
  }
  // JSON fallback — count existing orders
  const orders = await readOrdersFallback();
  return `A5X-${String(orders.length + 1).padStart(6, '0')}`;
}

async function readOrdersFallback() {
  try {
    const data = await fs.readFile(ordersFilePath, 'utf8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeOrdersFallback(orders) {
  await fs.writeFile(ordersFilePath, JSON.stringify(orders, null, 2));
}

// Create new order (Public)
router.post('/', async (req, res) => {
  try {
    const {
      customerName,
      customerEmail,
      customerPhone,
      address,
      items,
      subtotal,
      shippingCost,
      tax,
      total,
      paymentMethod,
      customerNotes
    } = req.body;

    // Validate required fields
    if (!customerName || !customerEmail || !customerPhone || !address || !items || items.length === 0) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const orderNumber = await getNextOrderNumber();
    const now = new Date().toISOString();

    // Use MongoDB if connected, otherwise fall back to JSON file
    if (dbReady()) {
      const order = new Order({
        orderNumber,
        customerName, customerEmail, customerPhone, address, items,
        subtotal, shippingCost: shippingCost || 0, tax: tax || 0, total,
        paymentMethod: paymentMethod || 'cod', customerNotes
      });
      await order.save();
      return res.status(201).json({
        success: true,
        message: 'Order placed successfully',
        order: { orderNumber: order.orderNumber, orderId: order._id, total: order.total, status: order.status }
      });
    }

    // JSON fallback — works even when MongoDB is unavailable
    const orders = await readOrdersFallback();
    const newOrder = {
      _id: `order-${Date.now()}`,
      orderNumber,
      customerName, customerEmail, customerPhone, address, items,
      subtotal, shippingCost: shippingCost || 0, tax: tax || 0, total,
      paymentMethod: paymentMethod || 'cod',
      customerNotes: customerNotes || '',
      status: 'pending',
      paymentStatus: 'pending',
      createdAt: now,
      updatedAt: now
    };
    orders.unshift(newOrder);
    await writeOrdersFallback(orders);

    return res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      order: { orderNumber: newOrder.orderNumber, orderId: newOrder._id, total: newOrder.total, status: newOrder.status }
    });
  } catch (error) {
    console.error('Error creating order:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ error: 'Validation failed', details: messages });
    }
    res.status(500).json({ error: 'Failed to create order', detail: error.message });
  }
});

// Get all orders (Admin only)
router.get('/', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    if (dbReady()) {
      const query = status ? { status } : {};
      const orders = await Order.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit));
      const total = await Order.countDocuments(query);
      return res.json({ orders, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) } });
    }

    // JSON fallback
    let orders = await readOrdersFallback();
    if (status) orders = orders.filter(o => o.status === status);
    const total = orders.length;
    const paginated = orders.slice(skip, skip + parseInt(limit));
    res.json({ orders: paginated, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Get single order by ID (Admin only)
router.get('/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    if (dbReady()) {
      const order = await Order.findById(req.params.id);
      if (!order) return res.status(404).json({ error: 'Order not found' });
      return res.json(order);
    }

    const orders = await readOrdersFallback();
    const order = orders.find(o => o._id === req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// Update order status (Admin only)
router.patch('/:id/status', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { status, trackingNumber, adminNotes } = req.body;
    const now = new Date();

    if (dbReady()) {
      const order = await Order.findById(req.params.id);
      if (!order) return res.status(404).json({ error: 'Order not found' });

      if (status) {
        order.status = status;
        if (status === 'confirmed' && !order.confirmedAt) order.confirmedAt = now;
        else if (status === 'shipped' && !order.shippedAt) order.shippedAt = now;
        else if (status === 'delivered' && !order.deliveredAt) order.deliveredAt = now;
      }
      if (trackingNumber) order.trackingNumber = trackingNumber;
      if (adminNotes) order.adminNotes = adminNotes;

      await order.save();

      // Send email immediately — don't await so response is fast
      if (status === 'confirmed') {
        sendOrderConfirmationEmail(order).catch(e => console.error('Email error:', e.message));
      } else if (status === 'shipped') {
        sendShippingEmail(order).catch(e => console.error('Email error:', e.message));
      }

      return res.json({ success: true, message: 'Order updated successfully', order });
    }

    // JSON fallback
    const orders = await readOrdersFallback();
    const idx = orders.findIndex(o => o._id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Order not found' });

    const order = { ...orders[idx] };
    if (status) {
      order.status = status;
      if (status === 'confirmed' && !order.confirmedAt) order.confirmedAt = now.toISOString();
      else if (status === 'shipped' && !order.shippedAt) order.shippedAt = now.toISOString();
      else if (status === 'delivered' && !order.deliveredAt) order.deliveredAt = now.toISOString();
    }
    if (trackingNumber) order.trackingNumber = trackingNumber;
    if (adminNotes) order.adminNotes = adminNotes;
    order.updatedAt = now.toISOString();

    orders[idx] = order;
    await writeOrdersFallback(orders);

    // Send email immediately — don't await
    if (status === 'confirmed') {
      sendOrderConfirmationEmail(order).catch(e => console.error('Email error:', e.message));
    } else if (status === 'shipped') {
      sendShippingEmail(order).catch(e => console.error('Email error:', e.message));
    }

    return res.json({ success: true, message: 'Order updated successfully', order });
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({ error: 'Failed to update order', detail: error.message });
  }
});

// Delete order (Admin only)
router.delete('/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    if (dbReady()) {
      const order = await Order.findByIdAndDelete(req.params.id);
      if (!order) return res.status(404).json({ error: 'Order not found' });
      return res.json({ success: true, message: 'Order deleted successfully' });
    }

    const orders = await readOrdersFallback();
    const idx = orders.findIndex(o => o._id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Order not found' });
    orders.splice(idx, 1);
    await writeOrdersFallback(orders);
    res.json({ success: true, message: 'Order deleted successfully' });
  } catch (error) {
    console.error('Error deleting order:', error);
    res.status(500).json({ error: 'Failed to delete order' });
  }
});

// Helper function to send order confirmation SMS
async function sendOrderConfirmationSMS(order) {
  try {
    console.log(`📱 SMS to ${order.customerPhone}:`);
    const smsContent = `A5X Industries: Your order #${order.orderNumber} (₹${order.total}) has been confirmed! We'll notify you once shipped. Thank you!`;
    console.log(smsContent);
    
    // TODO: Integrate with Twilio or MSG91 for real SMS
    // Example Twilio code (commented):
    // await twilioClient.messages.create({
    //   body: smsContent,
    //   from: process.env.TWILIO_PHONE,
    //   to: order.customerPhone
    // });
    
  } catch (error) {
    console.error('Error sending SMS:', error);
  }
}

// Helper function to send shipping SMS
async function sendShippingSMS(order) {
  try {
    console.log(`📱 SMS to ${order.customerPhone}:`);
    const smsContent = `A5X Industries: Your order #${order.orderNumber} has been shipped! ${order.trackingNumber ? `Track: ${order.trackingNumber}` : 'Delivery soon!'}`;
    console.log(smsContent);
    
    // TODO: Integrate with Twilio or MSG91 for real SMS
    
  } catch (error) {
    console.error('Error sending shipping SMS:', error);
  }
}

export default router;
