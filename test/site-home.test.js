'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const src = read('js/site-home.js');

function load(file, respond) {
  const html = read(file).replace(/<script[^>]*src=[^>]*><\/script>/g, '');
  const dom = new JSDOM(html, { url: 'https://leaseqant.com/' + file, runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: new VirtualConsole() });
  const w = dom.window, calls = [];
  w.fetch = (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith('/api/faq')) return Promise.resolve({ json: () => Promise.resolve({ success: true, data: [] }) });
    const r = respond ? respond(String(url), init) : { status: 201, body: { success: true } };
    return Promise.resolve({ status: r.status, json: () => Promise.resolve(r.body) });
  };
  w.eval(src);
  return { dom, w, doc: w.document, calls };
}
const tick = () => new Promise(r => setTimeout(r, 30));
function fill(doc) {
  doc.getElementById('f-name').value = 'Ayşe Yılmaz';
  doc.getElementById('f-email').value = 'ayse@ornek.com.tr';
  doc.getElementById('f-company').value = 'Örnek Lojistik A.Ş.';
  doc.querySelector('input[name=consent]').checked = true;
}
const submit = doc => doc.getElementById('demoForm').dispatchEvent(new doc.defaultView.Event('submit', { cancelable: true, bubbles: true }));

test('ana sayfa: demo düğmeleri demo.html\'e gider, tanıtım videosu kancaları duruyor', () => {
  const html = read('index.html');
  assert.ok((html.match(/href="demo\.html"/g) || []).length >= 3);
  assert.doesNotMatch(html, /href="login\.html"[^>]*>\s*Demo/i);
  for (const id of ['tourVideo', 'tourPlay', 'faqList', 'navSheet']) assert.match(html, new RegExp(`id="${id}"`));
  assert.equal((html.match(/data-tour-at=/g) || []).length, 7);
  assert.match(html, /src="logo-nav\.png"/);
  for (const f of ['genel-bakis.png', 'kopru.png', 'sozlesme.png', 'sihirbaz.png', 'yevmiye.png', 'dipnot.png']) {
    assert.ok(fs.existsSync(path.join(root, 'frontend/media/site', f)), f);
  }
});

test('mobil menü açılır, bağlantıya basınca kapanır', () => {
  const { doc, dom } = load('index.html');
  const burger = doc.querySelector('.nav-burger'), sheet = doc.getElementById('navSheet');
  burger.click();
  assert.equal(sheet.hidden, false);
  assert.equal(burger.getAttribute('aria-expanded'), 'true');
  sheet.querySelector('a').click();
  assert.equal(sheet.hidden, true);
  dom.window.close();
});

test('demo formu: eksik alanlarda istek atılmaz', async () => {
  const { doc, calls, dom } = load('demo.html');
  submit(doc); await tick();
  assert.equal(calls.filter(c => c.url.includes('demo-request')).length, 0);
  const invalid = [...doc.querySelectorAll('[aria-invalid="true"]')].map(e => e.name).join(',');
  assert.equal(invalid, 'name,email,company,consent');
  dom.window.close();
});

test('demo formu: başarılı gönderim API\'ye JSON gider ve teşekkür ekranı açılır', async () => {
  const { doc, calls, dom } = load('demo.html');
  fill(doc); submit(doc); await tick();
  const call = calls.find(c => c.url === 'https://api.leaseqant.com/api/public/demo-request');
  assert.ok(call);
  assert.equal(call.init.method, 'POST');
  const body = JSON.parse(call.init.body);
  assert.equal(body.company, 'Örnek Lojistik A.Ş.');
  assert.equal(body.consent, true);
  assert.equal(body.website, '');
  assert.equal(doc.getElementById('demoForm').hidden, true);
  assert.equal(doc.getElementById('demoDone').hidden, false);
  assert.equal(doc.querySelector('#demoDone [data-email]').textContent, 'ayse@ornek.com.tr');
  dom.window.close();
});

test('demo formu: sunucu alan hatası alanın altına yazılır', async () => {
  const { doc, dom } = load('demo.html', () => ({ status: 400, body: { success: false, fields: { email: 'Geçerli bir e-posta adresi girin.' } } }));
  fill(doc); submit(doc); await tick();
  assert.equal(doc.getElementById('err-email').textContent, 'Geçerli bir e-posta adresi girin.');
  assert.equal(doc.getElementById('demoDone').hidden, true);
  dom.window.close();
});

test('demo formu: e-posta gönderilemezse info@leaseqant.com mailto bağlantısı gösterilir', async () => {
  const { doc, dom } = load('demo.html', () => ({ status: 503, body: { success: false, error: 'MAIL_NOT_CONFIGURED' } }));
  fill(doc); submit(doc); await tick();
  const msg = doc.getElementById('demoMsg');
  assert.equal(msg.hidden, false);
  const a = msg.querySelector('a');
  assert.match(a.getAttribute('href'), /^mailto:info@leaseqant\.com\?subject=/);
  assert.match(decodeURIComponent(a.getAttribute('href')), /Örnek Lojistik A\.Ş\./);
  assert.equal(doc.querySelector('button[type=submit]').disabled, false);
  dom.window.close();
});
