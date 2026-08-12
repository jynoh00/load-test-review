import { useCallback, useState } from 'react';
import fileService from '../../../services/fileService';

export const useChatFileUpload = () => {
  const [filePreview, setFilePreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState(null);

  const resetFileUpload = useCallback(() => {
    setFilePreview(null);
    setUploadError(null);
    setUploadProgress(0);
  }, []);

  const uploadChatFile = useCallback(async (file, currentUser) => {
    setUploading(true);
    setUploadError(null);
    setUploadProgress(0);

    try {
      const uploadResponse = await fileService.uploadFile(
        file,
        (progress) => setUploadProgress(progress),
        currentUser.token,
        currentUser.sessionId
      );

      if (!uploadResponse.success) {
        throw new Error(uploadResponse.message || '파일 업로드에 실패했습니다.');
      }

      setUploading(false);
      setUploadProgress(0);
      return uploadResponse;
    } catch (error) {
      setUploadError(error.message);
      setUploading(false);
      throw error;
    }
  }, []);

  return {
    filePreview,
    uploading,
    uploadProgress,
    uploadError,
    setFilePreview,
    setUploading,
    setUploadProgress,
    setUploadError,
    resetFileUpload,
    uploadChatFile,
  };
};
