package com.ktb.chatapp.storage;

import java.nio.file.Path;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("file.storage.type 스위치 단위 테스트")
class StoragePortSelectionTest {

    @TempDir
    private Path uploadDir;

    private final ApplicationContextRunner contextRunner =
            new ApplicationContextRunner().withUserConfiguration(LocalStorage.class);

    @Test
    @DisplayName("프로퍼티 미설정 시 LocalStorage 빈이 등록된다")
    void localStorageIsRegisteredWhenPropertyMissing() {
        contextRunner
                .withPropertyValues("file.upload-dir=" + uploadDir)
                .run(context -> assertThat(context).hasSingleBean(LocalStorage.class));
    }

    @Test
    @DisplayName("file.storage.type=local이면 LocalStorage 빈이 등록된다")
    void localStorageIsRegisteredWhenPropertyIsLocal() {
        contextRunner
                .withPropertyValues("file.storage.type=local", "file.upload-dir=" + uploadDir)
                .run(context -> assertThat(context).hasSingleBean(LocalStorage.class));
    }

}
