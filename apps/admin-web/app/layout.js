import './globals.css';

export const metadata = {
  title: 'Workside Admin',
  description: 'Internal tools for Workside Home Seller Assistant',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
