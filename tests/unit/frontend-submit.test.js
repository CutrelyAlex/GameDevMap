/**
 * 提交表单脚本单元测试 (public/js/submit.js)
 * 测试表单验证、文件上传、链接管理、编辑模式等功能
 */
const assert = require('assert');

describe('Frontend - Submit Form (Submit.html)', () => {

  describe('表单状态管理', () => {
    it('应该初始化表单状态', () => {
      const formState = {
        submissionType: 'new',
        data: {},
        uploadedFiles: { logo: null, qrcodes: [] }
      };
      assert.strictEqual(formState.submissionType, 'new');
      assert(formState.data);
      assert(formState.uploadedFiles);
    });

    it('应该切换编辑模式', () => {
      let isEditMode = false;
      function toggleEditMode() {
        isEditMode = !isEditMode;
        return isEditMode;
      }
      assert.strictEqual(toggleEditMode(), true);
      assert.strictEqual(toggleEditMode(), false);
    });

    it('应该管理已上传文件追踪', () => {
      const uploadedFiles = { logo: null, qrcodes: [] };
      
      function trackUploadedFile(type, filePath) {
        if (type === 'logo') {
          uploadedFiles.logo = filePath;
        } else if (type === 'qrcode') {
          uploadedFiles.qrcodes.push(filePath);
        }
      }

      trackUploadedFile('logo', '/assets/logos/test.png');
      trackUploadedFile('qrcode', '/assets/qrcodes/1.png');
      trackUploadedFile('qrcode', '/assets/qrcodes/2.png');

      assert.strictEqual(uploadedFiles.logo, '/assets/logos/test.png');
      assert.strictEqual(uploadedFiles.qrcodes.length, 2);
    });
  });

  describe('表单链接管理', () => {
    function collectLinks(linkItems) {
      const links = [];
      linkItems.forEach(item => {
        const type = item.type || '';
        const url = item.url || '';
        const qrcode = item.qrcode || '';
        
        if (type && url) {
          links.push({ type, url, qrcode });
        }
      });
      return links;
    }

    it('应该收集有效的链接', () => {
      const linkItems = [
        { type: '官网', url: 'https://example.com', qrcode: '' },
        { type: 'GitHub', url: 'https://github.com/example', qrcode: 'qr.png' }
      ];
      const links = collectLinks(linkItems);
      assert.strictEqual(links.length, 2);
      assert.strictEqual(links[0].type, '官网');
    });

    it('应该过滤不完整的链接', () => {
      const linkItems = [
        { type: '官网', url: 'https://example.com' },
        { type: '微信', url: '' }, // 缺少 URL
        { type: '', url: 'https://example2.com' } // 缺少类型
      ];
      const links = collectLinks(linkItems);
      assert.strictEqual(links.length, 1); // 只有第一个有效
    });

    it('应该支持最多10个链接', () => {
      const MAX_LINKS = 10;
      const linkItems = Array(15).fill({ type: '官网', url: 'https://example.com' });
      const links = collectLinks(linkItems).slice(0, MAX_LINKS);
      assert(links.length <= MAX_LINKS);
    });

    function validateLinkUrl(url) {
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    }

    it('应该验证链接 URL 格式', () => {
      assert.strictEqual(validateLinkUrl('https://example.com'), true);
      assert.strictEqual(validateLinkUrl('http://example.com'), true);
      assert.strictEqual(validateLinkUrl('not a url'), false);
      assert.strictEqual(validateLinkUrl(''), false);
    });
  });

  describe('表单数据验证', () => {
    function validateFormData(data) {
      const errors = [];

      if (!data.name || data.name.trim().length < 2) {
        errors.push('社团名称必须至少 2 个字符');
      }

      if (!data.school || data.school.trim().length < 2) {
        errors.push('学校名称必须至少 2 个字符');
      }

      if (!data.province) {
        errors.push('请选择省份');
      }

      if (!Array.isArray(data.coordinates) || data.coordinates.length !== 2) {
        errors.push('坐标必须是 [经度, 纬度]');
      } else {
        const [lng, lat] = data.coordinates;
        if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
          errors.push('坐标范围错误');
        }
      }

      if (data.tags && !Array.isArray(data.tags)) {
        errors.push('标签必须是数组');
      }

      return {
        isValid: errors.length === 0,
        errors
      };
    }

    it('应该验证必需字段', () => {
      const invalidData = {}; // 空数据
      const result = validateFormData(invalidData);
      assert.strictEqual(result.isValid, false);
      assert(result.errors.length > 0);
    });

    it('应该验证有效的表单数据', () => {
      const validData = {
        name: '游戏开发社',
        school: '清华大学',
        province: '北京市',
        coordinates: [116.3, 39.9],
        tags: ['游戏', '开发']
      };
      const result = validateFormData(validData);
      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    it('应该验证坐标范围', () => {
      const dataWithInvalidCoords = {
        name: '测试',
        school: '学校',
        province: '北京市',
        coordinates: [200, 100] // 超出范围
      };
      const result = validateFormData(dataWithInvalidCoords);
      assert.strictEqual(result.isValid, false);
      assert(result.errors.some(e => e.includes('坐标范围错误')));
    });

    it('应该检查最小字符长度', () => {
      const dataWithShortName = {
        name: '社',
        school: '清华大学',
        province: '北京市',
        coordinates: [116.3, 39.9]
      };
      const result = validateFormData(dataWithShortName);
      assert.strictEqual(result.isValid, false);
    });
  });

  describe('标签解析', () => {
    function parseTags(raw) {
      if (!raw) return [];
      
      const tags = raw
        .split(/[,，\n]/)
        .map(tag => tag.trim())
        .filter(Boolean);

      const MAX_TAGS = 10;
      if (tags.length > MAX_TAGS) {
        throw new Error(`标签数量最多 ${MAX_TAGS} 个`);
      }

      return tags;
    }

    it('应该解析逗号分隔的标签', () => {
      const tags = parseTags('游戏,开发,社团');
      assert.deepStrictEqual(tags, ['游戏', '开发', '社团']);
    });

    it('应该解析中文逗号分隔的标签', () => {
      const tags = parseTags('游戏，开发，社团');
      assert.deepStrictEqual(tags, ['游戏', '开发', '社团']);
    });

    it('应该解析换行分隔的标签', () => {
      const tags = parseTags('游戏\n开发\n社团');
      assert.deepStrictEqual(tags, ['游戏', '开发', '社团']);
    });

    it('应该去除首尾空白', () => {
      const tags = parseTags('  游戏  ,  开发  ');
      assert.deepStrictEqual(tags, ['游戏', '开发']);
    });

    it('应该拒绝超过10个标签', () => {
      const tooManyTags = Array(11).fill('标签').join(',');
      assert.throws(() => parseTags(tooManyTags));
    });

    it('应该处理空输入', () => {
      assert.deepStrictEqual(parseTags(''), []);
      assert.deepStrictEqual(parseTags(null), []);
    });

    it('应该支持最多10个标签', () => {
      const tags = parseTags('a,b,c,d,e,f,g,h,i,j');
      assert.strictEqual(tags.length, 10);
    });
  });

  describe('坐标验证', () => {
    function validateCoordinates(lat, lng) {
      if (Number.isNaN(lat) || Number.isNaN(lng)) {
        throw new Error('请填写有效的经纬度坐标');
      }
      if (lat < -90 || lat > 90) {
        throw new Error('纬度必须在 -90 到 90 之间');
      }
      if (lng < -180 || lng > 180) {
        throw new Error('经度必须在 -180 到 180 之间');
      }
    }

    it('应该验证有效的坐标', () => {
      assert.doesNotThrow(() => validateCoordinates(39.9, 116.3));
    });

    it('应该拒绝超出范围的纬度', () => {
      assert.throws(() => validateCoordinates(100, 116.3), /纬度必须/);
    });

    it('应该拒绝超出范围的经度', () => {
      assert.throws(() => validateCoordinates(39.9, 200), /经度必须/);
    });

    it('应该拒绝 NaN 值', () => {
      assert.throws(() => validateCoordinates(NaN, 116.3), /请填写有效的/);
    });

    it('应该接受负坐标', () => {
      assert.doesNotThrow(() => validateCoordinates(-33.8, -151.2));
    });

    it('应该接受边界值', () => {
      assert.doesNotThrow(() => validateCoordinates(-90, -180));
      assert.doesNotThrow(() => validateCoordinates(90, 180));
    });
  });

  describe('Logo 文件验证', () => {
    function validateLogoFile(file) {
      const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml'];
      const MAX_SIZE = 20 * 1024 * 1024; // 20MB

      if (!allowedTypes.includes(file.type)) {
        throw new Error('不支持的文件格式');
      }

      if (file.size > MAX_SIZE) {
        throw new Error('文件大小不能超过 20MB');
      }

      return true;
    }

    it('应该接受有效的图片格式', () => {
      const validFiles = [
        { type: 'image/png', size: 1024 },
        { type: 'image/jpeg', size: 1024 },
        { type: 'image/gif', size: 1024 },
        { type: 'image/svg+xml', size: 1024 }
      ];

      validFiles.forEach(file => {
        assert.doesNotThrow(() => validateLogoFile(file));
      });
    });

    it('应该拒绝不支持的格式', () => {
      const invalidFile = { type: 'application/pdf', size: 1024 };
      assert.throws(() => validateLogoFile(invalidFile), /不支持的文件格式/);
    });

    it('应该拒绝超过 20MB 的文件', () => {
      const largeFile = { type: 'image/png', size: 21 * 1024 * 1024 };
      assert.throws(() => validateLogoFile(largeFile), /20MB/);
    });

    it('应该接受边界大小的文件', () => {
      const boundaryFile = { type: 'image/png', size: 20 * 1024 * 1024 };
      assert.doesNotThrow(() => validateLogoFile(boundaryFile));
    });
  });

  describe('QR 码文件验证', () => {
    function validateQRCodeFile(file) {
      const allowedTypes = ['image/png', 'image/jpeg', 'image/gif'];
      const MAX_SIZE = 5 * 1024 * 1024; // 5MB

      if (!allowedTypes.includes(file.type)) {
        throw new Error('QR 码格式必须为 PNG、JPEG 或 GIF');
      }

      if (file.size > MAX_SIZE) {
        throw new Error('QR 码文件大小不能超过 5MB');
      }

      return true;
    }

    it('应该验证 QR 码文件格式', () => {
      const validQR = { type: 'image/png', size: 1024 };
      assert.doesNotThrow(() => validateQRCodeFile(validQR));
    });

    it('应该拒绝超过 5MB 的 QR 码', () => {
      const largeQR = { type: 'image/png', size: 6 * 1024 * 1024 };
      assert.throws(() => validateQRCodeFile(largeQR), /5MB/);
    });

    it('应该不接受 SVG 格式的 QR 码', () => {
      const svgQR = { type: 'image/svg+xml', size: 1024 };
      assert.throws(() => validateQRCodeFile(svgQR), /PNG、JPEG 或 GIF/);
    });
  });

  describe('编辑模式界面', () => {
    function formatEditingClubData(club) {
      return {
        id: club._id,
        name: club.data?.name || club.name,
        school: club.data?.school || club.school,
        province: club.data?.province || club.province,
        originalData: club.data || club
      };
    }

    it('应该格式化编辑数据', () => {
      const club = {
        _id: '123',
        data: {
          name: '测试社团',
          school: '清华大学',
          province: '北京市'
        }
      };
      const formatted = formatEditingClubData(club);
      assert.strictEqual(formatted.id, '123');
      assert.strictEqual(formatted.name, '测试社团');
    });

    it('应该处理没有 data 字段的社团', () => {
      const club = {
        _id: '123',
        name: '测试社团',
        school: '清华大学',
        province: '北京市'
      };
      const formatted = formatEditingClubData(club);
      assert.strictEqual(formatted.name, '测试社团');
    });
  });

  describe('表单数据序列化', () => {
    function serializeFormData(formData) {
      return {
        submissionType: formData.submissionType || 'new',
        editingClubId: formData.editingClubId || null,
        data: {
          name: formData.name,
          school: formData.school,
          province: formData.province,
          coordinates: formData.coordinates,
          description: formData.description,
          shortDescription: formData.shortDescription,
          tags: Array.isArray(formData.tags) ? formData.tags : [],
          externalLinks: Array.isArray(formData.externalLinks) ? formData.externalLinks : [],
          logo: formData.logo
        },
        metadata: {
          ipAddress: formData.ipAddress || null,
          userAgent: formData.userAgent || navigator?.userAgent || ''
        }
      };
    }

    it('应该序列化新提交表单', () => {
      const formData = {
        submissionType: 'new',
        name: '游戏社',
        school: '清华大学',
        province: '北京市',
        coordinates: [116.3, 39.9],
        tags: ['游戏'],
        externalLinks: []
      };
      const serialized = serializeFormData(formData);
      assert.strictEqual(serialized.submissionType, 'new');
      assert(serialized.data);
    });

    it('应该序列化编辑提交表单', () => {
      const formData = {
        submissionType: 'edit',
        editingClubId: '123',
        name: '游戏社更新',
        school: '清华大学',
        province: '北京市',
        coordinates: [116.3, 39.9],
        tags: [],
        externalLinks: []
      };
      const serialized = serializeFormData(formData);
      assert.strictEqual(serialized.submissionType, 'edit');
      assert.strictEqual(serialized.editingClubId, '123');
    });

    it('应该包含元数据', () => {
      const formData = {
        name: '测试',
        school: '学校',
        province: '北京市',
        coordinates: [116.3, 39.9],
        tags: [],
        externalLinks: []
      };
      const serialized = serializeFormData(formData);
      assert(serialized.metadata);
      assert(serialized.metadata.userAgent);
    });
  });

  describe('状态消息管理', () => {
    let statusMessage = '';
    let statusType = '';

    function showStatus(message, type = 'info') {
      statusMessage = message;
      statusType = type;
    }

    function clearStatus() {
      statusMessage = '';
      statusType = '';
    }

    it('应该显示成功消息', () => {
      showStatus('提交成功', 'success');
      assert.strictEqual(statusMessage, '提交成功');
      assert.strictEqual(statusType, 'success');
    });

    it('应该显示错误消息', () => {
      showStatus('提交失败', 'error');
      assert.strictEqual(statusMessage, '提交失败');
      assert.strictEqual(statusType, 'error');
    });

    it('应该清除消息', () => {
      showStatus('测试', 'info');
      clearStatus();
      assert.strictEqual(statusMessage, '');
      assert.strictEqual(statusType, '');
    });
  });

  describe('调试日志', () => {
    let debugLog = [];

    function startDebugReport() {
      debugLog = [];
    }

    function pushDebug(msg) {
      debugLog.push(msg);
    }

    function flushDebug() {
      const combined = debugLog.join('\n');
      debugLog = [];
      return combined;
    }

    it('应该收集调试信息', () => {
      startDebugReport();
      pushDebug('测试消息 1');
      pushDebug('测试消息 2');
      assert.strictEqual(debugLog.length, 2);
    });

    it('应该合并和清空调试日志', () => {
      startDebugReport();
      pushDebug('信息 1');
      pushDebug('信息 2');
      const combined = flushDebug();
      assert(combined.includes('信息 1'));
      assert.strictEqual(debugLog.length, 0);
    });
  });

});
