import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import fileService from '../../../../services/fileService';
import { useChatFileUpload } from '../useChatFileUpload';

vi.mock('../../../../services/fileService', () => ({
  default: {
    uploadFile: vi.fn(),
  },
}));

describe('useChatFileUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uploads a file and resets progress after success', async () => {
    const uploadResponse = {
      success: true,
      data: { file: { _id: 'file-1' } },
    };
    fileService.uploadFile.mockImplementation(async (_file, onProgress) => {
      onProgress(55);
      return uploadResponse;
    });
    const { result } = renderHook(() => useChatFileUpload());

    let response;
    await act(async () => {
      response = await result.current.uploadChatFile(
        { name: 'sample.pdf' },
        { token: 'token-1', sessionId: 'session-1' }
      );
    });

    expect(response).toBe(uploadResponse);
    expect(result.current.uploading).toBe(false);
    expect(result.current.uploadProgress).toBe(0);
    expect(result.current.uploadError).toBeNull();
  });

  it('stores upload errors and stops uploading', async () => {
    fileService.uploadFile.mockResolvedValue({
      success: false,
      message: '업로드 실패',
    });
    const { result } = renderHook(() => useChatFileUpload());

    let uploadError;
    await act(async () => {
      try {
        await result.current.uploadChatFile(
          { name: 'sample.pdf' },
          { token: 'token-1', sessionId: 'session-1' }
        );
      } catch (error) {
        uploadError = error;
      }
    });

    expect(uploadError).toEqual(new Error('업로드 실패'));
    expect(result.current.uploading).toBe(false);
    expect(result.current.uploadError).toBe('업로드 실패');
  });

  it('resets preview and upload state without changing upload activity', () => {
    const { result } = renderHook(() => useChatFileUpload());

    act(() => {
      result.current.setFilePreview({ name: 'sample.pdf' });
      result.current.setUploadError('이전 오류');
      result.current.setUploadProgress(70);
      result.current.setUploading(true);
    });

    act(() => {
      result.current.resetFileUpload();
    });

    expect(result.current.filePreview).toBeNull();
    expect(result.current.uploadError).toBeNull();
    expect(result.current.uploadProgress).toBe(0);
    expect(result.current.uploading).toBe(true);
  });
});
