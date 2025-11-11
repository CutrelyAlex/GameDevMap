const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

/**
 * 移动图片从 submissions 到 logos 目录，并执行压缩
 * @param {string} logoPath - 图片路径，格式如 "/assets/submissions/xxx.png" 或 "xxx.png"
 * @returns {Promise<string>} 返回处理后的文件名（不含路径）
 */
async function processApprovedImage(logoPath) {
  if (!logoPath || typeof logoPath !== 'string') {
    throw new Error('Invalid logo path');
  }

  // 提取文件名
  let filename;
  if (logoPath.startsWith('/assets/submissions/')) {
    filename = path.basename(logoPath);
  } else if (logoPath.startsWith('/')) {
    filename = path.basename(logoPath);
  } else {
    filename = logoPath;
  }

  // 定义路径
  const projectRoot = path.resolve(__dirname, '../..');
  const sourcePath = path.join(projectRoot, 'data', 'submissions', filename);
  const targetPath = path.join(projectRoot, 'public', 'assets', 'logos', filename);

  try {
    // 检查源文件是否存在
    try {
      await fs.access(sourcePath);
    } catch (error) {
      console.log(`⚠️  Source file not found: ${sourcePath}, skipping image processing`);
      // 如果源文件不存在，返回原文件名（可能已经在 logos 目录）
      return filename;
    }

    // 确保目标目录存在
    await fs.mkdir(path.dirname(targetPath), { recursive: true });

    // 移动文件到 logos 目录
    await fs.rename(sourcePath, targetPath);
    console.log(`✅ Moved image: ${sourcePath} -> ${targetPath}`);

    // 执行压缩脚本
    const compressScript = path.join(projectRoot, 'scripts', 'compress_images.py');
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    
    try {
      const { stdout, stderr } = await execAsync(
        `${pythonCmd} "${compressScript}" "${filename}"`,
        { cwd: projectRoot, timeout: 30000 }
      );
      
      if (stdout) {
        console.log('Image compression output:', stdout.trim());
      }
      if (stderr) {
        console.warn('⚠️  Compression warnings:', stderr.trim());
      }
      console.log('✅ Image compressed successfully');
    } catch (compressError) {
      console.error('❌ Image compression failed:', compressError.message);
    }

    // 返回文件名（前端会自动尝试从 compressedLogos 加载，失败则回退到 logos）
    console.log(`✅ Image processing complete. Returning filename: ${filename}`);
    return filename;
  } catch (error) {
    console.error('❌ Image processing error:', error);
    throw new Error(`Failed to process image: ${error.message}`);
  }
}

/**
 * 批量处理图片（用于迁移现有数据）
 */
async function batchProcessImages() {
  const projectRoot = path.resolve(__dirname, '../..');
  const submissionsDir = path.join(projectRoot, 'data', 'submissions');
  
  try {
    const files = await fs.readdir(submissionsDir);
    const imageFiles = files.filter(file => 
      /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(file)
    );

    console.log(`Found ${imageFiles.length} images to process`);

    for (const file of imageFiles) {
      try {
        await processApprovedImage(file);
      } catch (error) {
        console.error(`Failed to process ${file}:`, error.message);
      }
    }

    console.log('✅ Batch processing completed');
  } catch (error) {
    console.error('❌ Batch processing failed:', error);
    throw error;
  }
}

module.exports = {
  processApprovedImage,
  batchProcessImages
};
