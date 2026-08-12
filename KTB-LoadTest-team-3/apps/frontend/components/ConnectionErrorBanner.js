import { Text, VStack } from '@vapor-ui/core';

const ConnectionErrorBanner = ({ message, title = '연결에 문제가 생겼어요' }) => (
  <VStack
    $css={{
      alignItems: 'center',
      justifyContent: 'center',
      gap: 'var(--vapor-space-200)',
      padding: 'var(--vapor-space-500) var(--vapor-space-300)',
      textAlign: 'center',
    }}
  >
    <img
      src="/error.svg"
      alt=""
      style={{ width: '220px', maxWidth: '70%', height: 'auto' }}
    />
    <Text typography="heading4" foreground="normal-100">
      {title}
    </Text>
    <Text typography="body2" foreground="normal-200">
      {message}
    </Text>
  </VStack>
);

export default ConnectionErrorBanner;
