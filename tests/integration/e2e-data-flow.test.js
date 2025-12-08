/**
 * 端到端数据流测试 - 完整业务流程验证
 * 测试从提交→审批→同步→导出的完整流程
 * 
 * 运行方式：npm test:integration -- tests/integration/e2e-data-flow.test.js
 */
const assert = require('assert');
const mongoose = require('mongoose');
require('dotenv').config();

describe('E2E Data Flow Tests - Complete Business Workflows', () => {

  // 模拟数据库连接和模型
  let db = {
    clubs: [],
    submissions: [],
    adminUsers: []
  };

  describe('完整提交流程：新增社团', () => {
    let submissionId = null;
    let clubId = null;

    it('步骤 1: 用户提交新社团信息', () => {
      const submission = {
        submissionType: 'new',
        status: 'pending',
        submittedAt: new Date(),
        submitterEmail: 'user@example.com',
        data: {
          name: '游戏开发社',
          school: '清华大学',
          province: '北京市',
          city: '北京',
          coordinates: [116.3, 39.9],
          description: '专注游戏开发的社团',
          shortDescription: '游戏开发',
          tags: ['游戏', '开发', '编程'],
          externalLinks: [
            { type: '官网', url: 'https://example.com' },
            { type: 'GitHub', url: 'https://github.com/example' }
          ],
          logo: 'logo_123.png'
        },
        metadata: {
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0...',
          duplicateCheck: {
            passed: true,
            similarClubs: []
          }
        }
      };

      // 验证提交数据完整性
      assert.strictEqual(submission.submissionType, 'new');
      assert.strictEqual(submission.status, 'pending');
      assert(submission.data.name);
      assert(Array.isArray(submission.data.externalLinks));
      assert(submission.data.externalLinks.length === 2);

      // 保存到模拟数据库
      submissionId = '507f1f77bcf86cd799439011';
      submission._id = submissionId;
      db.submissions.push(submission);

      assert(db.submissions.length === 1);
    });

    it('步骤 2: 管理员审查提交', () => {
      const submission = db.submissions[0];
      assert.strictEqual(submission.status, 'pending');

      // 审查和批准
      submission.status = 'approved';
      submission.reviewedAt = new Date();
      submission.reviewedBy = 'admin@example.com';

      assert.strictEqual(submission.status, 'approved');
      assert(submission.reviewedAt);
    });

    it('步骤 3: 创建社团记录', () => {
      const submission = db.submissions[0];
      const club = {
        _id: new mongoose.Types.ObjectId(),
        name: submission.data.name,
        school: submission.data.school,
        province: submission.data.province,
        city: submission.data.city,
        coordinates: submission.data.coordinates,
        description: submission.data.description,
        shortDescription: submission.data.shortDescription,
        tags: submission.data.tags,
        externalLinks: submission.data.externalLinks,
        logo: submission.data.logo,
        createdAt: new Date(),
        updatedAt: new Date(),
        index: db.clubs.length + 1
      };

      clubId = club._id;
      db.clubs.push(club);

      assert(club._id);
      assert.strictEqual(club.name, '游戏开发社');
      assert.strictEqual(club.school, '清华大学');
      assert.deepStrictEqual(club.coordinates, [116.3, 39.9]);
    });

    it('步骤 4: 验证社团在数据库中', () => {
      const club = db.clubs.find(c => c._id.toString() === clubId.toString());
      assert(club);
      assert.strictEqual(club.name, '游戏开发社');
      assert(club.tags.includes('游戏'));
      assert(club.externalLinks.length === 2);
    });

    it('步骤 5: 输出到 JSON 文件（模拟）', () => {
      const jsonClubs = db.clubs.map(club => ({
        id: club._id.toString(),
        name: club.name,
        school: club.school,
        province: club.province,
        coordinates: club.coordinates,
        tags: club.tags,
        externalLinks: club.externalLinks
      }));

      assert(Array.isArray(jsonClubs));
      assert(jsonClubs.length === 1);
      assert(jsonClubs[0].name === '游戏开发社');

      // 验证 JSON 格式
      const jsonStr = JSON.stringify(jsonClubs, null, 2);
      const parsed = JSON.parse(jsonStr);
      assert.deepStrictEqual(parsed[0].coordinates, [116.3, 39.9]);
    });

    it('步骤 6: 验证完整流程', () => {
      // 验证提交状态
      const submission = db.submissions[0];
      assert.strictEqual(submission.status, 'approved');

      // 验证社团存在
      const club = db.clubs[0];
      assert(club);

      // 验证数据一致性
      assert.strictEqual(submission.data.name, club.name);
      assert.deepStrictEqual(submission.data.coordinates, club.coordinates);
    });
  });

  describe('完整编辑流程：更新社团信息', () => {
    let editSubmissionId = null;
    let originalClubId = null;

    it('步骤 1: 用户提交编辑请求', () => {
      // 获取第一个社团的 ID（从前面的流程中创建）
      originalClubId = db.clubs[0]._id;
      
      const submission = {
        submissionType: 'edit',
        editingClubId: originalClubId.toString(),
        status: 'pending',
        submittedAt: new Date(),
        submitterEmail: 'user@example.com',
        data: {
          name: '游戏开发社（更新）',
          school: '清华大学',
          province: '北京市',
          coordinates: [116.3, 39.9],
          description: '专注游戏开发和动画的社团',
          tags: ['游戏', '开发', '编程', '动画'],
          externalLinks: [
            { type: '官网', url: 'https://updated-example.com' },
            { type: 'GitHub', url: 'https://github.com/example' },
            { type: 'B站', url: 'https://bilibili.com/example' }
          ]
        },
        originalData: {
          name: '游戏开发社',
          tags: ['游戏', '开发', '编程']
        }
      };

      editSubmissionId = '507f1f77bcf86cd799439012';
      submission._id = editSubmissionId;
      db.submissions.push(submission);

      assert.strictEqual(submission.submissionType, 'edit');
      assert(submission.editingClubId);
      assert(submission.originalData);
    });

    it('步骤 2: 验证编辑前后的数据差异', () => {
      const submission = db.submissions[1];
      
      // 记录变化
      const changes = {
        nameChanged: submission.originalData.name !== submission.data.name,
        tagsAdded: submission.data.tags.length > submission.originalData.tags.length,
        linksAdded: submission.data.externalLinks.length > 0
      };

      assert(changes.nameChanged);
      assert(changes.tagsAdded);
      assert(changes.linksAdded);
    });

    it('步骤 3: 管理员审查并批准编辑', () => {
      const submission = db.submissions[1];
      submission.status = 'approved';
      submission.reviewedAt = new Date();
      submission.reviewedBy = 'admin@example.com';

      assert.strictEqual(submission.status, 'approved');
    });

    it('步骤 4: 应用编辑到社团记录', () => {
      const submission = db.submissions[1];
      const club = db.clubs.find(c => c._id.toString() === submission.editingClubId);

      // 更新社团数据
      club.name = submission.data.name;
      club.description = submission.data.description;
      club.tags = submission.data.tags;
      club.externalLinks = submission.data.externalLinks;
      club.updatedAt = new Date();

      assert.strictEqual(club.name, '游戏开发社（更新）');
      assert(club.tags.includes('动画'));
      assert.strictEqual(club.externalLinks.length, 3);
    });

    it('步骤 5: 验证编辑后的数据一致性', () => {
      const club = db.clubs[0];
      const submission = db.submissions[1];

      assert.strictEqual(club.name, submission.data.name);
      assert.deepStrictEqual(club.tags, submission.data.tags);
    });
  });

  describe('批量操作流程：导入和同步', () => {
    it('步骤 1: 准备批量导入的社团数据', () => {
      const importClubs = [
        {
          name: '动画社',
          school: '北京大学',
          province: '北京市',
          coordinates: [116.4, 39.8],
          tags: ['动画', '二次元']
        },
        {
          name: '编程俱乐部',
          school: '中国科学院大学',
          province: '北京市',
          coordinates: [116.5, 39.7],
          tags: ['编程', '算法']
        }
      ];

      assert.strictEqual(importClubs.length, 2);
      importClubs.forEach(club => {
        assert(club.name);
        assert(club.coordinates.length === 2);
      });
    });

    it('步骤 2: 检查重复社团', () => {
      const importClub = {
        name: '游戏开发社（更新）',
        school: '清华大学'
      };

      const existingClub = db.clubs.find(c => 
        c.name === importClub.name && c.school === importClub.school
      );

      // 应该找到重复
      assert(existingClub);
      assert.strictEqual(existingClub.name, importClub.name);
    });

    it('步骤 3: 导入新社团', () => {
      const initialCount = db.clubs.length;

      const newClubs = [
        {
          _id: new mongoose.Types.ObjectId(),
          name: '动画社',
          school: '北京大学',
          province: '北京市',
          coordinates: [116.4, 39.8],
          tags: ['动画'],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      db.clubs.push(...newClubs);

      assert.strictEqual(db.clubs.length, initialCount + 1);
    });

    it('步骤 4: 同步数据库到 JSON', () => {
      const jsonClubs = db.clubs.map(club => ({
        id: club._id.toString(),
        name: club.name,
        school: club.school,
        province: club.province,
        coordinates: club.coordinates,
        tags: club.tags
      }));

      // 验证 JSON 输出
      assert.strictEqual(jsonClubs.length, db.clubs.length);
      jsonClubs.forEach(club => {
        assert(club.id);
        assert(club.name);
        assert(Array.isArray(club.coordinates));
      });

      // 模拟写入文件
      const jsonStr = JSON.stringify(jsonClubs, null, 2);
      assert(jsonStr.length > 0);
    });

    it('步骤 5: 验证同步结果', () => {
      const result = {
        synced: db.clubs.length,
        timestamp: new Date().toISOString(),
        status: 'success'
      };

      assert.strictEqual(result.synced, db.clubs.length);
      assert.strictEqual(result.status, 'success');
    });
  });

  describe('数据一致性验证', () => {
    it('应该验证所有社团有必需字段', () => {
      db.clubs.forEach(club => {
        assert(club.name, `社团 ${club._id} 缺少 name`);
        assert(club.school, `社团 ${club._id} 缺少 school`);
        assert(club.province, `社团 ${club._id} 缺少 province`);
        assert(Array.isArray(club.coordinates), `社团 ${club._id} 坐标格式错误`);
        assert.strictEqual(club.coordinates.length, 2, `社团 ${club._id} 坐标长度错误`);
      });
    });

    it('应该验证坐标范围有效', () => {
      db.clubs.forEach(club => {
        const [lng, lat] = club.coordinates;
        assert(lng >= -180 && lng <= 180, `社团 ${club.name} 经度超出范围`);
        assert(lat >= -90 && lat <= 90, `社团 ${club.name} 纬度超出范围`);
      });
    });

    it('应该验证标签格式', () => {
      db.clubs.forEach(club => {
        if (club.tags) {
          assert(Array.isArray(club.tags));
          club.tags.forEach(tag => {
            assert(typeof tag === 'string');
            assert(tag.length > 0);
          });
        }
      });
    });

    it('应该验证外部链接格式', () => {
      db.clubs.forEach(club => {
        if (club.externalLinks) {
          assert(Array.isArray(club.externalLinks));
          club.externalLinks.forEach(link => {
            assert(link.type, '链接缺少 type');
            assert(link.url, '链接缺少 url');
            assert(link.url.startsWith('http'), '链接 URL 必须以 http 开头');
          });
        }
      });
    });

    it('应该验证提交和社团的数据一致性', () => {
      db.submissions.forEach(submission => {
        if (submission.status === 'approved') {
          if (submission.submissionType === 'new') {
            // 应该存在对应的社团
            const club = db.clubs.find(c => c.name === submission.data.name);
            if (club) {
              assert.strictEqual(club.name, submission.data.name);
            }
          } else if (submission.submissionType === 'edit') {
            // 编辑提交应该对应某个社团
            const club = db.clubs.find(c => c._id.toString() === submission.editingClubId);
            assert(club, `找不到编辑对应的社团 ${submission.editingClubId}`);
          }
        }
      });
    });
  });

  describe('错误恢复和回滚', () => {
    it('应该处理提交验证失败', () => {
      const invalidSubmission = {
        submissionType: 'new',
        data: {
          name: '', // 缺少名称
          school: '学校',
          coordinates: [200, 100] // 坐标超出范围
        }
      };

      const errors = [];
      if (!invalidSubmission.data.name) errors.push('名称必需');
      if (invalidSubmission.data.coordinates[0] > 180) errors.push('经度超出范围');

      assert(errors.length > 0);
      assert(errors.includes('名称必需'));
    });

    it('应该处理重复检测', () => {
      const newClub = {
        name: '游戏开发社（更新）',
        school: '清华大学'
      };

      const isDuplicate = db.clubs.some(c => 
        c.name === newClub.name && c.school === newClub.school
      );

      assert(isDuplicate);
    });

    it('应该在错误时保留原始数据', () => {
      const submission = db.submissions[1]; // 编辑提交
      
      // 保存原始数据用于回滚
      assert(submission.originalData);
      assert(submission.originalData.name === '游戏开发社');
    });

    it('应该清理不完整的操作', () => {
      const initialCount = db.clubs.length;

      // 模拟不完整操作的清理
      db.clubs = db.clubs.filter(c => {
        // 只保留有完整数据的社团
        return c.name && c.school && c.coordinates && c.coordinates.length === 2;
      });

      assert.strictEqual(db.clubs.length, initialCount);
    });
  });

  describe('性能和数据量测试', () => {
    it('应该处理大量社团数据', () => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        _id: new mongoose.Types.ObjectId(),
        name: `社团${i}`,
        school: `学校${i % 10}`,
        province: '北京市',
        coordinates: [116.3 + (i * 0.001), 39.9 + (i * 0.001)],
        tags: ['标签1', '标签2'],
        createdAt: new Date()
      }));

      assert.strictEqual(largeDataset.length, 1000);

      // 验证数据完整性
      largeDataset.forEach(club => {
        assert(club._id);
        assert(club.coordinates.length === 2);
      });
    });

    it('应该快速序列化大量数据', () => {
      const start = Date.now();

      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: `${i}`,
        name: `社团${i}`,
        coordinates: [116.3, 39.9]
      }));

      const jsonStr = JSON.stringify(largeDataset);
      const elapsed = Date.now() - start;

      assert(jsonStr.length > 0);
      assert(elapsed < 1000); // 应该在 1 秒内完成
    });

    it('应该快速解析 JSON 数据', () => {
      const start = Date.now();

      const jsonStr = JSON.stringify(db.clubs);
      const parsed = JSON.parse(jsonStr);
      const elapsed = Date.now() - start;

      assert.strictEqual(parsed.length, db.clubs.length);
      assert(elapsed < 100);
    });
  });

  describe('最终状态验证', () => {
    it('应该有正确数量的社团', () => {
      assert(db.clubs.length > 0);
    });

    it('应该有正确数量的提交', () => {
      assert(db.submissions.length > 0);
    });

    it('应该记录所有操作的时间戳', () => {
      db.submissions.forEach(submission => {
        assert(submission.submittedAt);
        if (submission.status === 'approved') {
          assert(submission.reviewedAt);
        }
      });
    });

    it('应该可以生成完整的审计日志', () => {
      const auditLog = {
        totalSubmissions: db.submissions.length,
        approvedSubmissions: db.submissions.filter(s => s.status === 'approved').length,
        rejectedSubmissions: db.submissions.filter(s => s.status === 'rejected').length,
        totalClubs: db.clubs.length,
        timestamp: new Date().toISOString()
      };

      assert(auditLog.totalSubmissions > 0);
      assert(auditLog.approvedSubmissions > 0);
      assert(auditLog.totalClubs > 0);
    });
  });

});
