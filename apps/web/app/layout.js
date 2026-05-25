import '@workside/branding';

import Script from 'next/script';

import '../styles/globals.css';
import { WebQueryProvider } from '../components/WebQueryProvider';
import WebsiteChatWidget from '../components/WebsiteChatWidget';

export const metadata = {
  title: 'Workside Home Seller Assistant',
  description: 'AI guidance for pricing, prep, marketing, and sale readiness.',
};

export default function RootLayout({ children }) {
  const metaPixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;

  return (
    <html lang="en">
      <body>
        {metaPixelId ? (
          <>
            <Script id="meta-pixel" strategy="afterInteractive">
              {`
                !function(f,b,e,v,n,t,s)
                {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                n.queue=[];t=b.createElement(e);t.async=!0;
                t.src=v;s=b.getElementsByTagName(e)[0];
                s.parentNode.insertBefore(t,s)}(window, document,'script',
                'https://connect.facebook.net/en_US/fbevents.js');
                fbq('init', '${metaPixelId}');
                fbq('track', 'PageView');
              `}
            </Script>
            <noscript>
              <img
                height="1"
                width="1"
                style={{ display: 'none' }}
                src={`https://www.facebook.com/tr?id=${metaPixelId}&ev=PageView&noscript=1`}
                alt=""
              />
            </noscript>
          </>
        ) : null}
        <WebQueryProvider>
          {children}
          <WebsiteChatWidget />
        </WebQueryProvider>
      </body>
    </html>
  );
}
