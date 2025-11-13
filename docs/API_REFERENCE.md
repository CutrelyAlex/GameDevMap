# GameDevMap API 参考文档

**适用版本：** v1.0.0  
**最后更新：** 2025-11-12

---

## 概述

本文档提供 GameDevMap 系统的完整 API 参考。包含网站架构、服务端架构以及所有公开 API 端点的签名和参数说明。

GameDevMap 是一个全国高校游戏开发社团地图系统，提供社团信息的提交、审核、展示和管理功能。

---

## 目录

- [GameDevMap API 参考文档](#gamedevmap-api-参考文档)
  - [概述](#概述)
  - [目录](#目录)
  - [系统架构](#系统架构)
    - [网站架构图](#网站架构图)
    - [服务端架构图](#服务端架构图)
  - [认证 API](#认证-api)
    - [`POST /api/auth/login`](#post-apiauthlogin)
  - [文件上传 API](#文件上传-api)
    - [`POST /api/upload/logo`](#post-apiuploadlogo)
  - [提交管理 API](#提交管理-api)
    - [`POST /api/submissions`](#post-apisubmissions)
    - [`GET /api/submissions`](#get-apisubmissions)
    - [`GET /api/submissions/:id`](#get-apisubmissionsid)
    - [`PUT /api/submissions/:id/approve`](#put-apisubmissionsidapprove)
    - [`PUT /api/submissions/:id/reject`](#put-apisubmissionsidreject)
  - [社团管理 API](#社团管理-api)
    - [`GET /api/clubs`](#get-apiclubs)
    - [`GET /api/clubs/:id`](#get-apiclubsid)
    - [`PUT /api/clubs/:id`](#put-apiclubsid)
    - [`DELETE /api/clubs/:id`](#delete-apiclubsid)
  - [数据同步 API](#数据同步-api)
    - [`POST /api/sync/merge`](#post-apisyncmerge)
    - [`POST /api/sync/replace`](#post-apisyncreplace)
  - [数据模型](#数据模型)
    - [`Submission` (提交)](#submission-提交)
    - [`Club` (社团)](#club-社团)
    - [`AdminUser` (管理员)](#adminuser-管理员)
  - [错误处理](#错误处理)
  - [延伸阅读](#延伸阅读)
  - [联系方式](#联系方式)

---

## 系统架构

### 网站架构图

```mermaid
graph TB
    A[用户浏览器] --> B[index.html\n地图展示页面]
    A --> C[submit.html\n提交表单页面]
    A --> D[admin/index.html\n管理后台页面]

    B --> E["public/data/clubs.json\n静态社团数据"]
    B --> F["public/assets/\ncompressedLogos/\n社团Logo"]

    C --> G[JavaScript\n表单验证]
    D --> H[JavaScript\n管理界面]

    G --> I["POST /api/submissions\n提交社团信息"]
    H --> J["GET /api/submissions\n获取待审核列表"]
    H --> K["PUT /api/submissions/:id/approve\n批准提交"]
    H --> L["PUT /api/submissions/:id/reject\n拒绝提交"]
    H --> M["GET /api/clubs\n获取社团列表"]
    H --> N["PUT /api/clubs/:id\n编辑社团"]
    H --> O["DELETE /api/clubs/:id\n删除社团"]

    I --> P[Express.js Server\n端口 3000]
    J --> P
    K --> P
    L --> P
    M --> P
    N --> P
    O --> P
```

### 服务端架构图

```mermaid
graph TB
    subgraph "客户端层"
        A[浏览器]
    end

    subgraph "API网关层"
        B[Express.js Server\n端口 3000]
        B1[helmet\n安全头]
        B2[cors\n跨域支持]
        B3[express.json\nJSON解析]
        B4[morgan\n请求日志]
        B5[rateLimiter\n频率限制]
    end

    subgraph "业务逻辑层"
        C1[认证中间件\nJWT验证]
        C2[验证中间件\nJoi校验]
        C3[上传中间件\nmulter文件处理]
    end

    subgraph "路由层"
        D1["/api/auth\n认证路由"]
        D2["/api/upload\n文件上传路由"]
        D3["/api/submissions\n提交管理路由"]
        D4["/api/clubs\n社团查询路由"]
    end

    subgraph "数据访问层"
        E1[MongoDB\n主数据库]
        E2["文件系统\ndata/目录"]
        E3["静态JSON\npublic/data/"]
    end

    subgraph "数据存储"
        F1[(Submissions\n待审核提交)]
        F2[(Clubs\n已批准社团)]
        F3[(AdminUsers\n管理员账户)]
        F4["data/submissions/\n上传的Logo文件"]
        F5["data/pending_submissions/\n临时JSON备份"]
        F6["public/data/clubs.json\n前端读取数据"]
        F7["public/assets/logos/\n处理后Logo"]
        F8["public/assets/compressedLogos/\n压缩Logo"]
    end

    A --> B
    B --> B1
    B --> B2
    B --> B3
    B --> B4
    B --> B5

    B --> C1
    B --> C2
    B --> C3

    C1 --> D1
    C2 --> D2
    C3 --> D3
    C1 --> D4

    D1 --> E1
    D2 --> E2
    D3 --> E1
    D4 --> E1

    E1 --> F1
    E1 --> F2
    E1 --> F3
    E2 --> F4
    E2 --> F5
    E3 --> F6
    E2 --> F7
    E2 --> F8
```

---

## 认证 API

### `POST /api/auth/login`

**说明：**  
管理员用户登录，验证用户名和密码，返回JWT访问令牌。

**参数：**

| 参数名 | 类型 | 必填/可选 | 说明 | 默认值 |
|--------|------|----------|------|--------|
| `username` | `string` | 必填 | 管理员用户名 | - |
| `password` | `string` | 必填 | 管理员密码 | - |

**返回值：**
- **类型：** `Object`
- **成功情况：** 返回包含JWT令牌的用户信息
- **失败情况：** 返回错误信息

**使用示例：**

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your_password"}'
```

---

## 文件上传 API

### `POST /api/upload/logo`

**说明：**  
上传社团Logo图片文件，进行格式验证和存储。

**参数：**

| 参数名 | 类型 | 必填/可选 | 说明 | 默认值 |
|--------|------|----------|------|--------|
| `logo` | `File` | 必填 | Logo图片文件（PNG/JPG/GIF/SVG，最大20MB） | - |

**返回值：**
- **类型：** `Object`
- **成功情况：** 返回文件访问路径
- **失败情况：** 返回错误信息

**使用示例：**

```bash
curl -X POST http://localhost:3000/api/upload/logo \
  -F "logo=@logo.png"
```

---

## 提交管理 API

### `POST /api/submissions`

**说明：**  
提交新的社团信息，创建待审核的提交记录。

**参数：**

| 参数名 | 类型 | 必填/可选 | 说明 | 默认值 |
|--------|------|----------|------|--------|
| `submissionType` | `string` | 可选 | 提交类型：'new'或'edit' | 'new' |
| `name` | `string` | 必填 | 社团名称 | - |
| `school` | `string` | 必填 | 所属学校 | - |
| `province` | `string` | 必填 | 所在省份 | - |
| `city` | `string` | 可选 | 所在城市 | - |
| `coordinates` | `Object` | 必填 | 坐标对象 | - |
| `coordinates.latitude` | `number` | 必填 | 纬度 | - |
| `coordinates.longitude` | `number` | 必填 | 经度 | - |
| `shortDescription` | `string` | 可选 | 社团简介（短） | - |
| `description` | `string` | 可选 | 社团详细介绍 | - |
| `tags` | `Array<string>` | 可选 | 标签数组 | [] |
| `externalLinks` | `Array<Object>` | 可选 | 外部链接数组 `{type, url}` | [] |
| `logo` | `string` | 可选 | Logo 文件路径 | - |
| `submitterEmail` | `string` | 必填 | 提交者邮箱 | - |
| `editingClubId` | `string` | 可选 | 编辑模式下的社团ID | - |

**返回值：**
- **类型：** `Object`
- **成功情况：** 返回提交ID和状态信息
- **失败情况：** 返回验证错误信息

---

### `GET /api/submissions`

**说明：**  
获取提交列表，支持分页、筛选和排序（需要管理员权限）。

**参数：**

| 参数名 | 类型 | 必填/可选 | 说明 | 默认值 |
|--------|------|----------|------|--------|
| `page` | `number` | 可选 | 页码（从1开始） | 1 |
| `limit` | `number` | 可选 | 每页数量（1-50） | 10 |
| `status` | `string` | 可选 | 状态筛选：'pending'/'approved'/'rejected'/'all' | 'pending' |
| `sort` | `string` | 可选 | 排序：'newest'/'oldest' | 'newest' |

**返回值：**
- **类型：** `Object`
- **成功情况：** 返回分页的提交列表
- **失败情况：** 返回错误信息

---

### `GET /api/submissions/:id`

**说明：**  
获取单个提交的详细信息（需要管理员权限）。

**参数：**

| 参数名 | 类型 | 必填/可选 | 说明 | 默认值 |
|--------|------|----------|------|--------|
| `id` | `string` | 必填 | 提交记录ID | - |

**返回值：**
- **类型：** `Object`
- **成功情况：** 返回提交详细信息
- **失败情况：** 返回错误信息

---

### `PUT /api/submissions/:id/approve`

**说明：**  
批准提交，将其转换为正式社团记录（需要管理员权限）。

**参数：**

| 参数名 | 类型 | 必填/可选 | 说明 | 默认值 |
|--------|------|----------|------|--------|
| `id` | `string` | 必填 | 提交记录ID | - |

**返回值：**
- **类型：** `Object`
- **成功情况：** 返回提交ID和新创建的社团ID
- **失败情况：** 返回错误信息

---

### `PUT /api/submissions/:id/reject`

**说明：**  
拒绝提交，标记为已拒绝状态（需要管理员权限）。

**参数：**

| 参数名 | 类型 | 必填/可选 | 说明 | 默认值 |
|--------|------|----------|------|--------|
| `id` | `string` | 必填 | 提交记录ID | - |
| `rejectionReason` | `string` | 必填 | 拒绝原因 | - |

**返回值：**
- **类型：** `Object`
- **成功情况：** 返回操作成功信息
- **失败情况：** 返回错误信息

---

## 社团管理 API

### `GET /api/clubs`

**说明：**  
获取所有已批准社团的列表，支持搜索筛选。

**参数：**

| 参数名 | 类型 | 必填/可选 | 说明 | 默认值 |
|--------|------|----------|------|--------|
| `search` | `string` | 可选 | 搜索关键词（名称、学校、省份等） | - |

**返回值：**
- **类型：** `Array`
- **成功情况：** 返回社团列表数组
- **失败情况：** 返回错误信息

---

### `GET /api/clubs/:id`

**说明：**  
获取单个社团的详细信息。

**参数：**

| 参数名 | 类型 | 必填/可选 | 说明 | 默认值 |
|--------|------|----------|------|--------|
| `id` | `string` | 必填 | 社团ID | - |

**返回值：**
- **类型：** `Object`
- **成功情况：** 返回社团详细信息
- **失败情况：** 返回错误信息

---

### `PUT /api/clubs/:id`

**说明：**  
编辑社团信息（需要管理员权限）。

**参数：**

| 参数名 | 类型 | 必填/可选 | 说明 | 默认值 |
|--------|------|----------|------|--------|
| `id` | `string` | 必填 | 社团ID | - |
| `name` | `string` | 可选 | 社团名称 | - |
| `school` | `string` | 可选 | 所属学校 | - |
| `province` | `string` | 可选 | 所在省份 | - |
| `city` | `string` | 可选 | 所在城市 | - |
| `description` | `string` | 可选 | 详细介绍 | - |
| `shortDescription` | `string` | 可选 | 简介 | - |
| `tags` | `Array<string>` | 可选 | 标签数组 | - |
| `externalLinks` | `Array<Object>` | 可选 | 外部链接数组 `{type, url}` | - |
| `coordinates` | `Array<number>` | 可选 | 坐标数组 `[经度, 纬度]` | - |
| `logo` | `string` | 可选 | Logo 文件名 | - |

**返回值：**
- **类型：** `Object`
- **成功情况：** 返回更新后的社团信息
- **失败情况：** 返回错误信息

---

### `DELETE /api/clubs/:id`

**说明：**  
删除社团记录及其相关Logo文件（需要管理员权限）。

**参数：**

| 参数名 | 类型 | 必填/可选 | 说明 | 默认值 |
|--------|------|----------|------|--------|
| `id` | `string` | 必填 | 社团ID | - |

**返回值：**
- **类型：** `Object`
- **成功情况：** 返回删除成功信息
- **失败情况：** 返回错误信息

---

---

## 数据同步 API

**说明：** 管理员专用接口，用于同步 MongoDB 数据库和 clubs.json 文件之间的数据。所有接口需要有效的管理员身份验证。


当执行 `/api/sync/compare`、`/api/sync/merge` 或 `/api/sync/replace` 时，系统会：

1. **读取 MongoDB** 中的社团数据（使用驼峰命名）
2. **读取 JSON 文件** 中的社团数据（使用下划线命名）
3. **应用 `formatClub()` 转换**，将 MongoDB 文档转换为 JSON 格式
4. **进行字段比较**（比较前会移除 `_id`、`createdAt`、`updatedAt` 等 MongoDB 特有字段）
5. **输出差异报告**

---### `GET /api/sync/compare`

**说明：**  
对比 MongoDB 数据库和 clubs.json 文件中的数据，显示差异分析。

**认证：** 需要有效的管理员 Token

**请求头：**
```
Authorization: Bearer <admin_token>
```

**比较逻辑：**

比较后的结果分类：
- **Identical (完全相同)**：两个数据源中的业务数据完全一致
- **Different (存在差异)**：业务数据存在差异，详见 `differences` 数组
- **DB Only (仅在数据库)**：仅在 MongoDB 中存在的社团
- **JSON Only (仅在 JSON)**：仅在 JSON 文件中存在的社团
- **Conflicts (冲突)**：名称相同但 ID 不同的记录

**返回值：**

**成功响应（HTTP 200）：**
```json
{
  "success": true,
  "data": {
    "stats": {
      "database": {
        "total": 11,      // MongoDB 中的记录总数
        "unique": 11      // 唯一的社团数
      },
      "json": {
        "total": 11,      // JSON 中的记录总数
        "unique": 11      // 唯一的社团数
      },
      "comparison": {
        "identical": 6,   // 完全相同的记录
        "different": 5,   // 存在差异的记录
        "dbOnly": 0,      // 仅在数据库中
        "jsonOnly": 0,    // 仅在 JSON 中
        "conflicts": 0    // ID冲突
      }
    },
    "details": {
      "identical": [
        {
          "club": {
            "id": "6915ce6811d0e830ac187dd6",
            "name": "逻辑机械游创社",
            // ... 其他字段
          },
          "source": "both"
        }
      ],
      "different": [
        {
          "db": {
            "id": "6915ce6811d0e830ac187dd9",
            "name": "游漫社游戏与动漫设计协会",
            // ... 转换后的字段
          },
          "json": {
            "id": "6915ce6811d0e830ac187dd9",
            "name": "游漫社游戏与动漫设计协会",
            // ... JSON 中的字段
          },
          "differences": [
            {
              "field": "external_links",
              "database": [
                {
                  "type": "微博",
                  "url": "https://weibo.com/..."
                }
              ],
              "json": [
                {
                  "type": "微博",
                  "url": "https://weibo.com/..." 
                  // JSON 中没有 _id 字段
                }
              ]
            }
          ]
        }
      ],
      "dbOnly": [],
      "jsonOnly": [],
      "conflicts": []
    }
  }
}
```

**错误响应：**
- `401 Unauthorized` - 未授权或 Token 过期
- `404 Not Found` - clubs.json 文件不存在
- `500 Internal Server Error` - 服务器错误

---

### `POST /api/sync/merge`

**说明：**  
执行双向智能合并，同步 MongoDB 和 JSON 数据：
- 将 JSON 中的修改合并到 MongoDB
- 将 MongoDB 的新数据添加到 JSON
- 保留双方独有的记录

**认证：** 需要有效的管理员 Token

**请求头：**
```
Authorization: Bearer <admin_token>
```

**返回值：**

**成功响应（HTTP 200）：**
```json
{
  "success": true,
  "message": "双向智能合并完成",
  "data": {
    "database": {
      "added": 2,      // JSON 中新增的记录添加到 MongoDB
      "updated": 3     // JSON 中的数据更新 MongoDB 中的记录
    },
    "json": {
      "added": 1,      // MongoDB 中新增的记录添加到 JSON
      "updated": 0,
      "unchanged": 95
    },
    "total": {
      "added": 3,
      "updated": 3,
      "unchanged": 95
    }
  }
}
```

**错误响应：**
- `401 Unauthorized` - 未授权或 Token 过期
- `500 Internal Server Error` - 合并失败

---

### `POST /api/sync/replace`

**说明：**  
执行单向完全替换，用 MongoDB 中的数据完全覆盖 JSON 文件。JSON 中独有的记录将被删除。

**认证：** 需要有效的管理员 Token

**请求头：**
```
Authorization: Bearer <admin_token>
```

**返回值：**

**成功响应（HTTP 200）：**
```json
{
  "success": true,
  "message": "完全替换完成（MongoDB -> JSON）",
  "data": {
    "mode": "replace",
    "total": 100,
    "added": 100,
    "updated": 0,
    "removed": 0,
    "unchanged": 0
  }
}
```

**错误响应：**
- `401 Unauthorized` - 未授权或 Token 过期
- `500 Internal Server Error` - 替换失败

---

## 数据模型

**统一数据格式：**

GameDevMap 采用统一的驼峰命名约定，所有数据源（MongoDB 数据库、clubs.json 文件、API 响应）使用相同的字段命名标准。

---

### `Submission` (提交)

**说明：**  
表示用户提交的社团信息记录，等待管理员审核。

**字段：**

| 字段名 | 类型 | 必填/可选 | 说明 |
|--------|------|----------|------|
| `submissionType` | `string` | 必填 | 提交类型：'new'或'edit' |
| `editingClubId` | `string` | 可选 | 编辑模式下的原社团ID |
| `status` | `string` | 必填 | 状态：'pending'/'approved'/'rejected' |
| `data` | `Object` | 必填 | 社团数据对象（字段结构与Club模型相同） |
| `submitterEmail` | `string` | 必填 | 提交者邮箱 |
| `submittedAt` | `Date` | 自动 | 提交时间 |
| `reviewedAt` | `Date` | 可选 | 审核时间 |
| `reviewedBy` | `string` | 可选 | 审核管理员 |
| `rejectionReason` | `string` | 可选 | 拒绝原因 |

---

### `Club` (社团)

**说明：**  
表示已批准的社团记录，用于前端地图展示和管理后台操作。

采用统一的驼峰命名约定：

| 字段名 | 类型 | 必填/可选 | 说明 |
|--------|------|----------|------|
| `id` | `string` | 必填 | 社团唯一标识（MongoDB ObjectId 的字符串表示）|
| `name` | `string` | 必填 | 社团名称 |
| `school` | `string` | 必填 | 所属学校 |
| `province` | `string` | 必填 | 所在省份 |
| `city` | `string` | 可选 | 所在城市 |
| `coordinates` | `[number, number]` | 必填 | 坐标数组 `[经度, 纬度]` |
| `logo` | `string` | 可选 | Logo 文件名 |
| `shortDescription` | `string` | 可选 | 社团简介（短版本） |
| `description` | `string` | 可选 | 社团详细介绍 |
| `tags` | `Array<string>` | 可选 | 社团标签数组 |
| `externalLinks` | `Array<{type, url}>` | 可选 | 外部链接数组，每项包含 `type` 和 `url`（无 `_id` 字段） |

**数据示例：**

```json
{
  "id": "6915ce6811d0e830ac187dd6",
  "name": "逻辑机械游创社",
  "school": "赣南师范大学科技学院",
  "province": "江西省",
  "city": "赣州市",
  "coordinates": [114.93574, 25.84099],
  "shortDescription": "创意工坊",
  "description": "我们是游戏开发社团",
  "tags": ["游戏开发", "编程"],
  "logo": "logo.png",
  "externalLinks": [
    {
      "type": "飞书主页",
      "url": "https://example.com"
    }
  ]
}
}
```

**数据库字段定义：**

| 字段名 | 类型 | 必填/可选 | 说明 |
|--------|------|----------|------|
| `_id` | `ObjectId` | 自动 | MongoDB 自动生成的唯一标识 |
| `name` | `string` | 必填 | 社团名称 |
| `school` | `string` | 必填 | 所属学校 |
| `province` | `string` | 必填 | 所在省份 |
| `city` | `string` | 可选 | 所在城市 |
| `coordinates` | `Array<number>` | 必填 | 坐标 [经度, 纬度] |
| `shortDescription` | `string` | 可选 | 简介 |
| `description` | `string` | 可选 | 详细介绍 |
| `tags` | `Array<string>` | 可选 | 标签数组 |
| `logo` | `string` | 可选 | Logo文件名 |
| `external_links` | `Array<Object>` | 可选 | 外部链接数组，每项包含 `type` 和 `url` 以及 MongoDB 生成的 `_id` |
| `createdAt` | `Date` | 自动 | 创建时间 |
| `updatedAt` | `Date` | 自动 | 更新时间 |
| `verifiedBy` | `string` | 可选 | 数据验证者（系统内部使用） |

**JSON 文件字段定义：**

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `id` | `string` | 社团唯一标识（与 MongoDB `_id` 对应） |
| `name` | `string` | 社团名称 |
| `school` | `string` | 所属学校 |
| `province` | `string` | 所在省份 |
| `city` | `string` | 所在城市 |
| `latitude` | `number` | 纬度 |
| `longitude` | `number` | 经度 |
| `short_description` | `string` | 简介 |
| `long_description` | `string` | 详细介绍 |
| `tags` | `Array<string>` | 标签数组 |
| `img_name` | `string` | Logo文件名 |
| `external_links` | `Array<Object>` | 外部链接数组（无 `_id` 字段） |

---

### `AdminUser` (管理员)

**说明：**  
系统管理员账户信息。

**字段：**

| 字段名 | 类型 | 必填/可选 | 说明 |
|--------|------|----------|------|
| `username` | `string` | 必填 | 用户名 |
| `password` | `string` | 必填 | 密码哈希 |
| `role` | `string` | 必填 | 角色：'admin' |
| `createdAt` | `Date` | 自动 | 创建时间 |

---

## 错误处理

API 错误响应统一格式：

```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "错误描述信息"
}
```

**常见错误码：**

| 错误码 | HTTP状态码 | 说明 |
|--------|-----------|------|
| `INVALID_ID` | 400 | ID格式不正确 |
| `NOT_FOUND` | 404 | 资源不存在 |
| `INVALID_STATUS` | 409 | 状态不允许操作 |
| `MISSING_REASON` | 400 | 缺少必要参数 |
| `VALIDATION_ERROR` | 400 | 数据验证失败 |
| `SERVER_ERROR` | 500 | 服务器内部错误 |
| `UNAUTHORIZED` | 401 | 未授权访问 |

---

## 延伸阅读

- [数据同步机制](./DATA_SYNC.md) - 数据库与 JSON 文件的同步
- [前端开发指南](./GUIDE.md) - 前端开发和使用说明

---

## 联系方式

如有问题，请联系开发团队或查看项目仓库。
