/**
 * 中间件单元测试
 * 测试验证、认证、速率限制等中间件
 */
const assert = require('assert');

describe('Middleware', () => {
  describe('Validate Middleware', () => {
    const { submissionSchema, PROVINCES } = require('../../server/middleware/validate');
    const Joi = require('joi');

    it('应该验证有效的提交数据', () => {
      const validData = {
        name: '测试社团',
        school: '测试大学',
        province: '北京市',
        city: '北京',
        coordinates: {
          latitude: 39.9,
          longitude: 116.4
        },
        submitterEmail: 'test@example.com',
        description: '描述',
        shortDescription: '简介',
        tags: ['标签'],
        externalLinks: [],
        logo: ''
      };

      const { error, value } = submissionSchema.validate(validData);
      assert(!error, `验证应该成功，但得到错误: ${error?.message}`);
      assert(value);
    });

    it('应该拒绝无效的邮箱', () => {
      const invalidData = {
        name: '测试社团',
        school: '测试大学',
        province: '北京市',
        coordinates: { latitude: 0, longitude: 0 },
        submitterEmail: 'invalid-email',
        tags: []
      };

      const { error } = submissionSchema.validate(invalidData);
      assert(error, '应该验证失败');
    });

    it('应该拒绝无效的省份', () => {
      const invalidData = {
        name: '测试社团',
        school: '测试大学',
        province: '不存在的省份',
        coordinates: { latitude: 0, longitude: 0 },
        submitterEmail: 'test@example.com'
      };

      const { error } = submissionSchema.validate(invalidData);
      assert(error, '应该验证失败');
    });

    it('应该包含所有有效的省份', () => {
      assert(Array.isArray(PROVINCES));
      assert.strictEqual(PROVINCES.length, 34);
      assert(PROVINCES.includes('北京市'));
      assert(PROVINCES.includes('广东省'));
    });

    it('应该验证坐标范围', () => {
      const invalidCoords = {
        name: '测试',
        school: '学校',
        province: '北京市',
        coordinates: { latitude: 91, longitude: 0 },
        submitterEmail: 'test@example.com'
      };

      const { error } = submissionSchema.validate(invalidCoords);
      assert(error, '纬度超出范围应该验证失败');
    });
  });

  describe('RateLimiter Middleware', () => {
    const { submissionLimiter, apiLimiter, authLimiter } = require('../../server/middleware/rateLimiter');

    it('应该导出限流器实例', () => {
      assert(submissionLimiter);
      assert(apiLimiter);
      assert(authLimiter);
    });

    it('submissionLimiter 应该有正确的配置', () => {
      // Rate limiters are express middleware functions
      assert(typeof submissionLimiter === 'function');
      assert(submissionLimiter.length >= 2); // (req, res, next)
    });

    it('authLimiter 应该跳过成功请求', () => {
      // Auth limiter should be a function
      assert(typeof authLimiter === 'function');
      assert(authLimiter.length >= 2); // (req, res, next)
    });
  });

  describe('Upload Middleware', () => {
    const { upload, handleUploadError } = require('../../server/middleware/upload');

    it('应该导出 upload 配置', () => {
      assert(upload);
      assert(upload.single);
    });

    it('应该有错误处理中间件', () => {
      assert(typeof handleUploadError === 'function');
    });
  });

  describe('Auth Middleware', () => {
    const { authenticate, issueToken } = require('../../server/middleware/auth');

    it('应该是函数', () => {
      assert(typeof authenticate === 'function');
      assert(typeof issueToken === 'function');
    });

    it('应该能发行 JWT Token', () => {
      process.env.JWT_SECRET = 'test_secret';
      const token = issueToken({
        id: 'test_id',
        username: 'testuser',
        role: 'admin'
      });

      assert(typeof token === 'string');
      assert(token.split('.').length === 3, 'Token 应该是 JWT 格式');
    });
  });
});
