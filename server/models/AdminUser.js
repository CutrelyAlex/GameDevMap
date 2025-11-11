const mongoose = require('mongoose');

const adminUserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 20
  },
  passwordHash: {
    type: String,
    required: true,
    select: false // Never expose password hash in queries by default
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  role: {
    type: String,
    enum: ['super_admin', 'moderator'],
    default: 'super_admin'
  },
  active: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes are automatically created by unique: true in schema definition

module.exports = mongoose.model('AdminUser', adminUserSchema);
