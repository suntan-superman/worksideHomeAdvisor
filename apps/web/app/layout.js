import '@workside/branding';

import '../styles/globals.css';

export const metadata = {
  title: 'Workside Home Seller Assistant',
  description: 'AI guidance for pricing, prep, marketing, and sale readiness.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
