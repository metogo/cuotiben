export const subjects = {
  chinese: '语文', math: '数学', english: '英语', physics: '物理', chemistry: '化学',
  biology: '生物', history: '历史', geography: '地理', politics: '道德与法治／政治', science: '科学',
};
export function subjectKey(value) {
  return typeof value === 'string' && Object.hasOwn(subjects, value) ? value : 'unknown';
}
export function subjectName(key) {
  return subjects[subjectKey(key)] || '未分类';
}
