// Editable artwork in a 96 × 96 composition. Times are authored in 60 fps frames.
import { writeFileSync } from 'node:fs';
const ink = '#175c50',
  sage = '#6b9a85',
  paper = '#eef6ee',
  accent = '#d49642';
const color = (hex) =>
  hex
    .slice(1)
    .match(/../g)
    .map((c) => parseInt(c, 16) / 255);
const prop = (k) => ({ a: 0, k });
function tween(stops) {
  return {
    a: 1,
    k: stops.map(([t, s], i) =>
      i === stops.length - 1
        ? { t, s }
        : { t, s, e: stops[i + 1][1], o: { x: [0.25], y: [0.08] }, i: { x: [0.2], y: [1] } },
    ),
  };
}
const zero = prop([0, 0, 0]);
function shape(points, closed, fill, stroke, width = 2) {
  const tangents = points.map(() => [0, 0]);
  const parts = [{ ty: 'sh', ks: prop({ i: tangents, o: tangents, v: points, c: closed }) }];
  if (fill) parts.push({ ty: 'fl', c: prop(color(fill)), o: prop(100), r: 1 });
  if (stroke) parts.push({ ty: 'st', c: prop(color(stroke)), o: prop(100), w: prop(width), lc: 2, lj: 2 });
  return parts;
}
function layer(name, shapes, transform = {}) {
  return {
    ty: 4,
    nm: name,
    sr: 1,
    ip: 0,
    op: 60,
    st: 0,
    ks: { o: prop(100), r: prop(0), p: zero, a: zero, s: prop([100, 100, 100]), ...transform },
    shapes,
  };
}
const slip = [
  [32, 20],
  [58, 17],
  [64, 50],
  [37, 54],
];
const pocket = [
  [22, 44],
  [71, 41],
  [68, 72],
  [29, 75],
];
const leaf = [
  [30, 19],
  [66, 22],
  [63, 77],
  [24, 73],
];
const silk = [
  [52, 18],
  [65, 20],
  [61, 53],
  [56, 47],
  [48, 51],
];
const check = [
  [25, 50],
  [40, 63],
  [70, 30],
];
const checkStroke = shape(check, false, null, '#328777', 7);
const dash = {
  ty: 'tm',
  s: prop(0),
  e: tween([
    [1, [0]],
    [8, [34]],
    [23, [100]],
  ]),
  o: prop(0),
  m: 1,
};
const line = (a, b, col, width = 2) => shape([a, b], false, null, col, width);
const slide = {
  p: tween([
    [0, [5, -8, 0]],
    [5, [6, -12, 0]],
    [20, [0, 3, 0]],
    [29, [0, 1, 0]],
  ]),
};
const collected = [
  layer('前袋压线', line([29, 61], [63, 58], '#79b4dc', 1)),
  layer('前袋亮边', line([24, 45], [69, 42], '#f3ffff')),
  layer('透蓝前袋', shape(pocket, true, '#87baa8', ink)),
  layer('纸上第二行', line([38, 35], [54, 33], sage), slide),
  layer('纸上第一行', line([37, 29], [48, 28], sage), slide),
  layer(
    '折起的纸角',
    shape(
      [
        [51, 18],
        [58, 17],
        [59, 24],
      ],
      true,
      '#e5e1ff',
      ink,
      1,
    ),
    slide,
  ),
  layer('错题纸页', shape(slip, true, paper, ink), slide),
  layer(
    '书本内封',
    shape(
      [
        [25, 28],
        [67, 24],
        [70, 67],
        [27, 73],
      ],
      true,
      '#528b7c',
      ink,
    ),
  ),
  layer(
    '纸袋投影',
    shape(
      [
        [25, 68],
        [69, 65],
        [69, 76],
        [30, 79],
      ],
      true,
      '#c7d9ec',
    ),
  ),
];
const glint = check.map(([x, y]) => [x - 0.5, y - 0.8]);
const corrected = [
  layer('对勾透光亮边', [...shape(glint, false, null, '#b8f6de', 2), dash]),
  layer('一笔写出的对勾', [...checkStroke, dash]),
];
for (let i = 0; i < 6; i++) {
  const angle = (i * Math.PI) / 3,
    dx = Math.cos(angle),
    dy = Math.sin(angle);
  corrected.push(
    layer(
      '收笔光点 ' + (i + 1),
      line([48 + 32 * dx, 48 + 32 * dy], [48 + 36 * dx, 48 + 36 * dy], i % 2 ? accent : sage),
      {
        p: tween([
          [12, [0, 0, 0]],
          [34, [dx * 5, dy * 5, 0]],
        ]),
        o: tween([
          [0, [0]],
          [12 + (i % 3), [0]],
          [19 + (i % 3), [85]],
          [38, [0]],
        ]),
      },
    ),
  );
}
const again = [
  layer('可找回的书签', shape(silk, true, '#dfa851', '#8174bc', 1), {
    p: tween([
      [0, [0, -9, 0]],
      [4, [0, -10, 0]],
      [19, [0, 1, 0]],
      [23, [0, 0, 0]],
    ]),
  }),
  layer('题页第二行', line([32, 61], [44, 62], sage)),
  layer('题页第一行', line([32, 53], [45, 54], sage)),
  layer('保留的题页', shape(leaf, true, paper, ink)),
];
const path = (pts, closed, fill, stroke, w = 2) =>
  '<path d="M' +
  pts.map((p) => p.join(' ')).join(' L') +
  (closed ? ' Z' : '') +
  '" fill="' +
  (fill || 'none') +
  '" stroke="' +
  (stroke || 'none') +
  '" stroke-width="' +
  w +
  '" stroke-linecap="round" stroke-linejoin="round"/>';
