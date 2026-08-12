import React from 'react';
import { useRouter } from 'next/router';
import { ThemeProvider } from '@vapor-ui/core';
import '@vapor-ui/core/styles.css';
import '../styles/globals.css';
import ChatHeader from '@/components/ChatHeader';
import ToastContainer from '@/components/Toast';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { SocketProvider } from '@/lib/socket/SocketProvider';

const AuthenticatedSocketProvider = ({ children }) => {
  const { user } = useAuth();

  return <SocketProvider session={user}>{children}</SocketProvider>;
};

function MyApp({ Component, pageProps }) {
  const router = useRouter();

  const isErrorPage = router.pathname === '/_error';
  if (isErrorPage) {
    return <Component {...pageProps} />;
  }

  // 로그인/회원가입 페이지에서는 헤더 숨김
  const showHeader = !['/', '/register'].includes(router.pathname);

  return (
    <ThemeProvider defaultTheme="dark">
      <AuthProvider>
        <AuthenticatedSocketProvider>
          {showHeader && <ChatHeader />}
          <Component {...pageProps} />
          <ToastContainer />
        </AuthenticatedSocketProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default MyApp;
