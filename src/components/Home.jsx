import React, { useEffect, useRef, useState } from 'react';
import { Companion, Icon, MistakeCount } from './UI.jsx';
import StorageInfo from './StorageInfo.jsx';
import LearningText from './LearningText.jsx';
import { corrected } from '../core/book.ts';
import { subjects, subjectKey, subjectName } from '../../shared/subjects.js';

const shortDate = new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' });

function NotebookHeader({ record }) {
  return (
    <header className="notebook-title">
      <div className="book-heading">
        <Companion />
        <h1 id="book-title">错题本</h1>
      </div>
      <button type="button" className="record-trigger" onClick={record}>
        <Icon name="pencil" />录题
      </button>
    </header>
  );
}

function ListEndFade() {
  const end = useRef(null);
  const [moreBelow, setMoreBelow] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      setMoreBelow(entry.boundingClientRect.bottom > entry.rootBounds.bottom);
    }, { threshold: 1 });
    observer.observe(end.current);
    return () => observer.disconnect();
  }, []);
  return <>
    <span ref={end} className="list-end-marker" aria-hidden="true" />
    {moreBelow && <span className="list-end-fade" aria-hidden="true" />}
  </>;
}

function QuestionList({ visible, emptyBook, open, reset }) {
  if (!visible.length) return (
    <div className="empty-book">
      {emptyBook && <Companion pose="idle" />}
      <h3>{emptyBook ? '还没有收录的错题' : '当前筛选下没有错题'}</h3>
      {emptyBook ? <p>点「录题」，记下第一道错题。</p> : <button className="link" onClick={reset}>查看全部错题</button>}
    </div>
  );
  return <div className="list">{visible.map(row => {
    const done = corrected(row);
    return <article className="notebook-row" key={row.id}>
      <button className="sheet-row" onClick={() => open(row)}>
        <span className="text"><strong><LearningText text={row.q} /></strong>
          <span className="question-meta">
            <small>{subjectName(row.subject)} · {shortDate.format(row.date)}</small>
            <span className={'state ' + (done ? 'finished' : '')}>{done ? '已订正' : '待订正'}</span>
            <MistakeCount count={row.mistakeCount} />
          </span>
        </span>
      </button>
      {!done && <button type="button" className="quick-correct" onClick={() => open(row, 'correct')}>
        去订正<Icon name="right" />
      </button>}
    </article>;
  })}<ListEndFade /></div>;
}

export default function Home({ rows, loading, open, record, error, filter, selectFilter, subject, selectSubject }) {
  const present = new Set(rows.map(row => subjectKey(row.subject)));
  if (subject !== 'all') present.add(subject);
  const grouped = subject === 'all' ? rows : rows.filter(row => subjectKey(row.subject) === subject);
  const finished = grouped.filter(corrected).length;
  const counts = { 全部: grouped.length, 待订正: grouped.length - finished, 已订正: finished };
  const visible = grouped.filter(row => filter === '全部' || corrected(row) === (filter === '已订正'));
  return (
    <>
      <section className="notebook-home" aria-labelledby="book-title">
        <NotebookHeader record={record} />
        <div className="notebook-library">
          <div className="notebook-toolbar">
            <div className="filters" role="group" aria-label="订正状态">
              {Object.entries(counts).map(([name, count]) => <button key={name} aria-pressed={filter === name}
                onClick={() => selectFilter(name)}>{name} <b>{loading || error ? '—' : count}</b></button>)}
            </div>
            {rows.length > 0 && <div className="library-order">
            <select className="subject-filter" aria-label="按学科筛选" value={subject} onChange={e => selectSubject(e.target.value)}>
              <option value="all">全部学科</option>
              {[...Object.keys(subjects), 'unknown'].filter(id => present.has(id)).map(id =>
                <option key={id} value={id}>{subjectName(id)}</option>)}
            </select>
            <small>最近收录在前</small>
            </div>}
          </div>
          {error ? <p className="alert" role="alert">{error}</p> : loading ?
            <p role="status">正在读取错题本…</p> :
            <QuestionList visible={visible} emptyBook={!rows.length} open={open}
              reset={() => { selectSubject('all'); selectFilter('全部'); }} />}
        </div>
      </section>
      <StorageInfo />
    </>
  );
}
