const mongoose = require('mongoose');

const clubSchema = new mongoose.Schema({
  // 排序用的隐藏索引字段（仅数据库可见，不导出到JSON）
  index: {
    type: Number,
    required: true,
    default: 0
  },
  
  name: {
    type: String,
    required: true,
    trim: true
  },
  school: {
    type: String,
    required: true,
    trim: true
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
      message: '坐标格式错误'
    }
  },
  description: {
    type: String
  },
  shortDescription: {
    type: String
  },
  tags: {
    type: [String],
    default: []
  },
  logo: {
    type: String
  },
  externalLinks: {
    type: [{
      _id: false,  // 禁用 Mongoose 自动添加的 _id 字段
      type: { type: String },
      url: { type: String },
      qrcode: { type: String }  // QR code image filename (optional)
    }],
    default: []
  },
  
  // Audit trail fields
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  sourceSubmission: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Submission'
  },
  verifiedBy: {
    type: String
  }
});

// Index for efficient geographic queries
clubSchema.index({ coordinates: '2dsphere' });
clubSchema.index({ province: 1 });
clubSchema.index({ name: 'text', school: 'text' });
// 复合索引用于快速查找同名同校社团
clubSchema.index({ name: 1, school: 1 });

// 虚拟字段：name+school组合标识
clubSchema.virtual('identifier').get(function() {
  return `${this.name}|${this.school}`;
});

// Ensure virtual fields are serialized
clubSchema.set('toJSON', {
  virtuals: false,  // 禁用虚拟字段序列化
  transform: function(doc, ret) {
    // 删除数据库内部字段，不输出到JSON
    delete ret._id;
    delete ret.__v;
    delete ret.index;
    delete ret.sourceSubmission;
    delete ret.verifiedBy;
    
    // 不添加 id 字段
    return ret;
  }
});

clubSchema.set('toObject', {
  virtuals: false
});

// Update timestamp on save
clubSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Club', clubSchema);
