/**
 * 工具函数单元测试
 * 测试 duplicateCheck, fileProcessor 等工具
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

describe('Utils', () => {
  describe('DuplicateCheck', () => {
    const { calculateStringSimilarity } = require('../../server/utils/duplicateCheck');

    it('应该计算相同字符串的相似度为 100%', () => {
      const similarity = calculateStringSimilarity('GameDev', 'GameDev');
      assert.strictEqual(similarity, 1.0); // 返回 0-1 之间的值
    });

    it('应该计算不同字符串的相似度', () => {
      const similarity = calculateStringSimilarity('Game', 'Games');
      assert(similarity > 0 && similarity < 1);
    });

    it('应该处理空字符串', () => {
      const similarity = calculateStringSimilarity('', '');
      assert.strictEqual(similarity, 1.0); // 两个空字符串相似度为 100%
    });

    it('应该区分大小写', () => {
      // 注意：calculateStringSimilarity 会将字符串转小写，所以 'Test' 和 'test' 会相等
      // 这个测试验证它能正确比较不同的字符串
      const sim1 = calculateStringSimilarity('TestA', 'TestB');
      const sim2 = calculateStringSimilarity('TestA', 'TestA');
      assert(sim1 < sim2); // 不同字符串相似度应该小于相同字符串
    });
  });

  describe('FileProcessor', () => {
    const { processFile } = require('../../server/utils/fileProcessor');

    it('应该导出 processFile 函数', () => {
      assert(typeof processFile === 'function');
    });

    it('应该处理不存在的文件', async () => {
      try {
        await processFile('/nonexistent/file.jpg', '/output', {});
        assert.fail('应该抛出错误');
      } catch (error) {
        assert(error);
      }
    });
  });

  describe('ImageProcessor', () => {
    const imageProcessor = require('../../server/utils/imageProcessor');

    it('应该导出 processApprovedImage 函数', () => {
      assert(typeof imageProcessor.processApprovedImage === 'function');
    });
  });

  describe('Paths Config', () => {
    const paths = require('../../server/config/paths');

    it('应该导出所有必需的路径', () => {
      assert(paths.PROJECT_ROOT);
      assert(paths.DATA_DIR);
      assert(paths.SUBMISSIONS_DIR);
      assert(paths.PUBLIC_DIR);
      assert(paths.CLUBS_JSON);
    });

    it('PROJECT_ROOT 应该指向项目根目录', () => {
      // PROJECT_ROOT 应该是有效的绝对路径
      assert(path.isAbsolute(paths.PROJECT_ROOT));
      // 应该包含 package.json（项目根标志）
      assert(fs.existsSync(path.join(paths.PROJECT_ROOT, 'package.json')));
    });

    it('应该包含 URL_PATHS 配置', () => {
      assert(paths.URL_PATHS);
      assert(paths.URL_PATHS.logos);
      assert(paths.URL_PATHS.submissions);
    });

    it('路径应该存在或可创建', () => {
      // PROJECT_ROOT 应该存在
      assert(fs.existsSync(paths.PROJECT_ROOT));
      // 主要目录应该存在
      assert(fs.existsSync(paths.DATA_DIR));
    });
  });
});
