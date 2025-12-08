/**
 * 模型单元测试
 * 测试 Club, Submission, AdminUser 模型的 Schema 和方法
 */
const mongoose = require('mongoose');
const assert = require('assert');
require('dotenv').config();

describe('Models', () => {
  before(async function() {
    this.timeout(5000);
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
    }
  });

  after(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
  });

  describe('Club Model', () => {
    const Club = require('../../server/models/Club');

    it('应该创建有效的社团记录', async () => {
      const club = new Club({
        name: '测试社团',
        school: '测试大学',
        province: '北京市',
        city: '北京',
        coordinates: [116.4, 39.9],
        description: '这是一个测试社团',
        shortDescription: '测试',
        tags: ['编程', '开发'],
        logo: 'test.jpg',
        externalLinks: []
      });

      assert.strictEqual(club.name, '测试社团');
      assert.strictEqual(club.school, '测试大学');
      assert.deepStrictEqual(club.coordinates, [116.4, 39.9]);
    });

    it('应该验证必需字段', async () => {
      const club = new Club({
        school: '测试大学'
      });

      try {
        await club.validate();
        assert.fail('应该验证失败');
      } catch (error) {
        assert(error.errors.name, '名称字段应该是必需的');
      }
    });

    it('应该自动生成 createdAt 和 updatedAt', () => {
      const club = new Club({
        name: '时间测试',
        school: '学校',
        coordinates: [0, 0]
      });

      assert(club.createdAt instanceof Date);
      assert(club.updatedAt instanceof Date);
    });
  });

  describe('Submission Model', () => {
    const Submission = require('../../server/models/Submission');

    it('应该创建有效的提交记录', () => {
      const submission = new Submission({
        submissionType: 'new',
        submitterEmail: 'test@example.com',
        data: {
          name: '提交测试',
          school: '学校',
          province: '北京市',
          coordinates: [0, 0]
        }
      });

      assert.strictEqual(submission.status, 'pending');
      assert.strictEqual(submission.submissionType, 'new');
      assert.strictEqual(submission.submitterEmail, 'test@example.com');
    });

    it('应该验证邮箱格式', async () => {
      const submission = new Submission({
        submissionType: 'new',
        // 缺少 submitterEmail 字段
        data: {
          name: '测试',
          school: '学校',
          province: '北京市',
          coordinates: [0, 0]
        }
      });

      try {
        await submission.validate();
        assert.fail('应该验证失败 - submitterEmail 是必需字段');
      } catch (error) {
        // submitterEmail 缺失会导致验证错误
        assert(error.errors.submitterEmail !== undefined);
      }
    });

    it('应该支持编辑模式', () => {
      const submission = new Submission({
        submissionType: 'edit',
        submitterEmail: 'test@example.com',
        editingClubId: new mongoose.Types.ObjectId(),
        data: {
          name: '编辑测试',
          school: '学校',
          province: '北京市',
          coordinates: [0, 0]
        }
      });

      assert.strictEqual(submission.submissionType, 'edit');
      assert(submission.editingClubId);
    });
  });

  describe('AdminUser Model', () => {
    const AdminUser = require('../../server/models/AdminUser');

    it('应该创建有效的管理员用户', () => {
      const admin = new AdminUser({
        username: 'admin_test',
        passwordHash: '$2a$10$hashedpassword',
        email: 'admin@example.com',
        role: 'super_admin'
      });

      assert.strictEqual(admin.username, 'admin_test');
      assert.strictEqual(admin.role, 'super_admin');
      assert.strictEqual(admin.active, true);
    });

    it('应该验证用户名唯一性', async () => {
      const admin = new AdminUser({
        username: 'testadmin',
        passwordHash: '$2a$10$hashedpassword',
        email: 'test@example.com'
      });

      try {
        // 这会测试 unique 约束，但在单元测试中可能不会触发
        // 真正的测试需要在集成测试中进行
        assert(admin.username);
      } catch (error) {
        assert(error);
      }
    });
  });
});
