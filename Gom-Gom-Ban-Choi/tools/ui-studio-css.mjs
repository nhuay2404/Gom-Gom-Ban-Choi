// Đọc / sửa file CSS giữ nguyên định dạng — dùng chung cho máy chủ UI Studio (tools/ui-studio.mjs) và bảng chỉnh trong game
// (game/app/ui-studio.js nạp qua /tools/...). Thuần JS, không dùng API của Node.
// Liệt kê các khối style theo đúng thứ tự trong file (kể cả nằm trong @media), giống thứ tự CSSOM của trình duyệt.
export function cssRules(text) {
  const rules = [];
  let start = 0;
  const stack = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '/' && text[i + 1] === '*') { const end = text.indexOf('*/', i + 2); i = end < 0 ? text.length : end + 1; if (!stack.length || stack.at(-1).group) start = i + 1; continue; }
    if (ch === '"' || ch === "'") { for (i++; i < text.length && text[i] !== ch; i++) if (text[i] === '\\') i++; continue; }
    if (ch === '{') {
      const prelude = text.slice(start, i).trim();
      const group = prelude.startsWith('@') && /^@(media|supports|layer|container|document)/.test(prelude);
      stack.push({ prelude, open: i, group, keyframes: prelude.startsWith('@') && !group });
      start = i + 1;
    } else if (ch === '}') {
      const block = stack.pop();
      if (block && !block.group && !block.keyframes && !stack.some(b => b.keyframes)) rules.push({ selector: block.prelude, open: block.open, close: i });
      start = i + 1;
    } else if (ch === ';' && (!stack.length || stack.at(-1).group)) start = i + 1;
  }
  return rules;
}
export const norm = selector => selector.replace(/\s+/g, '').replace(/"/g, "'");

// Tách phần thân khối thành các khai báo [đầu, cuối, tên, vị trí giá trị] — bỏ qua ; nằm trong ngoặc / chuỗi (url(data:...;...)).
export function declarations(text, from, to) {
  const out = [];
  let begin = from, depth = 0;
  for (let i = from; i <= to; i++) {
    const ch = text[i];
    if (i < to && (ch === '"' || ch === "'")) { for (i++; i < to && text[i] !== ch; i++) if (text[i] === '\\') i++; continue; }
    if (i < to && ch === '/' && text[i + 1] === '*') { const end = text.indexOf('*/', i + 2); i = end < 0 ? to : end + 1; continue; }
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (i === to || (ch === ';' && depth === 0)) {
      const raw = text.slice(begin, i);
      const colon = raw.indexOf(':');
      if (colon > 0 && !raw.trim().startsWith('/*')) {
        const lead = raw.length - raw.trimStart().length;
        out.push({ start: begin + lead, end: begin + raw.trimEnd().length, name: raw.slice(0, colon).trim().toLowerCase(), valueStart: begin + colon + 1 });
      }
      begin = i + 1;
    }
  }
  return out;
}

export function patchCss(text, selector, index, props) {
  const matches = cssRules(text).filter(rule => norm(rule.selector) === norm(selector));
  const rule = matches[index] ?? matches[0];
  if (!rule) {
    // Khối chưa có trong file (selector do artist tự gõ): thêm khối mới cuối file.
    const body = Object.entries(props).filter(([, v]) => v !== '').map(([k, v]) => `${k}:${v}`).join(';');
    return body ? text.replace(/\s*$/, '') + `\n${selector}{${body}}\n` : text;
  }
  const edits = [];
  const decls = declarations(text, rule.open + 1, rule.close);
  const multiline = text.slice(rule.open, rule.close).includes('\n');
  const added = [];
  for (const [name, rawValue] of Object.entries(props)) {
    const value = String(rawValue).trim();
    const hit = decls.filter(d => d.name === name.toLowerCase()).at(-1);
    if (hit) {
      if (value === '') {
        // xoá cả dấu ; phía sau
        let end = hit.end;
        while (end < rule.close && /[\s;]/.test(text[end]) && text[end] !== '\n') end++;
        edits.push([hit.start, end, '']);
      } else {
        const space = text.slice(hit.valueStart, hit.end).match(/^\s*/)[0];
        edits.push([hit.valueStart, hit.end, space + value]);
      }
    } else if (value !== '') added.push(`${name}:${multiline ? ' ' : ''}${value}`);
  }
  if (added.length) {
    if (multiline) {
      const indent = (text.slice(0, decls[0]?.start ?? rule.close).match(/[ \t]*$/) || [''])[0] || '  ';
      const insertAt = text.lastIndexOf('\n', rule.close - 1) + 1 || rule.close;
      const needSemi = decls.length && !/;\s*$/.test(text.slice(decls.at(-1).end, insertAt));
      edits.push([insertAt, insertAt, added.map(d => `${indent}${d};\n`).join('')]);
      if (needSemi) edits.push([decls.at(-1).end, decls.at(-1).end, ';']);
    } else {
      // chèn ngay sau giá trị cuối: `a:1}` -> `a:1;b:2}`, `a:1;}` -> `a:1;b:2;}`
      const last = decls.at(-1);
      const pos = last ? last.end : rule.open + 1;
      edits.push([pos, pos, (last ? ';' : '') + added.join(';')]);
    }
  }
  edits.sort((a, b) => b[0] - a[0]);
  let close = rule.close;
  for (const [from, to, insert] of edits) { text = text.slice(0, from) + insert + text.slice(to); close += insert.length - (to - from); }
  // dọn dấu ; thừa do xoá khai báo cuối / đầu khối
  const body = text.slice(rule.open, close).replace(/;([ 	]*;)+/g, ';').replace(/^{([ 	]*);/, '{$1');
  return text.slice(0, rule.open) + body + text.slice(close);
}

