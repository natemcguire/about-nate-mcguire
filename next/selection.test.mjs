import test from 'node:test';
import assert from 'node:assert/strict';
import {eligible, choose, remember} from './selection.mjs';
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
test('all designs appear once per cycle, including across model switches', () => {
  const pool = Array.from({length:5}, (_,i) => ({...approved,id:`claude-${i}`}));
  let seen=[], current=null;
  for(let cycle=0; cycle<3; cycle++) {
    const shown=[];
    for(let i=0; i<5; i++) {
      const next=choose(pool,seen,current,()=>0);
      assert.notEqual(next.id,current);
      seen=remember(pool,seen,next.id); current=next.id; shown.push(current);
    }
    assert.equal(new Set(shown).size,5);
  }
});
test('first Overprint counts as seen; empty, single and changing pools work', () => {
  const pool=[approved,{...approved,id:'claude-04'}];
  assert.equal(choose(pool,['claude-04'],'claude-04',()=>0).id,approved.id);
  assert.equal(choose([],[]),null);
  assert.equal(choose([approved],[approved.id],approved.id),approved);
  assert.deepEqual(remember([approved],['removed'],approved.id),[approved.id]);
});
