/**
 * 提交管理 - 业务逻辑层
 */
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Submission = require('../../models/Submission');
const Club = require('../../models/Club');
const { findSimilarClubs } = require('../../utils/duplicateCheck');
const { processApprovedSubmissionFiles } = require('../../utils/fileProcessor');
const syncToJson = require('../../scripts/sync-to-json');
const { SUBMISSIONS_DIR, PENDING_DIR, PROJECT_ROOT } = require('../../config/paths');

/**
 * 删除单个文件
 */
async function deleteFile(filePath) {
  if (!filePath) return;
  const filename = filePath.replace(/^\/assets\/submissions\//, '').split('/').pop();
  const fullPath = path.join(SUBMISSIONS_DIR, filename);
  
  try {
    await fs.promises.access(fullPath);
    await fs.promises.unlink(fullPath);
    console.log(`🗑️  Deleted: ${fullPath}`);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn(`⚠️  Failed to delete ${fullPath}:`, error.message);
    }
  }
}

/**
 * 删除提交的所有文件
 */
async function deleteSubmissionFiles(data) {
  if (!data) return;
  if (data.logo) await deleteFile(data.logo);
  if (data.externalLinks) {
    for (const link of data.externalLinks) {
      if (link.qrcode) await deleteFile(link.qrcode);
    }
  }
}

/**
 * 写入待处理 JSON（备份）
 */
function writePendingJson(data, ipAddress, userAgent, duplicateResult) {
  try {
    if (!fs.existsSync(PENDING_DIR)) {
      fs.mkdirSync(PENDING_DIR, { recursive: true });
    }
    const filename = `${Date.now()}_${Math.random().toString(36).substring(2,10)}.json`;
    const filePath = path.join(PENDING_DIR, filename);
    fs.writeFileSync(filePath, JSON.stringify({
      timestamp: new Date().toISOString(),
      ipAddress,
      userAgent,
      duplicateCheck: duplicateResult,
      submission: { submitterEmail: data.submitterEmail, data, logo: data.logo || '' }
    }, null, 2), 'utf8');
    console.info('Wrote pending submission JSON to', filePath);
  } catch (err) {
    console.warn('Failed to write pending JSON:', err);
  }
}

/**
 * 创建新提交
 */
async function createSubmission(validatedData, metadata) {
  const coordinates = validatedData.coordinates
    ? [Number(validatedData.coordinates.longitude), Number(validatedData.coordinates.latitude)]
    : [];

  let duplicateResult = { passed: true, similarClubs: [] };
  try {
    duplicateResult = await findSimilarClubs(validatedData.name, validatedData.school, coordinates);
  } catch (e) {
    console.warn('Duplicate check failed:', e);
  }

  writePendingJson(validatedData, metadata.ipAddress, metadata.userAgent, duplicateResult);

  const submissionData = {
    submissionType: validatedData.submissionType || 'new',
    submitterEmail: validatedData.submitterEmail,
    data: {
      name: validatedData.name,
      school: validatedData.school,
      province: validatedData.province,
      city: validatedData.city || '',
      coordinates,
      description: validatedData.description || '',
      shortDescription: validatedData.shortDescription || '',
      tags: validatedData.tags || [],
      logo: validatedData.logo || '',
      externalLinks: validatedData.externalLinks || []
    },
    metadata: {
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      duplicateCheck: { passed: duplicateResult.passed, similarClubs: duplicateResult.similarClubs || [] }
    }
  };

  // 编辑模式处理
  if (validatedData.submissionType === 'edit' && validatedData.editingClubId) {
    submissionData.editingClubId = validatedData.editingClubId;
    try {
      let originalClub = null;
      if (mongoose.Types.ObjectId.isValid(validatedData.editingClubId)) {
        originalClub = await Club.findById(validatedData.editingClubId);
      }
      if (!originalClub && validatedData.name && validatedData.school) {
        originalClub = await Club.findOne({ name: validatedData.name, school: validatedData.school });
        if (originalClub) submissionData.editingClubId = originalClub._id.toString();
      }
      if (originalClub) submissionData.originalData = originalClub.toObject();
    } catch (err) {
      console.warn('Error fetching original club:', err);
    }
  }

  const submission = new Submission(submissionData);
  await submission.save();
  return submission;
}

/**
 * 获取提交列表
 */
