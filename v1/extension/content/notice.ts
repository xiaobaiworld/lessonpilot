export interface NoticeSection {
  label: string;
  body: string;
}

export interface NoticeSummary {
  eyebrow?: string;
  intro: string;
  sections: NoticeSection[];
  summary: {
    title: string;
    body: string;
  };
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function validSections(value: unknown): NoticeSection[] | null {
  if (!Array.isArray(value) || value.length !== 3) return null;

  const sections = value.map((entry) => {
    const item = entry as Record<string, unknown>;
    return { label: text(item?.label), body: text(item?.body) };
  });

  return sections.every((section) => section.label && section.body) ? sections : null;
}

function structuredSummary(display: Record<string, unknown>): NoticeSummary | null {
  const intro = text(display.intro);
  const sections = validSections(display.sections);
  const rawSummary = display.summary as Record<string, unknown> | undefined;
  const summary = {
    title: text(rawSummary?.title),
    body: text(rawSummary?.body),
  };

  if (!intro || !sections || !summary.title || !summary.body) return null;

  return {
    eyebrow: text(display.eyebrow) || undefined,
    intro,
    sections,
    summary,
  };
}

function legacySummary(body: string): NoticeSummary | null {
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
  const nodeParagraphs = paragraphs.filter((part) => /^第[一二三四五六七八九十]+个节点/.test(part));
  const questionParagraph = paragraphs.find((part) => /^接下来/.test(part));
  const lessonSummary = paragraphs.find((part) => /^本节总结/.test(part));
  const encouragement = paragraphs.find((part) => part === '加油。');

  if (
    paragraphs.length < 4 ||
    nodeParagraphs.length < 5 ||
    !questionParagraph ||
    !lessonSummary
  ) {
    return null;
  }

  const summaryBody = [
    lessonSummary.replace(/^本节总结[：:]\s*/, ''),
    encouragement,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    intro: paragraphs[0],
    sections: [
      {
        label: '先理解',
        body: nodeParagraphs.slice(0, 2).join(' '),
      },
      {
        label: '再练习',
        body: [...nodeParagraphs.slice(2), questionParagraph].join(' '),
      },
      {
        label: '最后巩固',
        body: lessonSummary.replace(/^本节总结[：:]\s*/, ''),
      },
    ],
    summary: {
      title: '本节重点',
      body: summaryBody,
    },
  };
}

export function getNoticeSummary(display: Record<string, unknown>): NoticeSummary | null {
  const structured = structuredSummary(display);
  if (structured) return structured;

  return legacySummary(text(display.body));
}
