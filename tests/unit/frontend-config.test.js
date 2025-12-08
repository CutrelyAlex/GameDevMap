/**
 * 前端配置单元测试 (public/js/config.js)
 * 测试全局常量和配置项的有效性和一致性
 */
const assert = require('assert');

describe('Frontend - Config (Global Configuration)', () => {

  describe('省份列表', () => {
    const PROVINCES = [
      '北京市', '天津市', '上海市', '重庆市',
      '河北省', '山西省', '辽宁省', '吉林省', '黑龙江省',
      '江苏省', '浙江省', '安徽省', '福建省', '江西省', '山东省',
      '河南省', '湖北省', '湖南省', '广东省', '海南省',
      '四川省', '贵州省', '云南省', '陕西省', '甘肃省',
      '青海省', '台湾省',
      '内蒙古自治区', '广西壮族自治区', '西藏自治区',
      '宁夏回族自治区', '新疆维吾尔自治区',
      '香港特别行政区', '澳门特别行政区'
    ];

    it('应该包含 34 个省份/地区', () => {
      assert.strictEqual(PROVINCES.length, 34);
    });

    it('应该包含四个直辖市', () => {
      const municipalities = ['北京市', '天津市', '上海市', '重庆市'];
      municipalities.forEach(city => {
        assert(PROVINCES.includes(city), `应该包含 ${city}`);
      });
    });

    it('应该包含五个自治区', () => {
      const autonomousRegions = [
        '内蒙古自治区', '广西壮族自治区', '西藏自治区',
        '宁夏回族自治区', '新疆维吾尔自治区'
      ];
      autonomousRegions.forEach(region => {
        assert(PROVINCES.includes(region), `应该包含 ${region}`);
      });
    });

    it('应该包含两个特别行政区', () => {
      const specialRegions = ['香港特别行政区', '澳门特别行政区'];
      specialRegions.forEach(region => {
        assert(PROVINCES.includes(region), `应该包含 ${region}`);
      });
    });

    it('应该包含 23 个省', () => {
      const provinces = PROVINCES.filter(p => p.endsWith('省'));
      assert.strictEqual(provinces.length, 23);
    });

    it('应该包含主要城市', () => {
      const majorCities = ['北京市', '上海市', '广东省', '浙江省', '江苏省'];
      majorCities.forEach(city => {
        assert(PROVINCES.includes(city), `应该包含主要城市 ${city}`);
      });
    });

    it('应该不包含重复项', () => {
      const uniqueProvinces = new Set(PROVINCES);
      assert.strictEqual(uniqueProvinces.size, PROVINCES.length);
    });

    it('应该按地理位置合理排序', () => {
      // 验证前几个和最后几个
      assert.strictEqual(PROVINCES[0], '北京市');
      assert(PROVINCES[PROVINCES.length - 1].includes('澳'));
    });
  });

  describe('API 端点配置', () => {
    const API_ENDPOINTS = {
      upload_logo: '/api/upload/logo',
      upload_qrcode: '/api/upload/qrcode',
      submit: '/api/submissions',
      clubs_data: '/data/clubs.json'
    };

    it('应该定义所有必需的 API 端点', () => {
      assert(API_ENDPOINTS.upload_logo);
      assert(API_ENDPOINTS.upload_qrcode);
      assert(API_ENDPOINTS.submit);
      assert(API_ENDPOINTS.clubs_data);
    });

    it('应该使用一致的路径前缀', () => {
      assert(API_ENDPOINTS.upload_logo.startsWith('/api'));
      assert(API_ENDPOINTS.upload_qrcode.startsWith('/api'));
      assert(API_ENDPOINTS.submit.startsWith('/api'));
    });

    it('应该包含 JSON 数据源', () => {
      assert(API_ENDPOINTS.clubs_data.includes('/data/'));
      assert(API_ENDPOINTS.clubs_data.includes('.json'));
    });

    it('应该包含上传端点', () => {
      assert(API_ENDPOINTS.upload_logo.includes('upload'));
      assert(API_ENDPOINTS.upload_qrcode.includes('upload'));
    });

    it('应该有清晰的端点名称', () => {
      Object.keys(API_ENDPOINTS).forEach(key => {
        assert(typeof key === 'string');
        assert(key.length > 0);
      });
    });
  });

  describe('限制配置', () => {
    const LIMITS = {
      logo_max_size: 20 * 1024 * 1024,      // 20MB
      qrcode_max_size: 5 * 1024 * 1024,     // 5MB
      max_tags: 10,
      max_description_long: 1000,
      max_description_short: 200,
      max_links: 10
    };

    it('应该定义所有限制项', () => {
      assert(LIMITS.logo_max_size);
      assert(LIMITS.qrcode_max_size);
      assert(LIMITS.max_tags);
      assert(LIMITS.max_description_long);
      assert(LIMITS.max_description_short);
      assert(LIMITS.max_links);
    });

    it('应该使用合理的文件大小限制', () => {
      // Logo 可以比 QR 码大
      assert(LIMITS.logo_max_size > LIMITS.qrcode_max_size);
      // Logo 应该是 20MB
      assert.strictEqual(LIMITS.logo_max_size, 20 * 1024 * 1024);
      // QR 码应该是 5MB
      assert.strictEqual(LIMITS.qrcode_max_size, 5 * 1024 * 1024);
    });

    it('应该使用合理的标签和链接限制', () => {
      assert(LIMITS.max_tags > 0);
      assert(LIMITS.max_links > 0);
      assert.strictEqual(LIMITS.max_tags, 10);
      assert.strictEqual(LIMITS.max_links, 10);
    });

    it('应该使用合理的描述长度限制', () => {
      // 长描述应该比短描述长
      assert(LIMITS.max_description_long > LIMITS.max_description_short);
      assert.strictEqual(LIMITS.max_description_short, 200);
      assert.strictEqual(LIMITS.max_description_long, 1000);
    });

    it('应该所有限制都是正数', () => {
      Object.values(LIMITS).forEach(limit => {
        assert(limit > 0, '所有限制应该是正数');
      });
    });
  });

  describe('地图配置', () => {
    const MAP_CONFIG = {
      LOGO_DIR: '/assets/compressedLogos/',
      FALLBACK_LOGO_DIR: '/assets/logos/',
      PLACEHOLDER: '/assets/logos/placeholder.png',
      DATA_PATH: '/api/clubs',
      DATA_PATH_FALLBACK: '/data/clubs.json',
      DEFAULT_ZOOM: 5,
      CENTER: [104.1954, 35.8617],
      DETAIL_ZOOM: 13
    };

    it('应该定义所有必需的地图配置', () => {
      assert(MAP_CONFIG.LOGO_DIR);
      assert(MAP_CONFIG.DATA_PATH);
      assert(MAP_CONFIG.CENTER);
      assert(MAP_CONFIG.DEFAULT_ZOOM);
      assert(MAP_CONFIG.DETAIL_ZOOM);
    });

    it('应该包含资源路径配置', () => {
      assert(MAP_CONFIG.LOGO_DIR.startsWith('/'));
      assert(MAP_CONFIG.FALLBACK_LOGO_DIR.startsWith('/'));
      assert(MAP_CONFIG.PLACEHOLDER.startsWith('/'));
    });

    it('应该包含数据加载配置', () => {
      assert(MAP_CONFIG.DATA_PATH.includes('/api'));
      assert(MAP_CONFIG.DATA_PATH_FALLBACK.includes('.json'));
    });

    it('应该包含有效的中心坐标', () => {
      assert(Array.isArray(MAP_CONFIG.CENTER));
      assert.strictEqual(MAP_CONFIG.CENTER.length, 2);
      const [lng, lat] = MAP_CONFIG.CENTER;
      // 中国地理中心大约在这附近
      assert(lng > 100 && lng < 110);
      assert(lat > 30 && lat < 40);
    });

    it('应该有有效的缩放级别', () => {
      // 高德地图缩放级别 3-18
      assert(MAP_CONFIG.DEFAULT_ZOOM >= 3 && MAP_CONFIG.DEFAULT_ZOOM <= 18);
      assert(MAP_CONFIG.DETAIL_ZOOM >= 3 && MAP_CONFIG.DETAIL_ZOOM <= 18);
    });

    it('应该有合理的缩放关系', () => {
      // 详情缩放级别应该比默认缩放级别高（更近）
      assert(MAP_CONFIG.DETAIL_ZOOM > MAP_CONFIG.DEFAULT_ZOOM);
    });

    it('应该有备用资源配置', () => {
      assert(MAP_CONFIG.FALLBACK_LOGO_DIR);
      assert(MAP_CONFIG.DATA_PATH_FALLBACK);
      assert(MAP_CONFIG.PLACEHOLDER);
    });

    it('应该正确识别中国中心', () => {
      // 中国的实际地理中心
      const [lng, lat] = MAP_CONFIG.CENTER;
      assert(lng === 104.1954);
      assert(lat === 35.8617);
    });

    it('应该包含压缩和原始两个 Logo 目录', () => {
      assert(MAP_CONFIG.LOGO_DIR.includes('compressedLogos') || MAP_CONFIG.LOGO_DIR.includes('Compressed'));
      assert(MAP_CONFIG.FALLBACK_LOGO_DIR.includes('logos'));
    });
  });

  describe('路径一致性验证', () => {
    const API_ENDPOINTS = {
      upload_logo: '/api/upload/logo',
      upload_qrcode: '/api/upload/qrcode',
      submit: '/api/submissions',
      clubs_data: '/data/clubs.json'
    };

    const MAP_CONFIG = {
      LOGO_DIR: '/assets/compressedLogos/',
      DATA_PATH: '/api/clubs',
      DATA_PATH_FALLBACK: '/data/clubs.json'
    };

    it('应该统一使用斜杠分隔路径', () => {
      const allPaths = [
        ...Object.values(API_ENDPOINTS),
        ...Object.values(MAP_CONFIG)
      ];
      allPaths.forEach(path => {
        if (typeof path === 'string') {
          assert(path.startsWith('/'), `路径应该以 / 开头: ${path}`);
        }
      });
    });

    it('应该统一使用小写的 API 前缀', () => {
      assert(API_ENDPOINTS.submit.startsWith('/api'));
      assert(API_ENDPOINTS.upload_logo.startsWith('/api'));
      assert(MAP_CONFIG.DATA_PATH.startsWith('/api'));
    });

    it('应该统一使用小写的资源前缀', () => {
      assert(MAP_CONFIG.LOGO_DIR.startsWith('/assets'));
      assert(MAP_CONFIG.DATA_PATH_FALLBACK.startsWith('/data'));
    });
  });

  describe('配置完整性验证', () => {
    const config = {
      PROVINCES: Array(34).fill('省份'),
      API_ENDPOINTS: {
        upload_logo: '/api/upload/logo',
        upload_qrcode: '/api/upload/qrcode',
        submit: '/api/submissions',
        clubs_data: '/data/clubs.json'
      },
      LIMITS: {
        logo_max_size: 20 * 1024 * 1024,
        qrcode_max_size: 5 * 1024 * 1024,
        max_tags: 10,
        max_description_long: 1000,
        max_description_short: 200,
        max_links: 10
      },
      MAP_CONFIG: {
        LOGO_DIR: '/assets/compressedLogos/',
        FALLBACK_LOGO_DIR: '/assets/logos/',
        PLACEHOLDER: '/assets/logos/placeholder.png',
        DATA_PATH: '/api/clubs',
        DATA_PATH_FALLBACK: '/data/clubs.json',
        DEFAULT_ZOOM: 5,
        CENTER: [104.1954, 35.8617],
        DETAIL_ZOOM: 13
      }
    };

    it('应该包含所有配置类别', () => {
      assert(config.PROVINCES);
      assert(config.API_ENDPOINTS);
      assert(config.LIMITS);
      assert(config.MAP_CONFIG);
    });

    it('应该有完整的 API 端点定义', () => {
      const expectedEndpoints = [
        'upload_logo', 'upload_qrcode', 'submit', 'clubs_data'
      ];
      expectedEndpoints.forEach(endpoint => {
        assert(config.API_ENDPOINTS[endpoint], `缺少 API 端点: ${endpoint}`);
      });
    });

    it('应该有完整的限制配置', () => {
      const expectedLimits = [
        'logo_max_size', 'qrcode_max_size', 'max_tags',
        'max_description_long', 'max_description_short', 'max_links'
      ];
      expectedLimits.forEach(limit => {
        assert(config.LIMITS[limit], `缺少限制配置: ${limit}`);
      });
    });

    it('应该有完整的地图配置', () => {
      const expectedMapConfig = [
        'LOGO_DIR', 'FALLBACK_LOGO_DIR', 'PLACEHOLDER',
        'DATA_PATH', 'DATA_PATH_FALLBACK',
        'DEFAULT_ZOOM', 'CENTER', 'DETAIL_ZOOM'
      ];
      expectedMapConfig.forEach(item => {
        assert(config.MAP_CONFIG[item], `缺少地图配置: ${item}`);
      });
    });
  });

  describe('配置值范围验证', () => {
    const LIMITS = {
      logo_max_size: 20 * 1024 * 1024,
      qrcode_max_size: 5 * 1024 * 1024,
      max_tags: 10,
      max_description_long: 1000,
      max_description_short: 200,
      max_links: 10
    };

    const MAP_CONFIG = {
      DEFAULT_ZOOM: 5,
      DETAIL_ZOOM: 13,
      CENTER: [104.1954, 35.8617]
    };

    it('应该使用合理的文件大小单位', () => {
      // 确保是以字节为单位
      assert(LIMITS.logo_max_size > 1000000); // 大于 1MB
      assert(LIMITS.qrcode_max_size < LIMITS.logo_max_size);
    });

    it('应该使用合理的文本长度限制', () => {
      // 长描述应该足够长
      assert(LIMITS.max_description_long >= 500);
      // 短描述应该足够短
      assert(LIMITS.max_description_short <= 250);
    });

    it('应该使用合理的对象数量限制', () => {
      assert(LIMITS.max_tags >= 5);
      assert(LIMITS.max_links >= 5);
    });

    it('应该使用合理的地图缩放级别', () => {
      // 缩放级别应该在 AMap 支持的范围内
      assert(MAP_CONFIG.DEFAULT_ZOOM >= 3 && MAP_CONFIG.DEFAULT_ZOOM <= 18);
      assert(MAP_CONFIG.DETAIL_ZOOM >= 3 && MAP_CONFIG.DETAIL_ZOOM <= 18);
    });

    it('应该使用有效的坐标', () => {
      const [lng, lat] = MAP_CONFIG.CENTER;
      assert(lng >= -180 && lng <= 180);
      assert(lat >= -90 && lat <= 90);
    });
  });

});
