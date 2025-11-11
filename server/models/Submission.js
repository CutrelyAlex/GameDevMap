const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  submissionType: {
    type: String,
    enum: ['new', 'edit'],
    default: 'new',
    required: true
  },
  editingClubId: {
    type: String,
    trim: true
  },
  originalData: {
    type: mongoose.Schema.Types.Mixed
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    required: true
  },
  submittedAt: {
    type: Date,
    default: Date.now,
    required: true
  },
  reviewedAt: {
    type: Date
  },
  reviewedBy: {
    type: String
  },
  rejectionReason: {
    type: String
  },
  submitterEmail: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  
  // Club data (matches clubs.schema.json structure)
  data: {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100
    },
    school: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 200
    },
    province: {
      type: String,
      required: true,
      trim: true
    },
    city: {
      type: String,
      trim: true
    },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: function(v) {
          return v.length === 2 && 
                 v[0] >= -180 && v[0] <= 180 && // longitude
                 v[1] >= -90 && v[1] <= 90;     // latitude
        },
        message: '坐标格式错误：[经度, 纬度]，经度范围-180到180，纬度范围-90到90'
      }
    },
    description: {
      type: String,
      maxlength: 1000
    },
    shortDescription: {
      type: String,
      maxlength: 200
    },
    tags: {
      type: [String],
      default: [],
      validate: {
        validator: function(v) {
          return v.length <= 10;
        },
        message: '标签不能超过10个'
      }
    },
    logo: {
      type: String,
      trim: true
    },
    website: {
      type: String,
      trim: true
    },
    contact: {
      email: String,
      qq: String,
      wechat: String,
      discord: String,
      github: String
    }
  },
  
  // Metadata for validation and audit
  metadata: {
    ipAddress: String,
    userAgent: String,
    geocodingVerified: {
      type: Boolean,
      default: false
    },
    duplicateCheck: {
      passed: {
        type: Boolean,
        default: true
      },
      similarClubs: [{
        id: String,
        name: String,
        school: String,
        matchType: {
          type: String,
          enum: ['exact', 'similar', 'nearby']
        },
        confidence: Number,
        distance: Number // 仅用于nearby类型，单位米
      }]
    }
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
submissionSchema.index({ status: 1, submittedAt: -1 });
submissionSchema.index({ 'metadata.ipAddress': 1, submittedAt: -1 });
submissionSchema.index({ 'data.school': 'text', 'data.name': 'text' });

module.exports = mongoose.model('Submission', submissionSchema);
