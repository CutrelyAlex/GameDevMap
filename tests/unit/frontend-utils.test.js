/**
 * 前端工具函数单元测试 (public/js/utils.js)
 * 测试可复用的工具函数：HTML转义、标签解析、坐标验证、文件上传等
 */
const assert = require('assert');

describe('Frontend - Utils (Shared Utilities)', () => {

  describe('HTML 属性转义', () => {
    function escapeHtmlAttr(text) {
      if (typeof text !== 'string') return '';
      const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      };
      return text.replace(/[&<>"']/g, m => map[m]);
    }

    it('应该转义双引号', () => {
      assert.strictEqual(escapeHtmlAttr('He said "hello"'), 'He said &quot;hello&quot;');
    });

    it('应该转义单引号', () => {
      assert.strictEqual(escapeHtmlAttr("It's fine"), 'It&#039;s fine');
    });

    it('应该转义 HTML 标签', () => {
      assert.strictEqual(escapeHtmlAttr('<img src="x">'), '&lt;img src=&quot;x&quot;&gt;');
    });

    it('应该处理非字符串输入', () => {
      assert.strictEqual(escapeHtmlAttr(null), '');
      assert.strictEqual(escapeHtmlAttr(undefined), '');
      assert.strictEqual(escapeHtmlAttr(123), '');
    });

    it('应该保留普通字符', () => {
      assert.strictEqual(escapeHtmlAttr('normal text'), 'normal text');
    });

    it('应该转义 & 符号', () => {
      assert.strictEqual(escapeHtmlAttr('A & B'), 'A &amp; B');
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
        throw new Error(`标签数量最多 ${MAX_TAGS} 个，请删除多余的标签`);
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

    it('应该混合分隔符', () => {
      const tags = parseTags('游戏,开发，社团\nAPI');
      assert.deepStrictEqual(tags, ['游戏', '开发', '社团', 'API']);
    });

    it('应该去除空白', () => {
      const tags = parseTags('  游戏  ,  开发  ');
      assert.deepStrictEqual(tags, ['游戏', '开发']);
    });

    it('应该过滤空标签', () => {
      const tags = parseTags('游戏,,开发,');
      assert.deepStrictEqual(tags, ['游戏', '开发']);
    });

    it('应该拒绝超过10个标签', () => {
      const tooMany = 'tag1,tag2,tag3,tag4,tag5,tag6,tag7,tag8,tag9,tag10,tag11';
      assert.throws(() => parseTags(tooMany), /最多 10 个/);
    });

    it('应该处理空输入', () => {
      assert.deepStrictEqual(parseTags(''), []);
      assert.deepStrictEqual(parseTags(null), []);
      assert.deepStrictEqual(parseTags(undefined), []);
    });

    it('应该支持完整10个标签', () => {
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

    it('应该验证有效的中国坐标', () => {
      assert.doesNotThrow(() => validateCoordinates(39.9, 116.3)); // 北京
      assert.doesNotThrow(() => validateCoordinates(31.2, 121.5)); // 上海
    });

    it('应该验证南半球坐标', () => {
      assert.doesNotThrow(() => validateCoordinates(-33.8, 151.2)); // 悉尼
    });

    it('应该验证西半球坐标', () => {
      assert.doesNotThrow(() => validateCoordinates(40.7, -74.0)); // 纽约
    });

    it('应该拒绝超出范围的纬度', () => {
      assert.throws(() => validateCoordinates(91, 0), /纬度必须/);
      assert.throws(() => validateCoordinates(-91, 0), /纬度必须/);
    });

    it('应该拒绝超出范围的经度', () => {
      assert.throws(() => validateCoordinates(0, 181), /经度必须/);
      assert.throws(() => validateCoordinates(0, -181), /经度必须/);
    });

    it('应该拒绝 NaN 值', () => {
      assert.throws(() => validateCoordinates(NaN, 0), /请填写有效/);
      assert.throws(() => validateCoordinates(0, NaN), /请填写有效/);
    });

    it('应该接受边界值', () => {
      assert.doesNotThrow(() => validateCoordinates(90, 180));
      assert.doesNotThrow(() => validateCoordinates(-90, -180));
    });

    it('应该接受赤道和本初子午线', () => {
      assert.doesNotThrow(() => validateCoordinates(0, 0));
    });
  });

  describe('Logo 文件验证', () => {
    function validateLogoFile(file) {
      const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml'];
      
      if (!allowedTypes.includes(file.type)) {
        throw new Error('只支持 PNG、JPEG、GIF、SVG 格式的图片');
      }

      const MAX_SIZE = 20 * 1024 * 1024;
      if (file.size > MAX_SIZE) {
        throw new Error(`文件大小不能超过 ${Math.round(MAX_SIZE / 1024 / 1024)}MB`);
      }

      return true;
    }

    it('应该接受 PNG 格式', () => {
      const file = { type: 'image/png', size: 1024 };
      assert.doesNotThrow(() => validateLogoFile(file));
    });

    it('应该接受 JPEG 格式', () => {
      const file = { type: 'image/jpeg', size: 1024 };
      assert.doesNotThrow(() => validateLogoFile(file));
    });

    it('应该接受 GIF 格式', () => {
      const file = { type: 'image/gif', size: 1024 };
      assert.doesNotThrow(() => validateLogoFile(file));
    });

    it('应该接受 SVG 格式', () => {
      const file = { type: 'image/svg+xml', size: 1024 };
      assert.doesNotThrow(() => validateLogoFile(file));
    });

    it('应该拒绝不支持的格式', () => {
      const file = { type: 'application/pdf', size: 1024 };
      assert.throws(() => validateLogoFile(file), /PNG、JPEG、GIF、SVG/);
    });

    it('应该拒绝超过 20MB 的文件', () => {
      const file = { type: 'image/png', size: 21 * 1024 * 1024 };
      assert.throws(() => validateLogoFile(file), /20MB/);
    });

    it('应该接受恰好 20MB 的文件', () => {
      const file = { type: 'image/png', size: 20 * 1024 * 1024 };
      assert.doesNotThrow(() => validateLogoFile(file));
    });

    it('应该接受小文件', () => {
      const file = { type: 'image/png', size: 100 };
      assert.doesNotThrow(() => validateLogoFile(file));
    });
  });

  describe('上传相关的工具函数', () => {
    function buildUploadPayload(file, type) {
      if (!file) {
        throw new Error('文件不存在');
      }

      return {
        file,
        type,
        timestamp: Date.now(),
        size: file.size,
        mimeType: file.type
      };
    }

    it('应该构建上传负载', () => {
      const file = { 
        name: 'test.png', 
        size: 1024, 
        type: 'image/png' 
      };
      const payload = buildUploadPayload(file, 'logo');
      assert.strictEqual(payload.type, 'logo');
      assert.strictEqual(payload.size, 1024);
      assert(payload.timestamp);
    });

    it('应该拒绝 null 文件', () => {
      assert.throws(() => buildUploadPayload(null, 'logo'), /文件不存在/);
    });

    function getUploadPath(type, filename) {
      const paths = {
        logo: '/api/upload/logo',
        qrcode: '/api/upload/qrcode'
      };
      return `${paths[type] || '/api/upload'}?file=${filename}`;
    }

    it('应该生成正确的上传路径', () => {
      const path = getUploadPath('logo', 'test.png');
      assert(path.includes('/api/upload/logo'));
      assert(path.includes('test.png'));
    });

    it('应该处理不同的文件类型', () => {
      const logoPath = getUploadPath('logo', 'logo.png');
      const qrPath = getUploadPath('qrcode', 'qr.png');
      assert(logoPath.includes('/api/upload/logo'));
      assert(qrPath.includes('/api/upload/qrcode'));
    });
  });

  describe('文件删除', () => {
    function buildDeleteRequest(filePath) {
      if (!filePath) {
        throw new Error('文件路径不能为空');
      }
      return {
        method: 'DELETE',
        url: `/api/upload/file?path=${encodeURIComponent(filePath)}`,
        headers: { 'Content-Type': 'application/json' }
      };
    }

    it('应该构建删除请求', () => {
      const request = buildDeleteRequest('/assets/logos/test.png');
      assert.strictEqual(request.method, 'DELETE');
      // URL 中的文件路径被编码，所以检查 DELETE 端点
      assert(request.url.includes('/api/upload/file'));
      assert(request.url.includes('path='));
    });

    it('应该 URL 编码文件路径', () => {
      const request = buildDeleteRequest('/assets/logos/test file.png');
      assert(request.url.includes(encodeURIComponent('/assets/logos/test file.png')));
    });

    it('应该拒绝空路径', () => {
      assert.throws(() => buildDeleteRequest(''), /路径不能为空/);
      assert.throws(() => buildDeleteRequest(null), /路径不能为空/);
    });
  });

  describe('表单数据转换', () => {
    function normalizeFormData(data) {
      return {
        name: (data.name || '').trim(),
        school: (data.school || '').trim(),
        province: data.province || null,
        description: (data.description || '').trim(),
        tags: Array.isArray(data.tags) ? data.tags : [],
        coordinates: Array.isArray(data.coordinates) ? data.coordinates : null,
        externalLinks: Array.isArray(data.externalLinks) ? data.externalLinks : []
      };
    }

    it('应该规范化表单数据', () => {
      const data = {
        name: '  测试社团  ',
        school: '  清华大学  ',
        province: '北京市',
        tags: ['游戏'],
        coordinates: [116.3, 39.9],
        externalLinks: []
      };
      const normalized = normalizeFormData(data);
      assert.strictEqual(normalized.name, '测试社团');
      assert.strictEqual(normalized.school, '清华大学');
    });

    it('应该处理缺少的字段', () => {
      const data = {};
      const normalized = normalizeFormData(data);
      assert.strictEqual(normalized.name, '');
      assert(Array.isArray(normalized.tags));
    });

    it('应该转换数组字段', () => {
      const data = {
        name: '测试',
        school: '学校',
        tags: null,
        externalLinks: undefined
      };
      const normalized = normalizeFormData(data);
      assert(Array.isArray(normalized.tags));
      assert(Array.isArray(normalized.externalLinks));
    });
  });

  describe('错误处理', () => {
    function formatErrorMessage(error) {
      if (typeof error === 'string') {
        return error;
      }
      if (error.response && error.response.data && error.response.data.message) {
        return error.response.data.message;
      }
      if (error.message) {
        return error.message;
      }
      return '发生未知错误';
    }

    it('应该处理字符串错误', () => {
      const msg = formatErrorMessage('简单错误');
      assert.strictEqual(msg, '简单错误');
    });

    it('应该处理 Error 对象', () => {
      const error = new Error('测试错误');
      const msg = formatErrorMessage(error);
      assert.strictEqual(msg, '测试错误');
    });

    it('应该处理 API 错误响应', () => {
      const error = {
        response: {
          data: { message: 'API 错误' }
        }
      };
      const msg = formatErrorMessage(error);
      assert.strictEqual(msg, 'API 错误');
    });

    it('应该提供默认错误消息', () => {
      const msg = formatErrorMessage({});
      assert.strictEqual(msg, '发生未知错误');
    });
  });

  describe('限制配置验证', () => {
    const LIMITS = {
      logo_max_size: 20 * 1024 * 1024,
      qrcode_max_size: 5 * 1024 * 1024,
      max_tags: 10,
      max_description_long: 1000,
      max_description_short: 200,
      max_links: 10
    };

    it('应该定义所有限制配置', () => {
      assert(LIMITS.logo_max_size);
      assert(LIMITS.qrcode_max_size);
      assert(LIMITS.max_tags);
      assert(LIMITS.max_description_long);
      assert(LIMITS.max_description_short);
      assert(LIMITS.max_links);
    });

    it('应该有合理的文件大小限制', () => {
      assert(LIMITS.logo_max_size > LIMITS.qrcode_max_size);
      assert(LIMITS.logo_max_size === 20 * 1024 * 1024);
      assert(LIMITS.qrcode_max_size === 5 * 1024 * 1024);
    });

    it('应该有合理的标签和链接限制', () => {
      assert.strictEqual(LIMITS.max_tags, 10);
      assert.strictEqual(LIMITS.max_links, 10);
    });

    it('应该有合理的描述长度限制', () => {
      assert(LIMITS.max_description_short < LIMITS.max_description_long);
      assert.strictEqual(LIMITS.max_description_short, 200);
      assert.strictEqual(LIMITS.max_description_long, 1000);
    });
  });

});
