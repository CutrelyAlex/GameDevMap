const express = require('express');
const bcrypt = require('bcryptjs');
const AdminUser = require('../models/AdminUser');
const { issueToken, authenticate } = require('../middleware/auth');
const { authLimiter, apiLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.post('/login', authLimiter, async (req, res) => {
	const { username, password } = req.body || {};

	if (!username || !password) {
		return res.status(400).json({
			success: false,
			error: 'INVALID_CREDENTIALS',
			message: '请输入用户名和密码'
		});
	}

	try {
		const admin = await AdminUser.findOne({ username: username.trim() })
			.select('+passwordHash');

		if (!admin) {
			return res.status(401).json({
				success: false,
				error: 'INVALID_CREDENTIALS',
				message: '账号或密码错误'
			});
		}

		if (admin.active === false) {
			return res.status(403).json({
				success: false,
				error: 'ACCOUNT_DISABLED',
				message: '该账号已被禁用，请联系系统管理员'
			});
		}

		const passwordValid = await bcrypt.compare(password, admin.passwordHash);
		if (!passwordValid) {
			return res.status(401).json({
				success: false,
				error: 'INVALID_CREDENTIALS',
				message: '账号或密码错误'
			});
		}

		const previousLogin = admin.lastLogin;
		admin.lastLogin = new Date();
		await admin.save();

		const token = issueToken({
			id: admin._id.toString(),
			username: admin.username,
			role: admin.role
		});

		return res.status(200).json({
			success: true,
			message: '登录成功',
			data: {
				token,
				user: {
					id: admin._id.toString(),
					username: admin.username,
					email: admin.email,
					role: admin.role,
					lastLogin: previousLogin ? previousLogin.toISOString() : null
				}
			}
		});
	} catch (error) {
		console.error('Admin login failed:', error);
		return res.status(500).json({
			success: false,
			error: 'SERVER_ERROR',
			message: '服务器错误，稍后再试'
		});
	}
});

router.get('/verify', apiLimiter, authenticate, async (req, res) => {
	try {
		const admin = await AdminUser.findById(req.user.id).lean();

		if (!admin || admin.active === false) {
			return res.status(401).json({
				success: false,
				error: 'UNAUTHORIZED',
				message: '管理员账号不存在或已被禁用'
			});
		}

		return res.status(200).json({
			success: true,
			data: {
				user: {
					id: admin._id.toString(),
					username: admin.username,
					email: admin.email,
					role: admin.role,
					lastLogin: admin.lastLogin ? admin.lastLogin.toISOString() : null
				}
			}
		});
	} catch (error) {
		console.error('Verify token failed:', error);
		return res.status(500).json({
			success: false,
			error: 'SERVER_ERROR',
			message: '服务器错误，稍后再试'
		});
	}
});

module.exports = router;
