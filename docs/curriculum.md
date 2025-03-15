---
hide:
  - navigation
  - toc
---

# 课表

<div id="curriculum-container">
  <div id="curriculum-form-div" style="display: none;">
    <form id="curriculum-form">
      <div class="curriculum-form-body">
        <div class="curriculum-form-row">
          <div class="">
            <label class="md-input__label">学号：</label>
            <input type="text" id="curriculum-form-username" class="md-input" placeholder="请输入学号">
          </div>
          <div class="">
            <label class="md-input__label">密码：</label>
            <input type="password" id="curriculum-form-password" class="md-input" placeholder="请输入统一认证密码">
          </div>
        </div>
      </div>
      <div class="curriculum-form-helpertext">
        您的账密会只存储至本地，CQU-openlib是纯网页，并不能获取到您的任何个人信息
      </div>
      <div class="curriculum-form-button">
        <button type="submit" class="md-button md-button--primary" aria-label="获取">
          <span class="md-button__content" id="curriculum-form-action-fetch">获取</span>
        </button>
      </div>
    </form>
  </div>
  <div id="curriculum-table-div" style="display: none;">
    <div class="curriculum-table-actions">
      <button type="submit" class="md-button md-button--primary" id="curriculum-table-actions-refresh" aria-label="刷新课表">
        <span class="md-button__content">刷新课表</span>
      </button>
      <button type="submit" class="md-button md-button--primary" id="curriculum-table-actions-reset" aria-label="重置本页">
        <span class="md-button__content">重置本页</span>
      </button>
    </div>
    <div class="curriculum-table-time">
    </div>
  </div>
</div>

- [x] 实现基本功能
- [ ] 重构原生json response版本
- [ ] 实现日历导出功能
- [ ] 课程冲突处理
- [ ] 日期调整按钮


[^1]: 基于[课表-DL444](./skill/推荐使用的网站等/课表.md)
[^2]: 本课表自获取时间24h后自动刷新，请勿频繁手动刷新课表
[^3]: 原生json response版本位于github库curriculum_v2.js内，计划开发完成后替代现有功能，欢迎贡献