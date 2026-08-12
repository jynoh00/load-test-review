'use client';

import { ThemeProvider } from '@vapor-ui/core';
import { useRouter } from 'next/navigation';
import ToastContainer from '@/components/Toast';
import { AuthProviderWithRouter, useAuth } from '@/contexts/AuthContext';
import { SocketProvider } from '@/lib/socket/SocketProvider';

const AuthenticatedSocketProvider = ({ children }) => {
  const { user } = useAuth();

  return (
    <SocketProvider session={user}>
      {children}
    </SocketProvider>
  );
};

export default function AppProviders({ children }) {
  const router = useRouter();

  return (
    <ThemeProvider defaultTheme="dark">
      <AuthProviderWithRouter router={router}>
        <AuthenticatedSocketProvider>
          {children}
          <ToastContainer />
        </AuthenticatedSocketProvider>
      </AuthProviderWithRouter>
    </ThemeProvider>
  );
}
