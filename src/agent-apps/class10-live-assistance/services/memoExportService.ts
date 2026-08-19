import type { Memo } from '../types/memo';

/** Formats one memo as a Markdown section. */
export function memoToMarkdown(memo: Memo): string {
  const lines: string[] = [`## ${memo.title}`, ''];

  if (memo.summary) lines.push(`> ${memo.summary}`, '');
  if (memo.tags.length) lines.push(`**標籤：** ${memo.tags.map(tag => `\`${tag}\``).join(' ')}`, '');
  if (memo.content.trim()) lines.push(memo.content.trim(), '');

  if (memo.translation?.trim()) {
    lines.push('### 翻譯', '', memo.translation.trim(), '');
  }

  if (memo.todos.length) {
    lines.push('### 待辦', '');
    memo.todos.forEach(todo => lines.push(`- [${todo.done ? 'x' : ' '}] ${todo.text}`));
    lines.push('');
  }

  if (memo.userNote?.trim()) {
    lines.push('### 使用者備註', '', memo.userNote.trim(), '');
  }

  if (memo.sourceUrls?.length) {
    lines.push('### 來源', '');
    memo.sourceUrls.forEach(source => lines.push(`- [${source.title || source.url}](${source.url})`));
    lines.push('');
  }

  if (memo.screenshotIds.length) {
    lines.push(`_（含 ${memo.screenshotIds.length} 張截圖，請於 app 內檢視）_`, '');
  }

  lines.push(`_建立於 ${formatTimestamp(memo.createdAt)}．更新於 ${formatTimestamp(memo.updatedAt)}_`, '');
  return lines.join('\n');
}

function formatTimestamp(value: number): string {
  return new Date(value).toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/** Assembles a whole work-summary report from several memos. */
export function buildMarkdownReport(memos: Memo[], title = '工作摘要'): string {
  const header = [
    `# ${title}`,
    '',
    `產生時間：${formatTimestamp(Date.now())}．共 ${memos.length} 則 memo`,
    ''
  ];

  if (!memos.length) {
    return [...header, '（沒有符合條件的 memo）', ''].join('\n');
  }

  const allTodos = memos.flatMap(memo =>
    memo.todos.filter(todo => !todo.done).map(todo => ({ memo: memo.title, text: todo.text }))
  );

  const outstanding = allTodos.length
    ? ['## 未完成待辦彙整', '', ...allTodos.map(item => `- [ ] ${item.text}　_(${item.memo})_`), '', '---', '']
    : [];

  return [...header, '---', '', ...outstanding, ...memos.map(memoToMarkdown)].join('\n');
}

/** Triggers a browser download of the report. */
export function downloadMarkdown(markdown: string, filename: string): void {
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.md') ? filename : `${filename}.md`;
  link.click();
  URL.revokeObjectURL(url);
}
