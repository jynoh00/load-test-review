package com.ktb.chatapp.service;

import org.springframework.web.multipart.MultipartFile;

public interface FileService {

    FileUploadResult uploadFile(MultipartFile file, String uploaderId);

    /**
     * 파일을 저장하고 <b>스토리지 key</b>({@code <subDirectory>/<name>})를 반환한다. URL 조립은 응답
     * 경계의 몫이므로 여기서는 하지 않는다.
     */
    String storeFile(MultipartFile file, String subDirectory);

    boolean deleteFile(String fileId, String requesterId);
}

