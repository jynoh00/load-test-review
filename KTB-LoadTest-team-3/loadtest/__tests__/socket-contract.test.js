const { CLIENT_EMIT, SERVER_EMIT } = require('../socket-contract');

describe('socket-contract', () => {
  test('CLIENT_EMIT은 6개 키를 가진다', () => {
    expect(Object.keys(CLIENT_EMIT)).toHaveLength(6);
  });

  test('SERVER_EMIT은 9개 키를 가진다', () => {
    expect(Object.keys(SERVER_EMIT)).toHaveLength(9);
  });

  test('CLIENT_EMIT과 SERVER_EMIT의 값 15개는 중복이 없다', () => {
    const allValues = [...Object.values(CLIENT_EMIT), ...Object.values(SERVER_EMIT)];
    expect(allValues).toHaveLength(15);
    expect(new Set(allValues).size).toBe(allValues.length);
  });

  test('모든 값은 비어있지 않은 문자열이다', () => {
    const allValues = [...Object.values(CLIENT_EMIT), ...Object.values(SERVER_EMIT)];
    allValues.forEach((value) => {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    });
  });
});
