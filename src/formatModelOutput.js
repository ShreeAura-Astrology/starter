// Lightweight formatter: convert model text (plain or simple markdown) to safe HTML
// - Escapes HTML to avoid XSS
// - Converts fenced code blocks, inline code, headings, bold/italic, and paragraphs

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\//g, '&#x2F;');
}

export function formatModelOutputToHtml(input) {
  if (input === null || input === undefined) return '';
  let text = String(input);

  // Normalize CRLF
  text = text.replace(/\r\n/g, '\n');

  // Extract fenced code blocks first and replace with placeholders
  const codeBlocks = [];
  text = text.replace(/```(\w+)?\n([\s\S]*?)```/g, (m, lang, code) => {
    const escaped = escapeHtml(code);
    const cls = lang ? ` class="language-${escapeHtml(lang)}"` : '';
    const placeholder = `@@CODEBLOCK_${codeBlocks.length}@@`;
    codeBlocks.push(`<pre><code${cls}>${escaped}</code></pre>`);
    return placeholder;
  });

  // Escape remaining HTML (we'll re-insert code blocks unescaped)
  text = escapeHtml(text);

  // Restore placeholders to the already-escaped HTML for code blocks
  codeBlocks.forEach((html, i) => {
    text = text.replace(`@@CODEBLOCK_${i}@@`, html);
  });

  // Inline code `code`
  text = text.replace(/`([^`]+)`/g, (m, code) => `<code>${escapeHtml(code)}</code>`);

  // Headings (#, ## ...)
  text = text.replace(/^######\s*(.+)$/gm, '<h6>$1</h6>');
  text = text.replace(/^#####\s*(.+)$/gm, '<h5>$1</h5>');
  text = text.replace(/^####\s*(.+)$/gm, '<h4>$1</h4>');
  text = text.replace(/^###\s*(.+)$/gm, '<h3>$1</h3>');
  text = text.replace(/^##\s*(.+)$/gm, '<h2>$1</h2>');
  text = text.replace(/^#\s*(.+)$/gm, '<h1>$1</h1>');

  // Bold **text** and __text__
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__(.+?)__/g, '<strong>$1</strong>');

  // Italic *text* and _text_
  text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
  text = text.replace(/_(.+?)_/g, '<em>$1</em>');

  // Convert double newlines (or more) into paragraphs
  const paras = text.split(/\n{2,}/g).map(p => {
    // If paragraph already starts with block-level html (like <h1>, <pre>, <ul>, etc.), keep as-is
    if (/^<h\d>|^<pre>|^<ul>|^<ol>|^<blockquote>|^<table>/i.test(p.trim())) {
      // Replace single newlines within that block with <br> only for <pre> we should keep as-is (pre contains code)
      return p;
    }
    // Replace single newlines with <br>
    const inner = p.replace(/\n/g, '<br>');
    return `<p>${inner}</p>`;
  });

  return paras.join('\n');
}

export default formatModelOutputToHtml;
