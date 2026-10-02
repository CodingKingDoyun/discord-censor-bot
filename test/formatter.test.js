import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MESSAGE_LIMIT, buildRepost, renderHighlighted, renderPlain } from '../src/formatter.js';

const text = '아 시발 진짜';
const matches = [{ start: 2, end: 4, word: '시발' }];

describe('renderHighlighted', () => {
  it('ANSI 코드 블록으로 금지어를 빨간색 + [ ] 처리한다', () => {
    assert.equal(renderHighlighted(text, matches), '```ansi\n아 \u001b[1;31m[시발]\u001b[0m 진짜\n```');
  });

  it('사용자가 입력한 백틱이 코드 블록을 깨지 않게 한다', () => {
    const out = renderHighlighted('```시발```', [{ start: 3, end: 5, word: '시발' }]);
    assert.equal(out.match(/```/g).length, 2); // 감싸는 블록의 여닫는 2개만 남는다
  });
});

describe('renderPlain', () => {
  it('금지어를 [ ] 로 감싼다', () => {
    assert.equal(renderPlain(text, matches), '아 [시발] 진짜');
  });
});

describe('buildRepost', () => {
  it('강조된 본문과 검열 정보를 포함한다', () => {
    const out = buildRepost({ text, matches, total: 3 });
    assert.match(out, /^```ansi\n아 \u001b\[1;31m\[시발\]\u001b\[0m 진짜/);
    assert.match(out, /1건.*누적 3회/);
  });

  it('헤더가 있으면 첫 줄에 붙인다', () => {
    const out = buildRepost({ text, matches, total: 1, header: '**유저** 님의 메시지' });
    assert.equal(out.split('\n')[0], '**유저** 님의 메시지');
  });

  it('2000자 제한을 넘지 않는다', () => {
    const long = `${'가'.repeat(1990)}시발`;
    const out = buildRepost({ text: long, matches: [{ start: 1990, end: 1992, word: '시발' }], total: 1 });
    assert.ok(out.length <= MESSAGE_LIMIT);
    assert.ok(!out.startsWith('```ansi'), '너무 길면 색상 없는 [ ] 형식으로 대체된다');
  });
});
