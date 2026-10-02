import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CensorStore } from '../src/storage.js';

describe('CensorStore', () => {
  it('검열 횟수를 누적하고 서버별로 분리한다', () => {
    const store = new CensorStore(':memory:');
    assert.equal(store.add('g1', 'u1', 1), 1);
    assert.equal(store.add('g1', 'u1', 3), 4); // 한 메시지에서 3번 걸린 경우
    assert.equal(store.getCount('g1', 'u1'), 4);
    assert.equal(store.getCount('g2', 'u1'), 0);
    store.close();
  });

  it('순위를 계산한다', () => {
    const store = new CensorStore(':memory:');
    store.add('g1', 'a', 5);
    store.add('g1', 'b', 2);
    store.add('g1', 'c', 9);
    assert.deepEqual(store.top('g1').map((r) => r.userId), ['c', 'a', 'b']);
    assert.equal(store.getRank('g1', 'a'), 2);
    store.close();
  });
});

