package com.ktb.chatapp.service;

import java.net.URI;
import org.springframework.core.io.Resource;

/**
 * 인가를 통과한 파일 접근의 두 가지 형태. 스토리지가 오프로딩 URL을 지원하면 {@link Redirect},
 * 지원하지 않으면 앱이 바이트를 중계하는 {@link Stream}이다.
 */
public sealed interface FileAccess {

    record Stream(Resource resource, String originalname, String contentType, long size) implements FileAccess {}

    record Redirect(URI location) implements FileAccess {}
}
