import express from 'express';
import Order from '../models/Order.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import { sendOrderConfirmationEmail, sendShippingEmail } from '../services/emailService.js';

const router = express.Router();

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

    // Create order
    const order = new Order({
      customerName,
      customerEmail,
      customerPhone,
      address,
      items,
      subtotal,
      shippingCost: shippingCost || 0,
      tax: tax || 0,
      total,
      paymentMethod: paymentMethod || 'cod',
      customerNotes
    });

    await order.save();

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      order: {
        orderNumber: order.orderNumber,
        orderId: order._id,
        total: order.total,
        status: order.status
      }
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
    
    const query = status ? { status } : {};
    const skip = (page - 1) * limit;

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Order.countDocuments(query);

    res.json({
      orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Get single order by ID (Admin only)
router.get('/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

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
    
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Update status
    if (status) {
      order.status = status;
      
      // Update timestamps based on status
      if (status === 'confirmed' && !order.confirmedAt) {
        order.confirmedAt = new Date();
      } else if (status === 'shipped' && !order.shippedAt) {
        order.shippedAt = new Date();
      } else if (status === 'delivered' && !order.deliveredAt) {
        order.deliveredAt = new Date();
      }
    }

    if (trackingNumber) order.trackingNumber = trackingNumber;
    if (adminNotes) order.adminNotes = adminNotes;

    await order.save();

    // Send notification to customer
    if (status === 'confirmed') {
      await sendOrderConfirmationEmail(order);
      await sendOrderConfirmationSMS(order);
    } else if (status === 'shipped') {
      await sendShippingEmail(order);
      await sendShippingSMS(order);
    }

    res.json({
      success: true,
      message: 'Order updated successfully',
      order
    });
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({ error: 'Failed to update order' });
  }
});

// Delete order (Admin only)
router.delete('/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

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
