import React from 'react';

export interface TopbarProps {
  /** 品牌下方的副标题，如 "互动课程工具" / "管理后台" */
  subtitle: string;
  /** 当前登录者的显示名 */
  account: string;
  onLogout: () => void;
}

/**
 * 顶栏。结构与 teacher-web/editor.html 的 header.topbar 一致。
 *
 * 字标逐字母拆分只为给 K / M 上色（见品牌规范），
 * aria-label 保证读屏器读到完整的 KnownMap。
 */
export const Topbar: React.FC<TopbarProps> = ({ subtitle, account, onLogout }) => (
  <header className="topbar">
    <div className="brand">
      <span>
        <strong aria-label="KnownMap">
          <span className="brand-letter-k" aria-hidden="true">K</span>
          <span aria-hidden="true">nown</span>
          <span className="brand-letter-m" aria-hidden="true">M</span>
          <span aria-hidden="true">ap</span>
        </strong>
        <small>{subtitle}</small>
      </span>
    </div>

    <div className="connection-status">
      <span className="status-dot is-healthy" />
      <span>{account}</span>
      <span className="status-divider" />
      <button className="topbar-action" type="button" onClick={onLogout}>
        退出登录
      </button>
    </div>
  </header>
);

export interface SectionHeadProps {
  title: string;
  /** 标题下的一行补充，如 "共 3 位" */
  count?: string;
  /** 右侧操作按钮 */
  children?: React.ReactNode;
}

export const SectionHead: React.FC<SectionHeadProps> = ({ title, count, children }) => (
  <div className="section-head">
    <div>
      <h2>{title}</h2>
      {count && <span>{count}</span>}
    </div>
    {children && <div className="head-actions">{children}</div>}
  </div>
);
