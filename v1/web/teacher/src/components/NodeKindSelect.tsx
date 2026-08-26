import React, { useEffect, useRef, useState } from 'react';
import { NODE_ICON_IDS, NodeIcon } from '@v1/web/shared/editor';
import { NodeKind, ScriptNode } from '../api';
import { NODE_KINDS, changeNodeKind } from '../nodes';

interface Props {
  node: ScriptNode;
  disabled: boolean;
  onChange: (node: ScriptNode) => void;
}

export const NodeKindSelect: React.FC<Props> = ({ node, disabled, onChange }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = NODE_KINDS.find((item) => item.kind === node.interaction) ?? NODE_KINDS[0];

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const choose = (kind: NodeKind) => {
    onChange(changeNodeKind(node, kind));
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={`node-kind-select node-kind-${current.kind}`}>
      <button
        type="button"
        className="node-kind-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
      >
        <NodeIcon iconId={NODE_ICON_IDS[current.kind]} />
        <span>{current.label}</span>
        <span className="node-kind-chevron" aria-hidden="true">⌄</span>
      </button>
      {open && (
        <div className="node-kind-menu" role="listbox" aria-label="节点类型选项">
          {NODE_KINDS.map((item) => (
            <button
              key={item.kind}
              type="button"
              role="option"
              aria-selected={item.kind === node.interaction}
              className={`node-kind-option node-kind-${item.kind}`}
              onClick={() => choose(item.kind)}
            >
              <NodeIcon iconId={NODE_ICON_IDS[item.kind]} />
              <span>{item.label}</span>
              {item.kind === node.interaction && <span className="node-kind-check" aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
