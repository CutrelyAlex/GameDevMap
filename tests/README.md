# Tests 目录

项目的单元测试和集成测试套件。

## 目录结构

```
tests/
├── unit/                    # 单元测试
│   ├── models.test.js       # 数据模型测试
│   ├── middleware.test.js   # 中间件测试
│   ├── utils.test.js        # 工具函数测试
│   ├── routes-structure.test.js  # 路由结构测试
│   └── scripts.test.js      # 脚本测试
├── integration/             # 集成测试
│   └── api.test.js          # API 集成测试
└── README.md
```

## 运行测试

### 安装依赖

```bash
npm install --save-dev mocha
npm install --save-dev chai
npm install --save-dev supertest  # 用于 API 测试
```

### 运行所有测试

```bash
npm test
```

### 运行特定测试

```bash
npm test -- tests/unit/models.test.js
npm test -- tests/integration/api.test.js
```

### 运行并显示详细输出

```bash
npm test -- --reporter spec
```

## 测试覆盖

### 单元测试

- **models.test.js** - 测试数据模型的 Schema 和验证
  - ✅ Club 模型创建和验证
  - ✅ Submission 模型创建和验证
  - ✅ AdminUser 模型创建和验证
  - ✅ 必需字段验证
  - ✅ 自动字段（createdAt, updatedAt）

- **middleware.test.js** - 测试中间件功能
  - ✅ 数据验证 (validate.js)
  - ✅ 速率限制 (rateLimiter.js)
  - ✅ 文件上传 (upload.js)
  - ✅ 认证 (auth.js)
  - ✅ JWT Token 生成

- **utils.test.js** - 测试工具函数
  - ✅ 重复检测相似度计算
  - ✅ 文件处理
  - ✅ 图片处理
  - ✅ 路径配置

- **routes-structure.test.js** - 测试路由结构
  - ✅ 路由可加载性
  - ✅ 模块化路由（submissions, sync）
  - ✅ Controller 函数

- **scripts.test.js** - 测试维护脚本
  - ✅ sync-to-json 脚本
  - ✅ create-admin 脚本
  - ✅ migrate-clubs 脚本
  - ✅ validate-database 脚本

### 集成测试

- **api.test.js** - 测试 API 集成
  - ✅ 数据库连接
  - ✅ 模型可用性
  - ✅ 路由加载
  - ✅ 中间件加载
  - ✅ 配置加载

## 添加新测试

创建新的测试文件：

```javascript
describe('Feature Name', () => {
  it('应该做某事', () => {
    // 测试代码
    assert(true);
  });
});
```

然后运行：

```bash
npm test
```

## 注意事项

- 单元测试应该快速且独立
- 集成测试可能需要运行的服务或数据库连接
- 使用 `this.timeout(ms)` 设置长耗时测试的超时时间
- 使用 `this.skip()` 跳过某个测试
- 数据库测试应该在 `before` 和 `after` 中管理连接生命周期

## 持续集成

可以集成到 CI/CD 流程中：

```yaml
# .github/workflows/test.yml
- name: Run tests
  run: npm test
```
