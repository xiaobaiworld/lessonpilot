import React from 'react';

export type NodeIconId = 'attention' | 'choice' | 'blank' | 'qa';

export const NODE_ICON_IDS = {
  notice: 'attention',
  choice: 'choice',
  blank: 'blank',
  free_text: 'qa',
} as const satisfies Record<'notice' | 'choice' | 'blank' | 'free_text', NodeIconId>;

type IconElement =
  | { tag: 'path'; d: string }
  | { tag: 'circle'; cx: number; cy: number; r: number };

export const NODE_ICON_DEFINITIONS: Record<
  NodeIconId,
  { viewBox: string; elements: IconElement[] }
> = {
  attention: {
    viewBox: '0 0 20 20',
    elements: [
      { tag: 'path', d: 'M4 15h12M6 12l6-7 3 3-7 6-3 1z' },
    ],
  },
  choice: {
    viewBox: '0 0 20 20',
    elements: [
      { tag: 'circle', cx: 6, cy: 6, r: 2 },
      { tag: 'path', d: 'm5 6 1 1 2-3M10 6h6M4 12h4M10 12h6M4 16h4M10 16h6' },
    ],
  },
  blank: {
    viewBox: '0 0 20 20',
    elements: [
      { tag: 'path', d: 'M3 6h5M12 6h5M3 11h14M7 16h10M3 16h2' },
    ],
  },
  qa: {
    viewBox: '0 0 20 20',
    elements: [
      { tag: 'path', d: 'M4 4h12v9H9l-4 3v-3H4z' },
      { tag: 'path', d: 'M8 7a2 2 0 1 1 2 2v1M10 12h.01' },
    ],
  },
};

export const NodeIcon: React.FC<{
  iconId: NodeIconId;
  className?: string;
  title?: string;
}> = ({ iconId, className = 'node-icon', title }) => {
  const definition = NODE_ICON_DEFINITIONS[iconId];
  return (
    <svg
      className={className}
      viewBox={definition.viewBox}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      aria-label={title}
    >
      {definition.elements.map((element, index) =>
        element.tag === 'circle' ? (
          <circle key={index} cx={element.cx} cy={element.cy} r={element.r} />
        ) : (
          <path key={index} d={element.d} />
        )
      )}
    </svg>
  );
};
