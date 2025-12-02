/**
 * 文件处理工具 - 处理已批准提交的图片文件
 * 将submission中的文件移动到相应的assets目录并进行压缩
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

/**
 * 通用文件处理函数 - 将文件从 submissions 目录移动到目标目录
 * @param {string} filePath - 原始文件路径（可能是 /assets/submissions/... 或仅文件名）
 * @param {string} projectRoot - 项目根目录
 * @param {Object} options - 处理选项
 * @param {string} options.targetDir - 目标目录相对路径（如 'public/assets/logos'）
 * @param {string} [options.compressedDir] - 压缩版本目录（可选，如 'public/assets/compressedLogos'）
 * @param {boolean} [options.compress=false] - 是否创建压缩版本
 * @returns {Promise<string>} 最终的文件名（不含路径）
 */
async function processFile(filePath, projectRoot, options) {
  const { targetDir, compressedDir, compress = false } = options;
  
  // 提取文件名
  let filename = filePath;
  if (filePath.includes('/')) {
    filename = filePath.split('/').pop();
  }
  
  // 源文件路径（在 data/submissions 目录中）
  const sourceFilePath = path.join(projectRoot, 'data', 'submissions', filename);
  
  // 目标路径
  const targetDirPath = path.join(projectRoot, targetDir);
  const targetFilePath = path.join(targetDirPath, filename);
  
  try {
    // 检查源文件是否存在
    let sourceExists = fs.existsSync(sourceFilePath);
    let actualSourcePath = sourceFilePath;
    
    // 如果源文件不存在，检查是否已经在目标位置（编辑模式）
    if (!sourceExists && fs.existsSync(targetFilePath)) {
      console.log(`ℹ️ 文件已在目标位置: ${filename}`);
      actualSourcePath = targetFilePath;
      sourceExists = true;
    }
    
    if (!sourceExists) {
      console.warn(`⚠️ 源文件不存在: ${sourceFilePath}`);
      return filename; // 返回原始文件名，不破坏数据
    }
    
    // 确保目标目录存在
    if (!fs.existsSync(targetDirPath)) {
      fs.mkdirSync(targetDirPath, { recursive: true });
    }
    
    // 移动文件到目标目录（如果还不在那里）
    if (actualSourcePath !== targetFilePath && !fs.existsSync(targetFilePath)) {
      fs.copyFileSync(actualSourcePath, targetFilePath);
    }
    
    // 创建压缩版本（如果需要）
    if (compress && compressedDir) {
      const compressedDirPath = path.join(projectRoot, compressedDir);
      const ext = path.extname(filename);
      const basename = path.basename(filename, ext);
      const compressedFilePath = path.join(compressedDirPath, `${basename}.png`);
      
      // 确保压缩目录存在
      if (!fs.existsSync(compressedDirPath)) {
        fs.mkdirSync(compressedDirPath, { recursive: true });
      }
      
      try {
        await sharp(actualSourcePath)
          .png({ quality: 80 })
          .toFile(compressedFilePath);
      } catch (sharpError) {
        console.warn(`⚠️ 压缩失败，使用原始文件: ${sharpError.message}`);
        // 压缩失败时复制原始文件
        if (!fs.existsSync(compressedFilePath)) {
          fs.copyFileSync(actualSourcePath, compressedFilePath.replace('.png', ext));
        }
      }
    }
    
    return filename;
  } catch (error) {
    console.error(`❌ 文件处理失败: ${error.message}`);
    throw error;
  }
}

/**
 * 处理已批准提交的所有文件
 * @param {Object} clubData - 社团数据对象
 * @param {string} projectRoot - 项目根目录
 * @returns {Object} 更新后的clubData（含新的文件路径）
 */
async function processApprovedSubmissionFiles(clubData, projectRoot) {
  const updatedData = { ...clubData };
  
  try {
    // 处理 Logo（带压缩）
    if (clubData.logo) {
      updatedData.logo = await processFile(clubData.logo, projectRoot, {
        targetDir: 'public/assets/logos',
        compressedDir: 'public/assets/compressedLogos',
        compress: true
      });
    }
    
    // 处理外部链接中的 QR Code（不压缩）
    if (clubData.externalLinks && Array.isArray(clubData.externalLinks)) {
      updatedData.externalLinks = await Promise.all(
        clubData.externalLinks.map(async (link) => {
          if (!link.qrcode) return link;
          
          const processedFilename = await processFile(link.qrcode, projectRoot, {
            targetDir: 'public/assets/qrcodes',
            compress: false
          });
          
          return { ...link, qrcode: processedFilename };
        })
      );
    }
    
    return updatedData;
  } catch (error) {
    console.error(`文件处理失败 ${clubData.name}:`, error.message);
    throw error;
  }
}

/**
 * 清理临时文件（可选）
 * 批准后可以删除 data/submissions 中的文件
 */
async function cleanupSubmissionFiles(clubData, projectRoot) {
  try {
    if (clubData.logo) {
      const logoFilename = clubData.logo.split('/').pop();
      const logoPath = path.join(projectRoot, 'data', 'submissions', logoFilename);
      if (fs.existsSync(logoPath)) {
        fs.unlinkSync(logoPath);
      }
    }
    
    if (clubData.externalLinks) {
      for (const link of clubData.externalLinks) {
        if (link.qrcode) {
          const qrcodeFilename = link.qrcode.split('/').pop();
          const qrcodePath = path.join(projectRoot, 'data', 'submissions', qrcodeFilename);
          if (fs.existsSync(qrcodePath)) {
            fs.unlinkSync(qrcodePath);
          }
        }
      }
    }
  } catch (error) {
    console.warn(`⚠️ 清理临时文件时出错: ${error.message}`);
  }
}

module.exports = {
  processFile,
  processApprovedSubmissionFiles,
  cleanupSubmissionFiles
};
