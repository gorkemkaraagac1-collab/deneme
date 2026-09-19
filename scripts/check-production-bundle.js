#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

const origin = String(process.env.PRODUCTION_WEB_ORIGIN || 'https://leaseqant.com').replace(/\/$/, '');
const pagePath = process.env.PRODUCTION_PAGE || '/tfrs16.html';
const root = path.resolve(__dirname, '..');
const forbidden = [
  'calculateLeaseEngineImpl',
  'applyTMS29Restatement',
  '__TFRS16_TEST__',
  'runSelfTestsV19',
  'sourceMappingURL',
  'tfrs16-engine.js'
];
const artifactPaths = [
  '/js/tfrs16-engine.js',
  '/js/tfrs16-engine.js.map',
  '/js/tfrs16-ui.js.map',
  '/js/shell.js.map',
  '/js/tfrs16-engine.js.bak',
  '/js/tfrs16-engine.js.old',
  '/js/tfrs16-engine.js.backup',
  '/_site/js/tfrs16-engine.js',
  '/_site/js/tfrs16-engine.js.map'
];

async function fetchText(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'LeaseQant-production-bundle-audit/1.0' } });
  const body = await response.text();
  return { response, body };
}

function fail(message) {
  console.error(`Production bundle audit FAILED: ${message}`);
  process.exitCode = 1;
}

(async () => {
  const pageUrl = `${origin}${pagePath.startsWith('/') ? pagePath : `/${pagePath}`}`;
  const page = await fetchText(pageUrl);
  if (!page.response.ok) throw new Error(`page HTTP ${page.response.status}: ${pageUrl}`);

  const scriptUrls = [...page.body.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)]
    .map(match => new URL(match[1], pageUrl).toString());
  if (!scriptUrls.length) throw new Error('no script assets found in production page');

  const sameOrigin = scriptUrls.filter(url => new URL(url).origin === origin);
  for (const scriptUrl of scriptUrls) {
    const asset = await fetchText(scriptUrl);
    if (!asset.response.ok) {
      fail(`script HTTP ${asset.response.status}: ${scriptUrl}`);
      continue;
    }
    const isLocal = new URL(scriptUrl).origin === origin;
    if (isLocal) {
      for (const marker of forbidden) {
        if (asset.body.includes(marker)) fail(`forbidden marker ${marker} in ${scriptUrl}`);
      }
      const basename = new URL(scriptUrl).pathname.split('/').pop();
      const localPath = path.join(root, 'js', basename);
      if (fs.existsSync(localPath)) {
        const localBody = fs.readFileSync(localPath, 'utf8');
        if (localBody !== asset.body) fail(`deployed asset differs from checkout: ${basename}`);
      }
    }
    console.log(`asset OK ${asset.body.length} bytes ${scriptUrl}`);
  }

  for (const relativePath of artifactPaths) {
    const response = await fetch(`${origin}${relativePath}`, { method: 'HEAD' });
    if (response.status !== 404) fail(`unexpected artifact HTTP ${response.status}: ${relativePath}`);
  }

  console.log(`Production bundle audit OK — ${sameOrigin.length} same-origin scripts, ${artifactPaths.length} artifact probes`);
})().catch(error => {
  fail(error.message);
});
