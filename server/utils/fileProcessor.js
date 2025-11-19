/**
 * 文件处理工具 - 处理已批准提交的图片文件
 * 将submission中的文件移动到相应的assets目录并进行压缩
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

/**
 * 处理已批准提交的所有文件
 * @param {Object} clubData - 社团数据对象
 * @param {string} projectRoot - 项目根目录
 * @returns {Object} 更新后的clubData（含新的文件路径）
 */
async function processApprovedSubmissionFiles(clubData, projectRoot) {
  const updatedData = { ...clubData };
  
  try {
    // 处理 Logo
    if (clubData.logo) {
      updatedData.logo = await processLogoFile(clubData.logo, projectRoot);
    }
    
    // 处理外部链接中的 QR Code
    if (clubData.externalLinks && Array.isArray(clubData.externalLinks)) {
      updatedData.externalLinks = await Promise.all(
        clubData.externalLinks.map(link => processExternalLink(link, projectRoot))
      );
    }
    
    return updatedData;
  } catch (error) {
    console.error(`文件处理失败 ${clubData.name}:`, error.message);
    throw error;
  }
}

/**
 * 处理Logo文件：移动到assets/logos，创建压缩版本到assets/compressedLogos
 * @param {string} logoPath - 原始logo路径（可能是 /assets/submissions/... 或 files/...）
 * @param {string} projectRoot - 项目根目录
 * @returns {string} 最终的logo文件名（不含路径）
 */
async function processLogoFile(logoPath, projectRoot) {
  // 提取文件名
  let filename = logoPath;
  if (logoPath.includes('/')) {
    filename = logoPath.split('/').pop();
  }
  
  // 源文件路径（在submissions目录中）
  const sourceLogoPath = path.join(projectRoot, 'data', 'submissions', filename);
  
  // 目标路径（assets/logos）
  const targetLogoDir = path.join(projectRoot, 'public', 'assets', 'logos');
  const targetLogoPath = path.join(targetLogoDir, filename);
  
  // 压缩版本路径（assets/compressedLogos）
  const compressedLogoDir = path.join(projectRoot, 'public', 'assets', 'compressedLogos');
  const ext = path.extname(filename);
  const basename = path.basename(filename, ext);
  const compressedLogoPath = path.join(compressedLogoDir, `${basename}.png`);
  
  try {
    // 检查源文件是否存在（submissions目录）
    let sourceExists = fs.existsSync(sourceLogoPath);
    let actualSourcePath = sourceLogoPath;
    
    // 如果源文件不存在，检查是否已经在目标位置（编辑模式）
    if (!sourceExists && fs.existsSync(targetLogoPath)) {
      console.log(`ℹ️ Logo文件已在目标位置，使用现有文件: ${filename}`);
      actualSourcePath = targetLogoPath;
      sourceExists = true;
    }
    
    if (!sourceExists) {
      console.warn(`⚠️ Logo源文件不存在: ${sourceLogoPath}`);
      return filename; // 返回原始文件名，至少不会破坏数据
    }
    
    // 确保目标目录存在
    if (!fs.existsSync(targetLogoDir)) {
      fs.mkdirSync(targetLogoDir, { recursive: true });
    }
    if (!fs.existsSync(compressedLogoDir)) {
      fs.mkdirSync(compressedLogoDir, { recursive: true });
    }
    
    // 移动原始文件到assets/logos（如果还不在那里）
    if (actualSourcePath !== targetLogoPath && !fs.existsSync(targetLogoPath)) {
      fs.copyFileSync(actualSourcePath, targetLogoPath);
    }
    
    // 创建压缩版本（转换为PNG，质量80%）
    try {
      const sharpInstance = sharp(actualSourcePath);
      await sharpInstance
        .png({ quality: 80 })
        .toFile(compressedLogoPath);
    } catch (sharpError) {
      console.warn(`⚠️ 无法压缩Logo (继续使用原始文件): ${sharpError.message}`);
      // 如果压缩失败，至少复制一份到压缩目录
      if (!fs.existsSync(compressedLogoPath)) {
        fs.copyFileSync(actualSourcePath, compressedLogoPath.replace('.png', ext));
      }
    }
    
    return filename;
  } catch (error) {
    console.error(`❌ Logo处理失败: ${error.message}`);
    throw error;
  }
}

/**
 * 处理外部链接中的QR Code
 * @param {Object} link - 外部链接对象 { type, url?, qrcode? }
 * @param {string} projectRoot - 项目根目录
 * @returns {Object} 处理后的链接对象
 */
async function processExternalLink(link, projectRoot) {
  const updatedLink = { ...link };
  
  if (!link.qrcode) {
    return updatedLink; // 没有QR Code，直接返回
  }
  
  try {
    // 提取文件名
    let filename = link.qrcode;
    if (link.qrcode.includes('/')) {
      filename = link.qrcode.split('/').pop();
    }
    
    
    // 源文件路径
    const sourceQrPath = path.join(projectRoot, 'data', 'submissions', filename);
    
    // 目标路径（assets/qrcodes）
    const targetQrDir = path.join(projectRoot, 'public', 'assets', 'qrcodes');
    const targetQrPath = path.join(targetQrDir, filename);
    
    // 检查源文件是否存在
    if (!fs.existsSync(sourceQrPath)) {
      console.warn(`⚠️ QR Code源文件不存在: ${sourceQrPath}`);
      return updatedLink;
    }
    
    // 确保目标目录存在
    if (!fs.existsSync(targetQrDir)) {
      fs.mkdirSync(targetQrDir, { recursive: true });
    }
    
    // 移动文件到assets/qrcodes
    if (!fs.existsSync(targetQrPath)) {
      fs.copyFileSync(sourceQrPath, targetQrPath);
    } else {
      console.log(`ℹ️ QR Code已存在于assets/qrcodes: ${filename}`);
    }
    
    // 更新路径
    updatedLink.qrcode = filename;
    
    return updatedLink;
  } catch (error) {
    console.error(`❌ QR Code处理失败: ${error.message}`);
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
    // 不抛出异常，因为这是可选操作
  }
}

module.exports = {
  processApprovedSubmissionFiles,
  processLogoFile,
  processExternalLink,
  cleanupSubmissionFiles
};
