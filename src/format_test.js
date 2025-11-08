import format, { formatModelOutputToHtml } from './formatModelOutput.js';

const examples = [
  'Plain text response from model.',
  '# Heading\n\nThis is a paragraph with **bold** and *italic* text.',
  'Here is some `inline code` inside a sentence.',
  'A code block:\n```js\nconsole.log("hello world")\n```\nEnd.',
  '',
  null,
];

for (const ex of examples) {
  console.log('--- INPUT ---');
  console.log(String(ex));
  console.log('--- HTML ---');
  console.log(formatModelOutputToHtml(ex));
  console.log('\n');
}
