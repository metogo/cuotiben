import React, { useEffect, useState } from 'react';
import { models } from '../../shared/models.js';

export default function ModelPicker({ selected, change }) {
  const [available, setAvailable] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/notebook', { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw Error();
        const body = await response.json();
        if (!Array.isArray(body.models)) throw Error();
        setAvailable(body.models.map((model) => model.id));
      })
      .catch(() => {
        if (!controller.signal.aborted) setAvailable([]);
      });
    return () => controller.abort();
  }, []);
  return (
    <label className="review-model">
      <span className="model-control">
        <select aria-label="讲解模型" value={selected} onChange={(e) => change(e.target.value)}>
          <option value="doubao">豆包</option>
          {models.map((model) => (
            <option key={model.id} value={model.id} disabled={!available?.includes(model.id)}>
              {model.name}
            </option>
          ))}
        </select>
        <span aria-hidden="true" className="select-arrows" />
      </span>
      {available?.length === 0 && <small>其他模型暂不可用</small>}
    </label>
  );
}
