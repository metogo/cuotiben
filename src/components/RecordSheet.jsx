import React, { useEffect, useRef } from 'react';
import { Icon } from './UI.jsx';

export default function RecordSheet({ close, photo, text }) {
  const dialog = useRef(null);
  useEffect(() => {
    const node = dialog.current;
    node.showModal();
    return () => node.close();
  }, []);
  return (
    <dialog ref={dialog} className="record-sheet" aria-labelledby="record-heading"
      onClick={e => { if (e.target === dialog.current) close(); }}
      onCancel={e => { e.preventDefault(); close(); }}>
      <div className="record-surface">
        <header><h2 id="record-heading">录题</h2><button className="link" onClick={close}>取消</button></header>
        <div className="record-methods">
          <button onClick={() => photo(true)}><Icon name="camera" />拍照圈题</button>
          <button onClick={() => photo(false)}><Icon name="album" />从相册选</button>
          <button onClick={text}><Icon name="text" />粘贴题目</button>
        </div>
      </div>
    </dialog>
  );
}
