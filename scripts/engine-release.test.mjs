import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url));
const descriptor = JSON.parse(read('publisher/engine-release.json'));
const template = read('template.tpl').toString();
const code = template.split('___SANDBOXED_JS_FOR_WEB_TEMPLATE___')[1].split('\n___')[0];

test('historical descriptor retains immutable provenance without selecting current engine delivery', () => {
  assert.equal(descriptor.schema, 'cybexo.engine.release.v1');
  assert.equal(descriptor.id, '1.5.41-dc8923e48269');
  assert.equal(descriptor.version, '1.5.41');
  assert.equal(descriptor.commit, '04a91543');
  assert.equal(descriptor.contractVersion, 1);
  assert.equal(descriptor.path, '/releases/' + descriptor.id + '/');
  assert.doesNotMatch(code, /ENGINE_RELEASE|ENGINE_BUILD|data-engine-release=|identity\.(?:engineRelease|engineVersion|buildId|adapterVersion) ===/);
  assert.ok(code.includes("var ASSETS = 'https://cmp.cybexo.com';"));
  assert.ok(code.includes("var LOADER = ASSETS + '/loader.js';"));
  const loader = descriptor.files.find(file => file.name === 'loader.js');
  assert.equal(loader.bytes, 3035792);
  assert.equal(loader.sha256, 'd0b9492e1c92caccbee3df1e5aab538b83091f67d9960a1d971defca1d4c8842');
  assert.equal(loader.integrity, 'sha384-l+2WepGVwI6LQ6A8X3wsCiBL3phFxendxHjU8DjOae7MD6tQxRRq/F/+3Ukc0Rbv');
});

test('retained bootstrap matches historical descriptor bytes, SHA-256 and SHA-384', () => {
  const file = descriptor.files.find(file => file.name === 'tcf-bootstrap.js');
  const bytes = read('publisher/tcf-bootstrap.js');
  assert.equal(bytes.length, file.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256);
  assert.equal('sha384-' + createHash('sha384').update(bytes).digest('base64'), file.integrity);
});