function endValue(property) {
  return property.a ? property.k.at(-1).s : property.k;
}
function staticLayer(l) {
  if (Number(endValue(l.ks.o)) === 0) return '';
  const [x, y] = endValue(l.ks.p),
    items = l.shapes;
  const shape = items.find((item) => item.ty === 'sh').ks.k;
  const fill = items.find((item) => item.ty === 'fl'),
    stroke = items.find((item) => item.ty === 'st');
  const hex = (item) =>
    item &&
    '#' +
      item.c.k
        .map((c) =>
          Math.round(c * 255)
            .toString(16)
            .padStart(2, '0'),
        )
        .join('');
  return (
    path(
      shape.v.map(([px, py]) => [px + x, py + y]),
      shape.c,
      hex(fill),
      hex(stroke),
      stroke?.w.k,
    )
  );
}
// The cover opens, the ruled lines appear, then the bookmark settles.
const opening = [
  layer('落下的书签', shape([[62,24],[70,23],[70,43],[66,39],[62,44]], true, '#d7973d'), {
    p: tween([[0,[0,-8,0]], [12,[0,-8,0]], [27,[0,1,0]], [35,[0,0,0]]]),
    o: tween([[0,[0]], [10,[0]], [18,[100]]]),
  }),
  layer('内页第一行', [...line([23,40],[40,44],ink,3), dash]),
  layer('内页第二行', [...line([23,49],[36,52],sage,3), dash]),
  layer('右页', shape([[48,28],[80,21],[80,68],[48,76]],true,'#c6e4d7',ink,3),
    {p:tween([[0,[-10,3,0]], [19,[1,0,0]], [29,[0,0,0]]])}),
  layer('左页', shape([[15,21],[48,28],[48,76],[15,68]],true,paper,ink,3)),
];
const posters = {};
for (const [kind, frames, layers] of [
  ['opening', 36, opening],
  ['collected', 30, collected],
  ['corrected', 39, corrected],
  ['again', 24, again],
]) {
  const still = layers.slice().reverse().map(staticLayer).join('');
  const data = {
    v: '5.12.2',
    nm: kind,
    fr: 60,
    ip: 0,
    op: frames,
    w: 96,
    h: 96,
    ddd: 0,
    assets: [],
    layers: layers.map((l, i) => ({ ...l, ind: i + 1, op: frames })),
  };
  writeFileSync('public/motion/' + kind + '.json', JSON.stringify(data));
  posters[kind] = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">' + still + '</svg>';
  writeFileSync('public/motion/' + kind + '.svg', posters[kind] + '\n');
}
// Bundle posters with the UI so offline saves can immediately show their final frame.
writeFileSync(
  'src/core/motion-posters.js',
  '// Generated by scripts/motion.mjs\nexport default ' + JSON.stringify(posters, null, 2) + ';\n',
);
