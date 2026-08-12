import '@vapor-ui/core/styles.css';
import '../styles/globals.css';
import AppProviders from './providers';

export const metadata = {
  title: 'KTB Chat',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
