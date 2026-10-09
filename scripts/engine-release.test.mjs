import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url));
const descriptor = JSON.parse(read('publisher/engine-release.json'));
const template = read('template.tpl').toString();
const code = template.split('___SANDBOXED_JS_FOR_WEB_TEMPLATE___')[1].split('\n___')[0];

test('selected descriptor binds exact engine release, build, immutable path and template identity checks', () => {
  assert.equal(descriptor.schema, 'cybexo.engine.release.v1');
  assert.equal(descriptor.id, '1.5.40-23fc15424d75');
  assert.equal(descriptor.version, '1.5.40');
  assert.equal(descriptor.commit, '65b35513');
  assert.equal(descriptor.contractVersion, 1);
  assert.equal(descriptor.path, '/releases/' + descriptor.id + '/');
  assert.ok(code.includes("var ENGINE_RELEASE = '" + descriptor.id + "';"));
  assert.ok(code.includes("var ENGINE_BUILD = '" + descriptor.build + "';"));
  assert.ok(code.includes("identity.buildId === ENGINE_BUILD"));
  const loader = descriptor.files.find(file => file.name === 'loader.js');
  assert.equal(loader.bytes, 3037317);
  assert.equal(loader.sha256, 'fa8e4e31806ba309c52a281f785eb4c5e6576dcbeb01aa123889b80860098fee');
  assert.equal(loader.integrity, 'sha384-/D5hq5yEPXJ230lhCUm/Ow/G12XAJPrfHvfexhX3evtww8qqwvyVuqr3+9slEp2Z');
});

test('selected bootstrap matches descriptor bytes, SHA-256 and SHA-384; external example selects same pair', () => {
  const file = descriptor.files.find(file => file.name === 'tcf-bootstrap.js');
  const bytes = read('publisher/tcf-bootstrap.js');
  assert.equal(bytes.length, file.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256);
  assert.equal('sha384-' + createHash('sha384').update(bytes).digest('base64'), file.integrity);
  const installation = read('docs/installation.md').toString();
  assert.ok(installation.includes('src="https://cmp.cybexo.com' + descriptor.path + 'tcf-bootstrap.js"'));
  assert.ok(installation.includes('integrity="' + file.integrity + '"'));
  assert.ok(installation.includes('crossorigin="anonymous"'));
  assert.ok(!installation.includes('https://cmp.cybexo.com/tcf-bootstrap.js'));
});
