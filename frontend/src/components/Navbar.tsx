import { Link, useLocation } from 'react-router-dom';
import { ConnectButton } from '@rainbow-me/rainbowkit';

const NAV_LINKS = [
  { href: '/',           label: 'Home'       },
  { href: '/civusd',     label: 'CivUSD'     },
  { href: '/earn',       label: 'Earn Rep'   },
  { href: '/community',  label: 'Community'  },
  { href: '/app',        label: 'Dashboard'  },
  { href: '/xcm-demo',   label: 'XCM'        },
];

export function Navbar() {
  const { pathname } = useLocation();

  return (
    <header
      className="sticky top-0 z-50"
      style={{
        background: 'linear-gradient(180deg, #ffffff 0%, #f0fdf8 100%)',
        boxShadow: '0 1px 0 0 #d1fae5, 0 4px 16px 0 rgba(16,185,129,0.06)',
      }}
    >
      {/* Gradient accent line at the very top */}
      <div style={{
        height: '2.5px',
        background: 'linear-gradient(90deg, #16a34a 0%, #059669 40%, #0d9488 100%)',
      }} />

      <div className="w-full px-14 flex items-center" style={{ height: '62px' }}>

        {/* LEFT — Brand pushed to far left edge */}
        <Link to="/" className="flex flex-col justify-center leading-none select-none shrink-0">
          <span
            className="font-extrabold tracking-tight"
            style={{
              fontSize: '34px',
              lineHeight: 1,
              background: 'linear-gradient(90deg, #16a34a 0%, #059669 40%, #0d9488 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              fontFamily: '"Inter", "DM Sans", system-ui, sans-serif',
              letterSpacing: '-0.03em',
            }}
          >
            Civyx
          </span>
          <span style={{ fontSize: '10px', letterSpacing: '0.08em', marginTop: '2px', color: '#059669', opacity: 0.7, fontWeight: 600 }}>
            IDENTITY PROTOCOL
          </span>
        </Link>

        {/* CENTRE — Navigation links, true center via flex-1 */}
        <nav className="hidden md:flex items-center gap-1 flex-1 justify-center">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              to={href}
              className="px-4 py-2 rounded-full text-sm font-medium transition-all"
              style={pathname === href ? {
                background: 'linear-gradient(90deg, #dcfce7, #ccfbf1)',
                color: '#15803d',
                boxShadow: '0 0 0 1px #86efac',
              } : {
                color: '#6b7280',
              }}
              onMouseEnter={e => {
                if (pathname !== href) {
                  (e.currentTarget as HTMLElement).style.color = '#111827';
                  (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.04)';
                }
              }}
              onMouseLeave={e => {
                if (pathname !== href) {
                  (e.currentTarget as HTMLElement).style.color = '#6b7280';
                  (e.currentTarget as HTMLElement).style.background = '';
                }
              }}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* RIGHT — Wallet connect pushed to far right edge */}
        <div className="flex items-center shrink-0 ml-auto md:ml-0">
          <ConnectButton
            showBalance={false}
            chainStatus="none"
            accountStatus="address"
          />
        </div>

      </div>
    </header>
  );
}
