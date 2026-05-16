import express from 'express';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import Contact from '../models/Contact.js';

const router = express.Router();

// POST /api/contacts - Submit contact form (public)
router.post('/', async (req, res) => {
  try {
    const { name, organization, email, phone, message } = req.body;
    if (!name || !message || !email) {
      return res.status(400).json({ error: 'Name, email and message are required' });
    }

    const contact = new Contact({
      name: name.trim(),
      organization: organization?.trim() || '',
      email: email.trim().toLowerCase(),
      phone: phone?.trim() || '',
      message: message.trim(),
      status: 'new'
    });

    await contact.save();
    console.log(`📩 New contact from ${name} (${email}) saved to MongoDB`);

    res.status(201).json({ success: true, message: 'Message received! We will get back to you soon.' });
  } catch (error) {
    console.error('Contact error:', error);
    res.status(500).json({ error: 'Failed to save contact' });
  }
});

// GET /api/contacts - Get all contacts (admin only)
router.get('/', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const contacts = await Contact.find({}).sort({ createdAt: -1 });
    res.json({ contacts, total: contacts.length });
  } catch (error) {
    console.error('Fetch contacts error:', error);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

// PATCH /api/contacts/:id/status - Update status (admin only)
router.patch('/:id/status', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { status } = req.body;
    const contact = await Contact.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!contact) return res.status(404).json({ error: 'Contact not found' });
    res.json({ success: true, contact });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update contact' });
  }
});

// DELETE /api/contacts/:id - Delete contact (admin only)
router.delete('/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const contact = await Contact.findByIdAndDelete(req.params.id);
    if (!contact) return res.status(404).json({ error: 'Contact not found' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete contact' });
  }
});

export default router;
