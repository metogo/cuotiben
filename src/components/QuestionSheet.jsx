import React from 'react';
import LearningText from './LearningText.jsx';

export function OriginalPhoto({ image, children }) {
  return (
    <details className="original-photo">
      <summary>查看原图</summary>
      <img className="proof" src={image} alt="保存的本题选区" />
      {children}
    </details>
  );
}

export default function QuestionSheet({ question, label = '原题', metadata, children }) {
  return (
    <article className="paper question-sheet">
      {metadata ?? <div className="sheet-heading">
        <span>
          {label}
        </span>
      </div>}
      {children ?? <p className="stem">
        <LearningText text={question.q} />
      </p>}
      {question.img && <OriginalPhoto image={question.img} />}
    </article>
  );
}
