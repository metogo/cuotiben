const questionStart = /^\s*(?:第\s*[一二三四五六七八九十百\d]+\s*[题題][、.．：:]?|\d+\s*[、．]|\d+\.(?!\d))\s*/gmu;
const referenceLabel = /(?:老师的|老師的)?(?:参考答案|參考答案|解析)\s*[：:]/gu;

export function questionChoices(raw) {
  const starts = [...raw.matchAll(questionStart)];
  if (starts.length < 2) return [];
  // A passage or a combined answer key may apply to more than one question.
  // Keep it in the original editor for the parent to allocate explicitly.
  if (raw.slice(0, starts[0].index).trim()) return [];
  const chunks = starts.map((start, i) => raw.slice(start.index, starts[i + 1]?.index).trim());
  const hasReferences = chunks.some((chunk) => Array.from(chunk.matchAll(referenceLabel)).length);
  if (hasReferences && !chunks.every((chunk) => Array.from(chunk.matchAll(referenceLabel)).length === 1)) return [];
  return chunks;
}
export function splitMessage(raw) {
  const stems = [...raw.matchAll(questionStart)];
  const references = [...raw.matchAll(referenceLabel)];
  if (stems.length > 1 || references.filter((label) => /参考答案|參考答案/.test(label[0])).length > 1)
    return { multi: true };
  const label = references[0];
  if (!label) return { q: raw };
  return { q: raw.slice(0, label.index).trim(), teacher: raw.slice(label.index + label[0].length).trim() };
}
// A direct request to read a diagram supplies no measurement by itself. Match only
// the bare question so that an accompanying description or observation remains usable.
function missingDiagram(raw) {
  const question = raw.trim().replace(questionStart, '').replace(/[\s，,。！？?!：:]/gu, '');
  const direct = question.replace(/^(?:如[图圖](?:所示)?|[见見]下[图圖])/u, '').replace(/^(?:[请請](?:[问問]|读出|讀出)?)/u, '');
  if (/^(?:(?:下|上|这|這)[图圖](?:中|的)?)?[阴陰]影(?:部分|区域|區域)?(?:[占佔]|是)(?:全[图圖]|整[个個]?[图圖]形?)(?:的)?(?:几分之几|幾分之幾|多少)$/u.test(direct))
    return '还缺少阴影图。请圈入完整配图，或补上全图平均分成多少份、其中几份涂了色。';
  if (/^(?:(?:下|上|这|這)[图圖](?:中|的)?)?(?:量杯|量筒|温度计|溫度計)(?:中|内|內|里|裡|的)*(?:水位|液面|示数|示數|读数|讀數|水量|温度|溫度)?(?:是|为|為|有)?多少(?:毫升|升|度|摄氏度|攝氏度)?$/u.test(direct))
    return '还缺少刻度图。请圈入刻度和读数位置，或在题目中补齐这些条件。';
  return '';
}
export function missingInput(raw) {
  if (!raw.trim()) return '请先粘贴或输入一道题。';
  if (
    /^(?:请|订正|訂正|完成|重做|做|练习册|練習冊|作业|作業|课本|課本|\s)*第\s*\d+\s*[页頁]\s*第\s*\d+\s*[题題][。.!！\s]*$/u.test(
      raw,
    )
  )
    return '请拍下这道题，或粘贴完整题目。';
  if (raw.length > 8000) return '一道题最多可提交 8000 个字符，请保留该题和必要材料。';
  return missingDiagram(raw);
}
