import React from 'react';

export interface AuthPanelProps {
  /** 顶部绿色小标签，如 "KnownMap 互动课程工具" */
  eyebrow: string;
  /** 主标题，如 "登录互动课程工具" */
  title: string;
  /** 标题下的说明文字，可省略 */
  description?: string;
  /** 表单提交 */
  onSubmit: (e: React.FormEvent) => void;
  children: React.ReactNode;
  /** 错误文案；为空时不占位 */
  error?: string | null;
}

/**
 * 登录页外壳。
 *
 * 结构与 teacher-web/editor.html 的 #auth-view 一致：
 * section.auth-view > div.auth-panel > p.eyebrow + h1 + form
 * 样式来自 shared/src/styles/auth.css，不在这里写内联样式。
 */
export const AuthPanel: React.FC<AuthPanelProps> = ({
  eyebrow,
  title,
  description,
  onSubmit,
  children,
  error,
}) => (
  <section className="auth-view" aria-labelledby="auth-title">
    <div className="auth-panel">
      <p className="eyebrow">{eyebrow}</p>
      <h1 id="auth-title">{title}</h1>
      {description && <p>{description}</p>}
      <form onSubmit={onSubmit}>{children}</form>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  </section>
);

export interface AuthFieldProps {
  label: string;
  type?: 'text' | 'password' | 'email';
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  disabled?: boolean;
  required?: boolean;
  id: string;
}

/** 单个表单字段，结构对齐原系统的 label.field-group */
export const AuthField: React.FC<AuthFieldProps> = ({
  label,
  type = 'text',
  value,
  onChange,
  autoComplete,
  disabled,
  required = true,
  id,
}) => (
  <label className="field-group" htmlFor={id}>
    <span>{label}</span>
    <input
      id={id}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      autoComplete={autoComplete}
      disabled={disabled}
      required={required}
    />
  </label>
);

export interface PasswordFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  id: string;
}

/**
 * 密码字段，带「显示/隐藏」切换。
 * 原系统有这个能力（#toggle-password），保留它——登录失败时看不见输入内容
 * 是真实的可用性问题。
 */
export const PasswordField: React.FC<PasswordFieldProps> = ({
  label = '密码',
  value,
  onChange,
  disabled,
  id,
}) => {
  const [visible, setVisible] = React.useState(false);

  return (
    <label className="field-group" htmlFor={id}>
      <span>{label}</span>
      <span className="password-input">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="current-password"
          disabled={disabled}
          required
        />
        <button
          type="button"
          className="password-toggle"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? '隐藏密码' : '显示密码'}
          aria-pressed={visible}
        >
          {visible ? '隐藏' : '显示'}
        </button>
      </span>
    </label>
  );
};
