import { readFileSync, existsSync } from 'node:fs';

/** 글자(한글·자모·영문 등)와 숫자만 '의미 있는 문자'로 본다. 공백·특수문자·이모지는 무시된다. */
const isWordChar = (ch) => /[\p{L}\p{N}]/u.test(ch);

/** 단어를 비교용 형태로 정규화한다. (소문자화 + 공백/특수문자 제거) */
export function normalizeWord(word) {
  return [...word.toLowerCase()].filter(isWordChar).join('');
}

/** 한 줄에 하나씩, `#` 으로 시작하는 줄은 주석으로 취급하는 단어 목록 파일을 읽는다. */
export function readWordList(path) {
  if (!path || !existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

const uniqueNormalized = (words) => [...new Set(words.map(normalizeWord).filter(Boolean))];

/**
 * @typedef {object} Match
 * @property {number} start 원문 기준 시작 인덱스
 * @property {number} end   원문 기준 끝 인덱스 (exclusive)
 * @property {string} word  매칭된 금지어 (정규화된 형태)
 */

export class WordFilter {
  /**
   * @param {string[]} bannedWords  금지어 목록
   * @param {string[]} allowedWords 금지어를 포함하지만 허용할 단어 목록 (예: "시발점")
   */
  constructor(bannedWords, allowedWords = []) {
    // 긴 단어를 먼저 검사해야 "개새끼"가 "새끼"보다 우선 매칭된다.
    this.bannedWords = uniqueNormalized(bannedWords).sort((a, b) => b.length - a.length);
    this.allowedWords = uniqueNormalized(allowedWords);
  }

  static fromFiles(bannedPath, allowedPath) {
    return new WordFilter(readWordList(bannedPath), readWordList(allowedPath));
  }

  /**
   * 원문에서 금지어를 찾는다.
   * "시 발", "시.발" 같은 우회 표현도 잡기 위해 공백/특수문자를 제거한 문자열에서 검색하고,
   * 인덱스 매핑을 통해 원문 위치로 되돌린다.
   *
   * @param {string} text
   * @returns {Match[]} 원문 순서대로 정렬된, 서로 겹치지 않는 매칭 목록
   */
  find(text) {
    if (!text || this.bannedWords.length === 0) return [];

    // normalized 의 각 UTF-16 코드 유닛이 원문의 어느 문자 범위에서 왔는지 기록한다.
    let normalized = '';
    const startMap = [];
    const endMap = [];
    let offset = 0;
    for (const ch of text) {
      const end = offset + ch.length;
      if (isWordChar(ch)) {
        const lowered = ch.toLowerCase();
        normalized += lowered;
        for (let k = 0; k < lowered.length; k++) {
          startMap.push(offset);
          endMap.push(end);
        }
      }
      offset = end;
    }

    const allowedRanges = this.#findAllowedRanges(normalized);
    const isAllowed = (s, e) => allowedRanges.some(([as, ae]) => as <= s && e <= ae);

    const matches = [];
    let i = 0;
    while (i < normalized.length) {
      const word = this.bannedWords.find(
        (w) => normalized.startsWith(w, i) && !isAllowed(i, i + w.length),
      );
      if (word) {
        matches.push({ start: startMap[i], end: endMap[i + word.length - 1], word });
        i += word.length;
      } else {
        i += 1;
      }
    }
    return matches;
  }

  #findAllowedRanges(normalized) {
    const ranges = [];
    for (const word of this.allowedWords) {
      let idx = normalized.indexOf(word);
      while (idx !== -1) {
        ranges.push([idx, idx + word.length]);
        idx = normalized.indexOf(word, idx + 1);
      }
    }
    return ranges;
  }
}
