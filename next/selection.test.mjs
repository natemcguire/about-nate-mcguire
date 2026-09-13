import test from 'node:test';
import assert from 'node:assert/strict';
import {eligible, choose} from './selection.mjs';
const approved = {id:'claude-01', model:'claude', modelVersion:'test-model', generatedAt:'2026-09-12T12:00:00Z', contentVersion:'v1', entry:'designs/claude-01/', review:{nate:'approved', agent:'approved'}};
test('both reviewers and matching content are mandatory', () => {
  const variations = [approved, {...approved, review:{nate:'pending', agent:'approved'}}, {...approved, review:{nate:'approved', agent:'pending'}}, {...approved, contentVersion:'old'}, {...approved, model:'grok'}];
  assert.deepEqual(eligible(variations,'claude','v1'), [approved]);
});
test('reject external assets and missing provenance', () => {
  for (const patch of [{entry:'https://example.com/'}, {entry:'designs/../a/'}, {modelVersion:''}, {generatedAt:'unknown'}]) {
    assert.deepEqual(eligible([{...approved,...patch}],'claude','v1'), []);
  }
});
test('random choice excludes current and handles empty/single collections', () => {
  const second = {...approved,id:'claude-02'};
  assert.equal(choose([approved,second],approved.id,()=>0), second);
  assert.equal(choose([approved],approved.id), approved);
  assert.equal(choose([],null), null);
  assert.equal(choose([approved,second],null,()=>0.99), second);
});