async function listSubmissions(query) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 10, 1), 50);
  const sortParam = query.sort === 'asc' ? 1 : -1;
  const status = (query.status || '').toLowerCase();

  const filter = {};
  if (status && status !== 'all') filter.status = status;

  const [items, total] = await Promise.all([
    Submission.find(filter).sort({ submittedAt: sortParam }).skip((page - 1) * limit).limit(limit).lean(),
    Submission.countDocuments(filter)
  ]);

  return { items, pagination: { page, limit, totalItems: total, totalPages: total ? Math.ceil(total / limit) : 1 } };
}

/**
 * 获取提交详情
 */
async function getSubmission(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) return { error: 'INVALID_ID' };
  const submission = await Submission.findById(id).lean();
  if (!submission) return { error: 'NOT_FOUND' };
  return { data: submission };
}

/**
 * 批准提交
 */
async function approveSubmission(id, username) {
  if (!mongoose.Types.ObjectId.isValid(id)) return { error: 'INVALID_ID' };

  const submission = await Submission.findById(id);
  if (!submission) return { error: 'NOT_FOUND' };
  if (submission.status !== 'pending') return { error: 'INVALID_STATUS' };

  const coordinates = Array.isArray(submission.data.coordinates)
    ? submission.data.coordinates
    : [Number(submission.data.coordinates?.longitude) || 0, Number(submission.data.coordinates?.latitude) || 0];

  // 处理文件
  let processedData = JSON.parse(JSON.stringify(submission.data));
  try {
    console.log(`\n🔄 处理提交文件 (${submission.data.name})`);
    processedData = await processApprovedSubmissionFiles(processedData, PROJECT_ROOT);
    console.log(`✅ 文件处理完成\n`);
  } catch (err) {
    throw new Error(`文件处理失败: ${err.message}`);
  }

  let club;
  let isNewClub = true;

  // 编辑模式
  if (submission.submissionType === 'edit' && submission.editingClubId) {
    if (mongoose.Types.ObjectId.isValid(submission.editingClubId)) {
      club = await Club.findById(submission.editingClubId);
    }
    if (!club) {
      club = await Club.findOne({ name: submission.data.name, school: submission.data.school });
    }
    if (club) {
      Object.assign(club, {
        name: submission.data.name,
        school: submission.data.school,
        province: submission.data.province,
        city: submission.data.city,
        coordinates,
        description: submission.data.description,
        shortDescription: submission.data.shortDescription || '',
        tags: submission.data.tags,
        logo: processedData.logo || submission.data.logo,
        externalLinks: processedData.externalLinks || submission.data.externalLinks || [],
        verifiedBy: username
      });
      await club.save();
      isNewClub = false;
    }
  }

  // 新建社团
  if (!club) {
    club = new Club({
      name: submission.data.name,
      school: submission.data.school,
      province: submission.data.province,
      city: submission.data.city,
      coordinates,
      description: submission.data.description,
      shortDescription: submission.data.shortDescription || '',
      tags: submission.data.tags,
      logo: processedData.logo || submission.data.logo,
      externalLinks: processedData.externalLinks || submission.data.externalLinks || [],
      sourceSubmission: submission._id,
      verifiedBy: username
    });
    await club.save();
  }

  submission.status = 'approved';
  submission.reviewedAt = new Date();
  submission.reviewedBy = username;
  submission.rejectionReason = undefined;
  await submission.save();

  syncToJson('merge').catch(err => console.error('Sync failed:', err));

  return { data: { submissionId: submission._id, clubId: club._id, isUpdate: !isNewClub } };
}

/**
 * 拒绝提交
 */
async function rejectSubmission(id, username, reason) {
  if (!mongoose.Types.ObjectId.isValid(id)) return { error: 'INVALID_ID' };
  if (!reason?.trim()) return { error: 'MISSING_REASON' };

  const submission = await Submission.findById(id);
  if (!submission) return { error: 'NOT_FOUND' };
  if (submission.status !== 'pending') return { error: 'INVALID_STATUS' };

  submission.status = 'rejected';
  submission.reviewedAt = new Date();
  submission.reviewedBy = username;
  submission.rejectionReason = reason.trim().slice(0, 500);
  await submission.save();

  await deleteSubmissionFiles(submission.data);

  return { data: { submissionId: submission._id } };
}

module.exports = {
  createSubmission,
  listSubmissions,
  getSubmission,
  approveSubmission,
  rejectSubmission,
  deleteSubmissionFiles
};
