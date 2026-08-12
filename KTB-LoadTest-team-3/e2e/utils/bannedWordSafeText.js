/**
 * 백엔드 금칙어 사전(fake_banned_words_*.txt)은 영숫자 4~10자 단어로만 이루어져 있고,
 * 서버는 메시지 본문의 부분 문자열까지 검사한다.
 * 랜덤 문자열을 그대로 쓰면 금칙어와 우연히 겹쳐 정상 시나리오가 실패하므로,
 * 문자 사이에 구분자를 끼워 연속 영숫자를 1자로 끊어 둔다.
 */

const SEPARATORS = '!@#%^&*-=_+';

const pickRandomSeparator = () => SEPARATORS[Math.floor(Math.random() * SEPARATORS.length)];

const interleaveSeparators = (text, pickSeparator) =>
  text.replace(/./g, character => character + pickSeparator());

/** 타임스탬프처럼 유일성을 위해 값을 보존해야 하는 텍스트를 안전하게 만든다. */
const bannedWordSafeText = text => interleaveSeparators(String(text), pickRandomSeparator);

const bannedWordSafeToken = () =>
  interleaveSeparators(Math.random().toString(36), pickRandomSeparator).substring(2, 8);

module.exports = {
  SEPARATORS,
  interleaveSeparators,
  bannedWordSafeText,
  bannedWordSafeToken,
};
