import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { WordFilter, normalizeWord } from '../src/filter.js';

const filter = new WordFilter(['시발', '새끼', '개새끼', 'fuck'], ['시발점', '다시발']);
const hits = (text) => filter.find(text).map(({ start, end }) => text.slice(start, end));

describe('normalizeWord', () => {
  it('소문자화하고 공백·특수문자를 제거한다', () => {
    assert.equal(normalizeWord(' F.u-C k '), 'fuck');
    assert.equal(normalizeWord('시 발!'), '시발');
  });
});

describe('WordFilter.find', () => {
  it('깨끗한 문장은 매칭하지 않는다', () => {
    assert.deepEqual(filter.find('안녕하세요 반갑습니다'), []);
    assert.deepEqual(filter.find(''), []);
  });

  it('금지어의 원문 위치를 반환한다', () => {
    assert.deepEqual(filter.find('아 시발 진짜'), [{ start: 2, end: 4, word: '시발' }]);
  });

  it('공백·특수문자를 끼운 우회 표현도 감지하고 원문 범위를 그대로 강조한다', () => {
    assert.deepEqual(hits('아 시 발 진짜'), ['시 발']);
    assert.deepEqual(hits('시.발.'), ['시.발']);
    assert.deepEqual(hits('F u C k you'), ['F u C k']);
  });

  it('한 메시지의 여러 금지어를 모두 센다', () => {
    assert.deepEqual(hits('시발 시발 fuck'), ['시발', '시발', 'fuck']);
  });

  it('긴 금지어를 우선 매칭한다', () => {
    assert.deepEqual(hits('이 개새끼야'), ['개새끼']);
  });

  it('허용어 안에 포함된 금지어는 무시한다', () => {
    assert.deepEqual(hits('여기가 시발점이야'), []);
    assert.deepEqual(hits('다시 발견했다'), []);
    assert.deepEqual(hits('시발점에서 시발'), ['시발']);
  });

  it('이모지(서로게이트 페어)가 섞여도 인덱스가 어긋나지 않는다', () => {
    assert.deepEqual(hits('😀시😀발😀'), ['시😀발']);
  });
});
