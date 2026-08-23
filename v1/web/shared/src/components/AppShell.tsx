import React from 'react';

export interface BrandProps {
  /** 副标题，如 "互动课程工具" / "管理后台" */
  subtitle: string;
  onClick?: () => void;
}

/**
 * KnownMap 字标。
 * K 用粉笔黄、M 用赭石红，见 doc/knownmap-brand-lockup-refinement-design.md。
 * 逐字母拆分只为上色，对读屏器用 aria-label 提供完整词。
 */
export const Brand: React.FC<BrandProps> = ({ subtitle, onClick }) => {
  const inner = (
    <>
      <span>
        <strong aria-label="KnownMap">
          <span className="brand-letter-k" aria-hidden="true">K</span>
          <span aria-hidden="true">nown</span>
          <span className="brand-letter-m" aria-hidden="true">M</span>
          <span aria-hidden="true">ap</span>
        </strong>
        <small>{subtitle}</small>
      </span>
    </>
  );

  if (!onClick) {
    return <div className="brand">{inner}</div>;
  }

  return (
    <button className="brand" type="button" onClick={onClick} aria-label="返回首页">
      {inner}
    </button>
  );
};

export interface NavItem {
  key: string;
  label: string;
}

export interface TopbarProps {
  subtitle: string;
  onBrandClick?: () => void;
  nav?: NavItem[];
  activeNav?: string;
  onNavClick?: (key: string) => void;
  /** 当前登录者标识，如登录名或邮箱 */
  account?: string;
  onLogout?: () => void;
}

/** 顶栏。结构对齐 teacher-web/editor.html 的 header.topbar */
export const Topbar: React.FC<TopbarProps> = ({
  subtitle,
  onBrandClick,
  nav,
  activeNav,
  onNavClick,
  account,
  onLogout,
}) => (
  <header className="topbar">
    <Brand subtitle={subtitle} onClick={onBrandClick} />

    {nav && nav.length > 0 && (
      <nav className="topnav" aria-label="主导航">
        {nav.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`nav-link${activeNav === item.key ? ' is-active' : ''}`}
            onClick={() => onNavClick?.(item.key)}
          >
            {item.label}
          </button>
        ))}
      </nav>
    )}

    {account && (
      <div className="connection-status">
        <span className="status-dot is-healthy" />
        <span>{account}</span>
        {onLogout && (
          <>
            <span className="status-divider" />
            <button className="topbar-action" type="button" onClick={onLogout}>
              退出登录
            </button>
          </>
        )}
      </div>
    )}
  </header>
);

export interface PageHeadProps {
  eyebrow?: string;
  title: React.ReactNode;
  lead?: string;
  /** 右侧附注，原系统的 .head-note */
  note?: string;
}

/** 页面主标题区。对齐 .workspace-head */
export const PageHead: React.FC<PageHeadProps> = ({ eyebrow, title, lead, note }) => (
  <div className="workspace-head">
    <div>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      {lead && <p className="lead">{lead}</p>}
    </div>
    {note && (
      <div className="head-note">
        <span className="note-line" aria-hidden="true" />
        <p>{note}</p>
      </div>
    )}
  </div>
);

export interface SectionHeadProps {
  title: string;
  count?: string;
  children?: React.ReactNode;
}

/** 区块标题行，右侧放操作按钮 */
export const SectionHead: React.FC<SectionHeadProps> = ({ title, count, children }) => (
  <div className="section-head">
    <div>
      <h2>{title}</h2>
      {count && <span>{count}</span>}
    </div>
    {children && <div className="head-actions">{children}</div>}
  </div>
);

export interface EmptyStateProps {
  message: string;
  children?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ message, children }) => (
  <div className="table-state">
    {message}
    {children}
  </div>
);
