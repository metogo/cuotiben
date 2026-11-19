import React, { useLayoutEffect, useRef } from 'react';
import LearningText from './LearningText.jsx';
import { Companion } from './UI.jsx';

export default function LiveLesson({ job }) {
  const { hint, detail } = job.preview;
  const status = useRef(null);
  useLayoutEffect(() => {
    status.current.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, []);
  return (
    <section className="live-lesson" aria-label="正在生成的讲解">
      <div className="paper live-hint">
        <div className="hint-byline"><Companion pose="thinking" /><span className="eyebrow">小逗号 · 解题思路</span></div>
        {hint && <p className="preserve"><LearningText text={hint} /></p>}
        <small className="live-status" ref={status} tabIndex="-1" role="status">{job.busy}</small>
      </div>
      {detail && <section className="paper live-solution" aria-label="解题过程">
        <span className="eyebrow">解题过程</span>
        <div className="preserve"><LearningText text={detail} /></div>
      </section>}
    </section>
  );
}
