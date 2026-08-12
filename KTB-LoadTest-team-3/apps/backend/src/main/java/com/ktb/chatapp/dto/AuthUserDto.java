package com.ktb.chatapp.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import com.ktb.chatapp.model.User;
import com.ktb.chatapp.service.FileUrl;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuthUserDto {
    @JsonProperty("_id")
    private String id;
    private String name;
    private String email;
    private String profileImage;

    /** 인증 응답용 사용자 정보. 저장된 profileImage key를 응답 경계에서 URL로 조립한다. */
    public static AuthUserDto from(User user) {
        return new AuthUserDto(
                user.getId(),
                user.getName(),
                user.getEmail(),
                FileUrl.of(user.getProfileImage())
        );
    }
}
