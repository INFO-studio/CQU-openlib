---
hide:
  - navigation
  - toc
---

# 课表（正在重构中）

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

<style>
.curriculum-form-body {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1em;
}

.curriculum-form-row {
    display: flex;
    flex-direction: column;
    gap: 0.5em;
}

.curriculum-form-divider {
    min-height: 100%;
    align-self: stretch;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.1em;
    color: var(--md-default-fg-color--light);
    font-size: 0.8em;
}

.curriculum-form-divider::before,
.curriculum-form-divider::after {
    content: "";
    display: block;
    width: 1px;
    flex: 1;
    background-color: var(--md-default-fg-color--light);
}

.curriculum-form-helpertext {
    color: var(--md-default-fg-color--light);
    font-size: 0.8em;
    display: flex;
    justify-content: center;
    margin-top: 0.5em;
}

.curriculum-form-button {
    margin-top: 2em;
    display: flex;
    justify-content: center;
    align-items: center;
}

.curriculum-table-key {
    display: flex;
    justify-content: center;
    align-items: baseline;
    max-width: 100%;
}

.curriculum-table-key>code {
    flex: 1;
    white-space: nowrap;
    overflow: auto;
    scrollbar-width: none;
}

.curriculum-table-actions {
    margin-top: 2em;
    margin-bottom: 2em;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.5em;
}

.curriculum-table-time {
    width: 100%;
    display: flex;
    justify-content: center;
}

.curriculum-table-cell {
    text-align: center !important;
    min-width: 2em;
    position: relative;
    overflow: hidden;
}

.curriculum-table-cell-scheduled {
    background-color: var(--md-typeset-table-color);
}

.curriculum-table-today {
    background-color: color-mix(in srgb, var(--md-default-bg-color) 50%, var(--md-primary-fg-color) 50%);
}

.curriculum-table-today {
    background-color: color-mix(in srgb, var(--md-typeset-table-color) 50%, var(--md-primary-fg-color) 50%);
}

.curriculum-event-flexbox {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    bottom: 0;
    padding: 0.4em 0.4em;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5em;
}

.curriculum-event-title {
    font-weight: bold;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    overflow: hidden;
    line-height: 1.1;
    height: calc(1.1em * 2);
}

.curriculum-event-teacher,
.curriculum-event-classroom {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    width: 100%;
}

.curriculum-event-dialog {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    padding: 20px;
    width: 80vw;
    height: 40vh;
    background-color: var(--md-default-bg-color);
}

.curriculum-event-dialog::backdrop {
    background: rgba(0, 0, 0, 0.3);
}

.curriculum-event-dialog-title {
    font-size: 3em;
    font-weight: bold;
    text-align: center;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    overflow: hidden;
    line-height: 1.2em;
    height: 60%;
}

.curriculum-event-dialog-teacher {
    font-size: 14px;
    margin: 5px 0;
}
</style>