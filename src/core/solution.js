// Upstream validates these four sections before acknowledging completion.
const reminders =
  /^\s*(?:#{1,6}\s*)?(?:[一二三四五六七八九十]+[、.]\s*)?(?:\*\*|__)?(?:易错提醒|易错点|注意事项|检查与提醒|验算与提醒|自检提醒)(?:\*\*|__)?\s*[：:]?/m;
// The service can put a Markdown heading on its own immediately before a numbered list.
export function readingSteps(parts) {
  const steps = [];
  let heading = '';
  for (const part of parts) {
    const text = part.trim();
    if (!text) continue;
    if (/^(?:#{1,6} +[^\n]+|(?:\*\*)?(?:分步推导|解题步骤|推导过程|详细步骤|解答过程|计算过程|证明过程)(?:\*\*)?[：:]?)$/u.test(text)) {
      heading = [heading, text].filter(Boolean).join('\n');
      continue;
    }
    steps.push(heading ? heading + '\n' + text : text);
    heading = '';
  }
  return steps;
}
export function sections(text) {
  const match = reminders.exec(text);
  if (!match) throw Error('完整讲解缺少检查说明，请重新生成。');
  const check = text.slice(match.index + match[0].length).trim();
  const parts = text
    .slice(0, match.index)
    .trim()
    .split(
      /\n(?=\s*(?:#{1,6}\s+|(?:\*\*)?(?:\d+[、.)]|第[一二三四五六七八九十\d]+步|步骤\s*[一二三四五六七八九十\d]+)))/,
    )
    .filter(Boolean);
  const steps = readingSteps(parts);
  if (!check || !steps.length) throw Error('模型返回的讲解不完整。');
  return { steps, check };
}
