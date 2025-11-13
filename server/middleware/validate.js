const Joi = require('joi');

// 中国省份列表（34个省级行政区）
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

// 提交数据验证 schema
const submissionSchema = Joi.object({
  submissionType: Joi.string()
    .valid('new', 'edit')
    .optional()
    .default('new')
    .messages({
      'any.only': '提交类型必须是 new 或 edit'
    }),

  editingClubId: Joi.string()
    .when('submissionType', {
      is: 'edit',
      then: Joi.required(),
      otherwise: Joi.optional()
    })
    .messages({
      'any.required': '编辑模式下必须提供社团 ID'
    }),

  name: Joi.string()
    .min(2)
    .max(100)
    .required()
    .messages({
      'string.base': '社团名称必须是文本',
      'string.empty': '社团名称不能为空',
      'string.min': '社团名称至少需要 2 个字符',
      'string.max': '社团名称最多 100 个字符',
      'any.required': '社团名称是必填项'
    }),

  school: Joi.string()
    .min(2)
    .max(100)
    .required()
    .messages({
      'string.base': '学校名称必须是文本',
      'string.empty': '学校名称不能为空',
      'string.min': '学校名称至少需要 2 个字符',
      'string.max': '学校名称最多 100 个字符',
      'any.required': '学校名称是必填项'
    }),

  province: Joi.string()
    .valid(...PROVINCES)
    .required()
    .messages({
      'string.base': '省份必须是文本',
      'any.only': '请选择有效的省份',
      'any.required': '省份是必填项'
    }),

  city: Joi.string()
    .min(2)
    .max(50)
    .optional()
    .messages({
      'string.base': '城市名称必须是文本',
      'string.min': '城市名称至少需要 2 个字符',
      'string.max': '城市名称最多 50 个字符'
    }),

  coordinates: Joi.object({
    latitude: Joi.number()
      .min(-90)
      .max(90)
      .required()
      .messages({
        'number.base': '纬度必须是数字',
        'number.min': '纬度必须在 -90 到 90 之间',
        'number.max': '纬度必须在 -90 到 90 之间',
        'any.required': '纬度是必填项'
      }),
    longitude: Joi.number()
      .min(-180)
      .max(180)
      .required()
      .messages({
        'number.base': '经度必须是数字',
        'number.min': '经度必须在 -180 到 180 之间',
        'number.max': '经度必须在 -180 到 180 之间',
        'any.required': '经度是必填项'
      })
  }).required().messages({
    'any.required': '坐标是必填项',
    'object.base': '坐标格式不正确'
  }),

  description: Joi.string()
    .max(500)
    .optional()
    .allow('')
    .messages({
      'string.base': '社团简介必须是文本',
      'string.max': '社团简介最多 500 个字符'
    }),

  shortDescription: Joi.string()
    .max(200)
    .optional()
    .allow('')
    .messages({
      'string.base': '短介绍必须是文本',
      'string.max': '短介绍最多 200 个字符'
    }),

  description: Joi.string()
    .max(1000)
    .optional()
    .allow('')
    .messages({
      'string.base': '长介绍必须是文本',
      'string.max': '长介绍最多 1000 个字符'
    }),

  tags: Joi.array()
    .items(Joi.string().max(20))
    .max(10)
    .optional()
    .messages({
      'array.base': '标签必须是数组',
      'array.max': '最多添加 10 个标签',
      'string.max': '每个标签最多 20 个字符'
    }),

  externalLinks: Joi.array()
    .items(Joi.object({
      type: Joi.string()
        .max(50)
        .required()
        .messages({
          'string.base': '链接类型必须是文本',
          'string.max': '链接类型最多 50 个字符',
          'any.required': '链接类型是必填项'
        }),
      url: Joi.string()
        .uri()
        .required()
        .messages({
          'string.uri': '链接地址必须是有效的 URL',
          'any.required': '链接地址是必填项'
        })
    }))
    .optional()
    .messages({
      'array.base': '外部链接必须是数组'
    }),

  logo: Joi.string()
    .uri({ relativeOnly: true })
    .optional()
    .allow('')
    .messages({
      'string.base': 'Logo 路径必须是文本',
      'string.uri': 'Logo 路径格式不正确'
    }),

  submitterEmail: Joi.string()
    .email()
    .required()
    .messages({
      'string.base': '提交者邮箱必须是文本',
      'string.empty': '提交者邮箱不能为空',
      'string.email': '提交者邮箱格式不正确',
      'any.required': '提交者邮箱是必填项'
    })
});

// 验证中间件
const validateSubmission = (req, res, next) => {
  const { error, value } = submissionSchema.validate(req.body, {
    abortEarly: false, // 返回所有错误，而不是第一个
    stripUnknown: true // 移除未知字段
  });

  if (error) {
    const errors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));

    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: '提交数据验证失败',
      errors
    });
  }

  // 将验证后的值附加到请求对象
  req.validatedData = value;
  next();
};

module.exports = {
  validateSubmission,
  submissionSchema,
  PROVINCES
};
