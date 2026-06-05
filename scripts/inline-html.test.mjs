import { describe, expect, it } from 'vitest';
import { inlineHtmlDocument } from './inline-html.mjs';

describe('inlineHtmlDocument', () => {
  it('turns built JS and CSS asset tags into a single HTML document', () => {
    const html = [
      '<!doctype html>',
      '<html>',
      '<head><link rel="stylesheet" crossorigin href="./assets/index.css"></head>',
      '<body><script type="module" crossorigin src="./assets/index.js"></script></body>',
      '</html>'
    ].join('');

    const result = inlineHtmlDocument(html, {
      './assets/index.css': 'body { background: #000; }',
      './assets/index.js': 'console.log("atlas");'
    });

    expect(result).toContain('<style data-inline-asset="./assets/index.css">body { background: #000; }</style>');
    expect(result).toContain('<script type="module" data-inline-asset="./assets/index.js">console.log("atlas");</script>');
    expect(result).not.toContain('href="./assets/index.css"');
    expect(result).not.toContain('src="./assets/index.js"');
  });
});
