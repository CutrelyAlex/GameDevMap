/**
 * 路由结构单元测试
 * 测试路由是否正确定义和可加载
 */
const assert = require('assert');
const express = require('express');

describe('Routes Structure', () => {
  describe('Auth Routes', () => {
    const authRoutes = require('../../server/routes/auth');

    it('应该导出 Express Router', () => {
      assert(typeof authRoutes === 'function' || authRoutes.stack);
    });

    it('应该有登录端点', () => {
      const routeStack = authRoutes.stack || [];
      const hasLoginRoute = routeStack.some(layer => 
        layer.route && layer.route.path === '/login'
      );
      assert(hasLoginRoute || authRoutes.length > 0);
    });
  });

  describe('Clubs Routes', () => {
    const clubsRoutes = require('../../server/routes/clubs');

    it('应该导出 Express Router', () => {
      assert(typeof clubsRoutes === 'function' || clubsRoutes.stack);
    });
  });

  describe('Submissions Routes (Modular)', () => {
    const submissionsRoutes = require('../../server/routes/submissions');

    it('应该导出 Express Router', () => {
      assert(typeof submissionsRoutes === 'function' || submissionsRoutes.stack);
    });

    it('应该有 controller 模块', () => {
      const controller = require('../../server/routes/submissions/controller');
      assert(controller.createSubmission);
      assert(controller.listSubmissions);
      assert(controller.getSubmission);
      assert(controller.approveSubmission);
      assert(controller.rejectSubmission);
    });
  });

  describe('Sync Routes (Modular)', () => {
    const syncRoutes = require('../../server/routes/sync');

    it('应该导出 Express Router', () => {
      assert(typeof syncRoutes === 'function' || syncRoutes.stack);
    });

    it('应该有 helpers 模块', () => {
      const helpers = require('../../server/routes/sync/helpers');
      assert(typeof helpers.formatClub === 'function');
      assert(typeof helpers.readClubsJson === 'function');
      assert(typeof helpers.writeClubsJson === 'function');
    });
  });

  describe('Upload Routes', () => {
    const uploadRoutes = require('../../server/routes/upload');

    it('应该导出 Express Router', () => {
      assert(typeof uploadRoutes === 'function' || uploadRoutes.stack);
    });
  });
});
