package com.ktb.chatapp.service;

/**
 * 스토리지 key를 응답용 URL로 조립한다. DB에는 key만 저장하고, URL은 응답 경계에서만 만든다.
 *
 * <p>조립은 <b>한 방향</b>이다. URL을 key로 되돌리는 파싱을 두면 옛 URL 형식을 받아들이는 하위호환 분기가
 * 자라난다 — 저장 형식이 둘로 갈라지는 시작점이다.
 *
 * <p>상대경로를 반환하는 것이 계약이다. 프론트는 {@code http}로 시작하지 않는 값에 API 베이스 URL을
 * 접두하므로, 절대 URL을 내려보내면 배포 환경마다 깨진다.
 */
public final class FileUrl {

    private static final String PREFIX = "/api/files/";

    private FileUrl() {
    }

    /** 값이 없으면(null·빈 문자열) 그대로 통과시킨다 — 프로필 이미지 미설정 상태를 URL로 만들지 않는다. */
    public static String of(String key) {
        if (key == null || key.isEmpty()) {
            return key;
        }
        return PREFIX + key;
    }
}
