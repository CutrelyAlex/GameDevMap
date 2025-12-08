const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const AdminUser = require('../models/AdminUser');
const connectDB = require('../config/db');

async function createAdmin(username, password, email, role = 'super_admin') {
  try {
    await connectDB();
    
    const existing = await AdminUser.findOne({ 
      $or: [{ username }, { email }] 
    });
    
    if (existing) {
      console.log('用户已存在');
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const admin = new AdminUser({
      username,
      passwordHash,
      email,
      role,
      active: true
    });

    await admin.save();
    console.log('管理员创建成功');
  } catch (error) {
    console.error('创建失败:', error);
  }
}

// 从命令行参数获取
const [,, username, password, email, role] = process.argv;
createAdmin(username, password, email, role);