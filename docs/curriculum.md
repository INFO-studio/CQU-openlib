---
hide:
  - navigation
  - toc
---

# 课表

## 暂时正在测试新版本，敬请期待

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