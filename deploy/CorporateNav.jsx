import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

export default function Nav({ activePath, variant, backTo, backLabel, quoteHref }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close menu on route change
  useEffect(() => { setMenuOpen(false); }, [location]);

  // Prevent body scroll when menu open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  return (
    <>
      <header id="nav" className={[scrolled ? 'scrolled' : '', menuOpen ? 'menu-open' : ''].join(' ').trim()}>
        <div className="nav-inner">
          <Link to="/" className="nav-logo" onClick={() => setMenuOpen(false)}>
            <img src="/logo-256ai.png" alt="256 AI Systems" className="nav-logo-img" />
            <span className="nav-corporate-label">Corporate</span>
          </Link>

          <nav className="nav-links">
            <Link to="/" className={activePath === '/' ? 'active' : ''}>Home</Link>
            <Link to="/enterprise" className={activePath === '/enterprise' ? 'active' : ''}>Enterprise</Link>
            <Link to="/web-digital" className={activePath === '/web-digital' ? 'active' : ''}>Web &amp; Digital</Link>
            <a href="https://shield.256.co.ug" target="_blank" rel="noopener noreferrer">Shield ↗</a>
            <a href="https://linkshield.256.co.ug" target="_blank" rel="noopener noreferrer">LinkShield ↗</a>
            <Link to="/#platforms">Our Platforms</Link>
            <Link to="/news" className={activePath === '/news' ? 'active' : ''}>News</Link>
            <Link to="/volunteer/sign-in" className={activePath?.startsWith('/volunteer') ? 'active' : ''}>Volunteer</Link>
          </nav>

          <div className="nav-right">
            {variant === 'service' ? (
              <>
                <Link to={backTo || '/enterprise'} className="nav-back">{backLabel || '← Enterprise'}</Link>
                <Link to={quoteHref || '/consultation'} className="nav-cta">Get a Quote →</Link>
              </>
            ) : variant === 'consult' ? (
              <>
                <Link to={backTo || '/enterprise'} className="nav-back">{backLabel || '← Enterprise'}</Link>
                <a href="https://portal.256.co.ug" target="_blank" rel="noreferrer" className="nav-cta">Client Portal ↗</a>
              </>
            ) : (
              <>
                <a href="https://portal.256.co.ug" target="_blank" rel="noreferrer" className="nav-portal">Client Portal ↗</a>
                <Link to="/consultation" className="nav-cta">Consultation →</Link>
              </>
            )}
          </div>

          <button
            className={`nav-hamburger${menuOpen ? ' open' : ''}`}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(v => !v)}
          >
            <span /><span /><span />
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="nav-drawer" role="dialog" aria-label="Navigation menu">
          <nav className="nav-drawer-links">
            <Link to="/">Home</Link>
            <Link to="/enterprise">Enterprise</Link>
            <Link to="/web-digital">Web &amp; Digital</Link>
            <a href="https://shield.256.co.ug" target="_blank" rel="noopener noreferrer">Shield ↗</a>
            <a href="https://linkshield.256.co.ug" target="_blank" rel="noopener noreferrer">LinkShield ↗</a>
            <Link to="/#platforms">Our Platforms</Link>
            <Link to="/news">News</Link>
            <Link to="/volunteer/sign-in">Volunteer</Link>
          </nav>
          <div className="nav-drawer-ctas">
            <a href="https://portal.256.co.ug" target="_blank" rel="noreferrer" className="nav-drawer-portal">Client Portal ↗</a>
            <Link to="/consultation" className="nav-drawer-consult">Consultation →</Link>
          </div>
        </div>
      )}
    </>
  );
}
