import './globals.css';
import Link from 'next/link';

export const metadata = {
  title: 'Workside Admin',
  description: 'Internal tools for Workside Home Seller Assistant',
};

const navigation = [
  { href: '/', label: 'Overview' },
  { href: '/users', label: 'Users' },
  { href: '/properties', label: 'Properties' },
  { href: '/billing', label: 'Billing' },
  { href: '/usage', label: 'Usage' },
  { href: '/workers', label: 'Workers' },
];

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="admin-layout">
          <aside className="sidebar">
            <div className="sidebar-brand">
              <div className="pill">Internal Console</div>
              <h1>Workside Admin</h1>
              <p className="muted">
                Operational visibility for the seller platform.
              </p>
            </div>
            <nav className="sidebar-nav">
              {navigation.map((item) => (
                <Link key={item.href} href={item.href} className="sidebar-link">
                  {item.label}
                </Link>
              ))}
            </nav>
          </aside>
          <main className="admin-main">{children}</main>
        </div>
      </body>
    </html>
  );
}
