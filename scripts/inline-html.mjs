import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

function escapeScriptContent(source) {
  return source.replace(/<\/script/gi, '<\\/script');
}

export function inlineHtmlDocument(html, assets) {
  return html
    .replace(/<link\s+rel="stylesheet"\s+crossorigin\s+href="([^"]+)"\s*\/?>/g, (_tag, href) => {
      const css = assets[href];

      if (css === undefined) {
        throw new Error(`Missing CSS asset for ${href}`);
      }

      return `<style data-inline-asset="${href}">${css}</style>`;
    })
    .replace(/<script\s+type="module"\s+crossorigin\s+src="([^"]+)"><\/script>/g, (_tag, src) => {
      const js = assets[src];

      if (js === undefined) {
        throw new Error(`Missing JS asset for ${src}`);
      }

      return `<script type="module" data-inline-asset="${src}">${escapeScriptContent(js)}</script>`;
    });
}

function collectAssetReferences(html) {
  const refs = new Set();
  const linkPattern = /<link\s+rel="stylesheet"\s+crossorigin\s+href="([^"]+)"\s*\/?>/g;
  const scriptPattern = /<script\s+type="module"\s+crossorigin\s+src="([^"]+)"><\/script>/g;

  for (const match of html.matchAll(linkPattern)) {
    refs.add(match[1]);
  }

  for (const match of html.matchAll(scriptPattern)) {
    refs.add(match[1]);
  }

  return [...refs];
}

function assetPathFromReference(distDir, reference) {
  const normalized = reference.replace(/^\.\//, '').replace(/^\//, '');
  return join(distDir, normalized);
}

export async function inlineBuiltHtml(distDir = resolve('dist')) {
  const htmlPath = join(distDir, 'index.html');
  const html = await readFile(htmlPath, 'utf8');
  const assets = {};

  for (const reference of collectAssetReferences(html)) {
    assets[reference] = await readFile(assetPathFromReference(distDir, reference), 'utf8');
  }

  const inlined = inlineHtmlDocument(html, assets);
  const outputPath = join(distDir, 'atlas.html');
  await writeFile(outputPath, inlined, 'utf8');
  return outputPath;
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';

if (import.meta.url === invokedPath) {
  const distDir = process.argv[2] ? resolve(process.argv[2]) : resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
  const outputPath = await inlineBuiltHtml(distDir);
  console.log(`HTML-compatible atlas written to ${outputPath}`);
}
