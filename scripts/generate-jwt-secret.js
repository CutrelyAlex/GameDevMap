const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 生成 32 字节的随机密钥（256 位）
const jwtSecret = crypto.randomBytes(32).toString('hex');

console.log('生成的 JWT_SECRET:', jwtSecret);

// 检查 .env 文件是否存在
const envPath = path.join(__dirname, '..', '.env');
const envExamplePath = path.join(__dirname, '..', '.env.example');

if (fs.existsSync(envPath)) {
  // 读取现有 .env 文件
  let envContent = fs.readFileSync(envPath, 'utf8');

  // 替换或添加 JWT_SECRET
  if (envContent.includes('JWT_SECRET=')) {
    envContent = envContent.replace(/JWT_SECRET=.*/, `JWT_SECRET=${jwtSecret}`);
  } else {
    envContent += `\nJWT_SECRET=${jwtSecret}`;
  }

  fs.writeFileSync(envPath, envContent);
  console.log('已更新 .env 文件中的 JWT_SECRET');
} else if (fs.existsSync(envExamplePath)) {
  // 如果 .env 不存在，从 .env.example 复制并更新
  let envContent = fs.readFileSync(envExamplePath, 'utf8');
  envContent = envContent.replace(/JWT_SECRET=.*/, `JWT_SECRET=${jwtSecret}`);

  fs.writeFileSync(envPath, envContent);
  console.log('已从 .env.example 创建 .env 文件并设置 JWT_SECRET');
} else {
  // 创建基本的 .env 文件
  const basicEnv = `JWT_SECRET=${jwtSecret}\n`;
  fs.writeFileSync(envPath, basicEnv);
  console.log('已创建新的 .env 文件并设置 JWT_SECRET');
}

console.log('JWT 配置自动化完成！');