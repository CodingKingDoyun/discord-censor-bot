export const MESSAGE_LIMIT = 2000;

const ANSI_RED = '\u001b[1;31m';
const ANSI_RESET = '\u001b[0m';

/** 원문을 [일반 텍스트, 금지어, 일반 텍스트, ...] 조각으로 나눈다. */
function* segments(text, matches) {
  let pos = 0;
  for (const { start, end } of matches) {
    if (start > pos) yield { value: text.slice(pos, start), hit: false };
    yield { value: text.slice(start, end), hit: true };
    pos = end;
  }
  if (pos < text.length) yield { value: text.slice(pos), hit: false };
}

/** 사용자가 입력한 ``` 때문에 코드 블록이 깨지지 않도록 백틱 사이에 zero-width space 를 넣는다. */
const escapeCodeBlock = (s) => s.replaceAll('`', '`​');

/**
 * 금지어를 빨간색 + [ ] 로 강조한 ANSI 코드 블록을 만든다.
 * ANSI 색상을 지원하지 않는 환경(모바일 등)에서도 [ ] 로 금지어를 알아볼 수 있다.
 */
export function renderHighlighted(text, matches) {
  const body = [...segments(text, matches)]
    .map(({ value, hit }) => {
      const escaped = escapeCodeBlock(value);
      return hit ? `${ANSI_RED}[${escaped}]${ANSI_RESET}` : escaped;
    })
    .join('');
  return `\`\`\`ansi\n${body}\n\`\`\``;
}

/** 색상 없이 금지어를 [ ] 로만 감싼다. (2000자 제한을 넘을 때의 대체 형식) */
export function renderPlain(text, matches) {
  return [...segments(text, matches)]
    .map(({ value, hit }) => (hit ? `[${value}]` : value))
    .join('');
}

/**
 * 재전송할 메시지 본문을 만든다.
 * 2000자 제한을 넘으면 ANSI 코드가 빠진 짧은 형식으로, 그래도 넘으면 본문을 잘라낸다.
 *
 * @param {object} params
 * @param {string} params.text     원본 메시지
 * @param {import('./filter.js').Match[]} params.matches
 * @param {number} params.total    작성자의 누적 검열 횟수
 * @param {string} [params.header] 본문 위에 붙일 줄 (웹훅을 쓸 수 없을 때 작성자 표시용)
 */
export function buildRepost({ text, matches, total, header }) {
  const footer = `-# 🚫 부적절한 표현 ${matches.length}건이 감지되어 검열되었습니다 · 누적 ${total}회`;
  const assemble = (body) => [header, body, footer].filter(Boolean).join('\n');

  const highlighted = assemble(renderHighlighted(text, matches));
  if (highlighted.length <= MESSAGE_LIMIT) return highlighted;

  const body = renderPlain(text, matches);
  const message = assemble(body);
  if (message.length <= MESSAGE_LIMIT) return message;

  const room = MESSAGE_LIMIT - (message.length - body.length) - 1;
  return assemble(`${body.slice(0, room)}…`);
}
