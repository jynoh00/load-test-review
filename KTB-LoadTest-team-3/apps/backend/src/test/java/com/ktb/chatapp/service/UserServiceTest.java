package com.ktb.chatapp.service;

import com.ktb.chatapp.dto.ProfileImageResponse;
import com.ktb.chatapp.model.User;
import com.ktb.chatapp.repository.UserRepository;
import com.ktb.chatapp.storage.LocalStorage;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("UserService 단위 테스트")
class UserServiceTest {

    private static final String EMAIL = "user@example.com";

    @Mock
    private UserRepository userRepository;

    @Mock
    private FileService fileService;

    private UserService userService;

    @TempDir
    private Path uploadDir;

    /**
     * 실물 파일이 정말 지워지는지가 검증 대상이므로 스토리지는 목이 아니라 {@link LocalStorage} 실물을
     * @TempDir에 붙여 쓴다.
     */
    @BeforeEach
    void setUp() {
        userService = new UserService(userRepository, fileService, new LocalStorage(uploadDir.toString()));
        ReflectionTestUtils.setField(userService, "maxProfileImageSize", 5242880L);
    }

    private Path createOldProfileImageFile(String fileName) throws IOException {
        Path profilesDir = uploadDir.resolve("profiles");
        Files.createDirectories(profilesDir);
        Path oldFile = profilesDir.resolve(fileName);
        Files.writeString(oldFile, "old-image-bytes");
        return oldFile;
    }

    @Test
    @DisplayName("프로필 이미지 재업로드 시 기존 이미지 실물 파일을 삭제한다")
    void uploadProfileImage_DeletesOldProfileImageFile() throws IOException {
        Path oldFile = createOldProfileImageFile("old.jpg");
        User user = User.builder()
                .id("user-1")
                .email(EMAIL)
                .profileImage("profiles/old.jpg")
                .build();
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        when(fileService.storeFile(any(), eq("profiles"))).thenReturn("profiles/new.jpg");
        MockMultipartFile file = new MockMultipartFile(
                "file", "new.jpg", "image/jpeg", "new-image-bytes".getBytes());

        ProfileImageResponse response = userService.uploadProfileImage(EMAIL, file);

        assertThat(Files.exists(oldFile)).isFalse();
        assertThat(user.getProfileImage()).isEqualTo("profiles/new.jpg");
        assertThat(response.getImageUrl()).isEqualTo("/api/files/profiles/new.jpg");
    }

    @Test
    @DisplayName("프로필 이미지 삭제 시 기존 이미지 실물 파일을 삭제한다")
    void deleteProfileImage_DeletesProfileImageFile() throws IOException {
        Path oldFile = createOldProfileImageFile("old2.jpg");
        User user = User.builder()
                .id("user-1")
                .email(EMAIL)
                .profileImage("profiles/old2.jpg")
                .build();
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));

        userService.deleteProfileImage(EMAIL);

        assertThat(Files.exists(oldFile)).isFalse();
        assertThat(user.getProfileImage()).isEmpty();
    }
}
