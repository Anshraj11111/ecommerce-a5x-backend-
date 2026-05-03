import express from 'express';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';

const router = express.Router();

// In-memory store (use MongoDB in production)
let contacts = [];

// POST /api/contacts - Submit contact form (public)
router.post('/', async (req, res) => {
  try {
    const { name, organization, email, phone, message } = req.body;
    if (!name || !message) return res.status(400).json({ error: 'Name and message are required' });

    const contact = {
      id: Date.now().toString(),
      name,
      organization: organization || '',
      email: email || '',
      phone: phone || '',
      message,
      status: 'new',
      createdAt: new Date().toISOString()
    };

    contacts.unshift(contact);
    console.log(`📩 New contact from ${name} (${email})`);

    res.status(201).json({ success: true, message: 'Message received! We will get back to you soon.' });
  } catch (error) {
    console.error('Contact error:', error);
    res.status(500).json({ error: 'Failed to save contact' });
  }
});

// GET /api/contacts - Get all contacts (admin only)
router.get('/', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    res.json({ contacts, total: contacts.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

// PATCH /api/contacts/:id/status - Mark as read (admin only)
router.patch('/:id/status', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { status } = req.body;
    contacts = contacts.map(c => c.id === req.params.id ? { ...c, status } : c);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update contact' });
  }
});

// DELETE /api/contacts/:id - Delete contact (admin only)
router.delete('/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    contacts = contacts.filter(c => c.id !== req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete contact' });
  }
});

export default router;
