package com.ktb.chatapp.dto;

import com.ktb.chatapp.service.FileUrl;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class ProfileImageResponse {
    private boolean success;
    private String message;
    private String imageUrl;

    /** 업로드 성공 응답. 저장된 key를 응답 경계에서 URL로 조립한다. */
    public static ProfileImageResponse updated(String profileImageKey) {
        return new ProfileImageResponse(
                true,
                "프로필 이미지가 업데이트되었습니다.",
                FileUrl.of(profileImageKey)
        );
    }
}
