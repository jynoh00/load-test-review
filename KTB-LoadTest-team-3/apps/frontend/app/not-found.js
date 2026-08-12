'use client';

import { useRouter } from 'next/navigation';
import { Button, Text, VStack } from '@vapor-ui/core';

export default function NotFound() {
  const router = useRouter();

  return (
    <VStack
      $css={{
        minHeight: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--vapor-space-300)',
        padding: 'var(--vapor-space-400)',
        textAlign: 'center',
        backgroundColor: 'var(--vapor-color-background)',
      }}
    >
      <img
        src="/404-dark.svg"
        alt=""
        style={{ width: '280px', maxWidth: '80%', height: 'auto' }}
      />
      <Text typography="heading3" foreground="normal-100">
        페이지를 찾을 수 없어요
      </Text>
      <Text typography="body2" foreground="normal-200">
        요청하신 페이지를 찾을 수 없습니다.
        <br />
        주소를 다시 확인해주세요.
      </Text>
      <Button colorPalette="primary" onClick={() => router.push('/')}>
        홈으로 돌아가기
      </Button>
    </VStack>
  );
}
