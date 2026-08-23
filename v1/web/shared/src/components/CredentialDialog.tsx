import React, { useState } from 'react';

export interface CredentialDialogProps {
  title: string;
  /** 明文凭据。只在这一次响应里存在，关闭后不可再取 */
  secret: string;
  onClose: () => void;
}

/**
 * 一次性凭据展示。
 *
 * 用粉笔黄边框而非绿色：这是"现在必须处理"的状态，不是完成态。
 * 关闭由调用方负责把 secret 从状态里清掉。
 */
export const CredentialDialog: React.FC<CredentialDialogProps> = ({
  title,
  secret,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
    } catch {
      setCopyError(true);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="credential-panel">
        <h2>{title}</h2>
        <p className="credential-warning">
          只显示这一次，关闭后无法再次查看。请先复制并交给对方。
        </p>
        <div className="credential-row">
          <input
            type="text"
            value={secret}
            readOnly
            aria-label={title}
            onFocus={(e) => e.currentTarget.select()}
          />
          <button className="dark-button" type="button" onClick={copy}>
            {copied ? '已复制' : '复制'}
          </button>
        </div>
        {copyError && (
          <p className="field-error">浏览器拒绝了剪贴板访问，请手动选中复制</p>
        )}
        <div className="credential-actions">
          <button className="light-button" type="button" onClick={onClose}>
            我已保存，关闭
          </button>
        </div>
      </div>
    </div>
  );
};
