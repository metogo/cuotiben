import React, { lazy, Suspense } from 'react';
import { formulaParts } from '../core/formulas.js';

const Formula = lazy(() =>
  import('./Formula.jsx').catch(() => ({
    default: ({ source }) => <span title="公式排版未加载，显示原式">{source}</span>,
  })),
);

function prose(value) {
  return value.split(/(\*\*[^*]+\*\*|^#{1,6} [^\n]+)/gm).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (/^#{1,6} /.test(part)) return <strong key={i}>{part.replace(/^#{1,6} /, '')}</strong>;
    return part;
  });
}
export default function LearningText({ text }) {
  return formulaParts(text).map((part, i) =>
    part.formula ? (
      <Suspense key={i} fallback={<span className="formula-loading" role="img" aria-label="正在排版公式" />}>
        <Formula source={part.formula} display={part.display} />
      </Suspense>
    ) : (
      <React.Fragment key={i}>{prose(part.text)}</React.Fragment>
    ),
  );
}
