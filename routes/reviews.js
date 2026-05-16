import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import Review from '../models/Review.js';

const router = express.Router();

// Get reviews for a specific kit (only approved ones for public)
router.get('/kit/:kitId', async (req, res) => {
  try {
    const { kitId } = req.params;
    const reviews = await Review.find({ kitId, approved: true })
      .sort({ createdAt: -1 })
      .select('-email -approvedBy'); // Don't expose email and approvedBy to public
    
    res.json(reviews);
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// Submit a new review
router.post('/submit', async (req, res) => {
  try {
    const { kitId, name, email, rating, comment } = req.body;

    // Validation
    if (!kitId || !name || !email || !rating || !comment) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    // Check if user already reviewed this kit
    const existingReview = await Review.findOne({ kitId, email: email.toLowerCase() });
    if (existingReview) {
      return res.status(400).json({ error: 'You have already reviewed this kit' });
    }

    const newReview = new Review({
      kitId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      rating: parseInt(rating),
      comment: comment.trim(),
      approved: false // Reviews need admin approval
    });

    await newReview.save();

    res.status(201).json({ 
      message: 'Review submitted successfully! It will be visible after admin approval.',
      reviewId: newReview._id
    });
  } catch (error) {
    console.error('Error submitting review:', error);
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

// Admin routes - Get all reviews (approved and pending)
router.get('/admin/all', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }

    const reviews = await Review.find({})
      .sort({ createdAt: -1 });
    
    res.json(reviews);
  } catch (error) {
    console.error('Error fetching admin reviews:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// Admin approve review
router.put('/admin/approve/:reviewId', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }

    const { reviewId } = req.params;
    const review = await Review.findById(reviewId);

    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    review.approved = true;
    review.approvedBy = req.user.username;
    review.approvedAt = new Date();
    await review.save();

    res.json({ message: 'Review approved successfully', review });
  } catch (error) {
    console.error('Error approving review:', error);
    res.status(500).json({ error: 'Failed to approve review' });
  }
});

// Admin delete review
router.delete('/admin/delete/:reviewId', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }

    const { reviewId } = req.params;
    const review = await Review.findByIdAndDelete(reviewId);

    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    res.json({ message: 'Review deleted successfully', review });
  } catch (error) {
    console.error('Error deleting review:', error);
    res.status(500).json({ error: 'Failed to delete review' });
  }
});

// Admin get pending reviews
router.get('/admin/pending', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }

    const pendingReviews = await Review.find({ approved: false })
      .sort({ createdAt: -1 });
    
    res.json(pendingReviews);
  } catch (error) {
    console.error('Error fetching pending reviews:', error);
    res.status(500).json({ error: 'Failed to fetch pending reviews' });
  }
});

export default router;