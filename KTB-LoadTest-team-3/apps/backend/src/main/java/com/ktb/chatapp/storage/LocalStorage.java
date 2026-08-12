package com.ktb.chatapp.storage;

import com.ktb.chatapp.util.FileUtil;
import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.io.InputStream;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "file.storage.type", havingValue = "local", matchIfMissing = true)
public class LocalStorage implements StoragePort {

    private final Path rootLocation;

    public LocalStorage(@Value("${file.upload-dir:./uploads}") String uploadDir) {
        this.rootLocation = Paths.get(uploadDir).toAbsolutePath().normalize();
    }

    @PostConstruct
    public void init() {
        try {
            Files.createDirectories(rootLocation);
        } catch (IOException ex) {
            throw new RuntimeException("Could not create the directory where the uploaded files will be stored.", ex);
        }
    }

    @Override
    public StoredObject put(InputStream content, String key, String contentType, long size) {
        Path targetPath = resolve(key);
        try {
            Files.createDirectories(targetPath.getParent());
            Files.copy(content, targetPath, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException ex) {
            throw new RuntimeException("파일 저장에 실패했습니다: " + ex.getMessage(), ex);
        }
        return new StoredObject(key, size);
    }

    @Override
    public Optional<Resource> open(String key) {
        Path targetPath = resolve(key);
        try {
            Resource resource = new UrlResource(targetPath.toUri());
            return resource.exists() ? Optional.of(resource) : Optional.empty();
        } catch (MalformedURLException ex) {
            return Optional.empty();
        }
    }

    @Override
    public void delete(String key) {
        Path targetPath = resolve(key);
        try {
            Files.deleteIfExists(targetPath);
        } catch (IOException ex) {
            throw new RuntimeException("파일 삭제에 실패했습니다: " + ex.getMessage(), ex);
        }
    }

    private Path resolve(String key) {
        Path targetPath = rootLocation.resolve(key).normalize();
        FileUtil.validatePath(targetPath, rootLocation);
        return targetPath;
    }
}
