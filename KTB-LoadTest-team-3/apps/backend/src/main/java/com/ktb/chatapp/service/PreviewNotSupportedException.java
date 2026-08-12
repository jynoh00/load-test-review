package com.ktb.chatapp.service;

/**
 * 인가는 통과했지만 미리보기를 지원하지 않는 파일 형식임을 알린다(HTTP 415).
 */
public class PreviewNotSupportedException extends RuntimeException {

    public PreviewNotSupportedException(String message) {
        super(message);
    }
}
