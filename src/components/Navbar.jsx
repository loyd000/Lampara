import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Navbar.css';

export default function Navbar() {
    const [scrolled, setScrolled] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const location = useLocation();
    const isHome = location.pathname === '/';

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 40);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    // Close menu on route change
    useEffect(() => {
        setMenuOpen(false);
    }, [location]);

    // Prevent body scroll when menu open
    useEffect(() => {
        document.body.style.overflow = menuOpen ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [menuOpen]);

    const navLinks = isHome
        ? [
            { label: 'Home', href: '#home' },
            { label: 'About', href: '#about' },
            { label: 'Packages', href: '#packages' },
            { label: 'Gallery', to: '/gallery' },
            { label: 'Solar Info', href: '#solar-info' },
            { label: 'Contact', href: '#contact' },
        ]
        : [
            { label: 'Home', to: '/' },
            { label: 'About', to: '/#about' },
            { label: 'Packages', to: '/#packages' },
            { label: 'Gallery', to: '/gallery' },
            { label: 'Solar Info', to: '/#solar-info' },
            { label: 'Contact', to: '/#contact' },
        ];

    const handleAnchorClick = (e, href) => {
        e.preventDefault();
        const el = document.querySelector(href);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        setMenuOpen(false);
    };

    return (
        <>
            <nav className={`nav ${scrolled ? 'nav--scrolled' : ''}`}>
                <div className="nav__inner container">
                    <Link to="/" className="nav__logo">
                        <img src="/assets/logo.png" alt="Lampara" className="nav__logo-img" />
                        <span className="nav__logo-text">Lampara</span>
                    </Link>

                    {/* Desktop links */}
                    <ul className="nav__links">
                        {navLinks.map((link) =>
                            link.href ? (
                                <li key={link.label}>
                                    <a
                                        href={link.href}
                                        onClick={(e) => handleAnchorClick(e, link.href)}
                                    >
                                        {link.label}
                                    </a>
                                </li>
                            ) : (
                                <li key={link.label}>
                                    <Link
                                        to={link.to}
                                        className={location.pathname === link.to ? 'active' : ''}
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            )
                        )}
                    </ul>

                    {/* Mobile hamburger */}
                    <button
                        className={`nav__hamburger ${menuOpen ? 'open' : ''}`}
                        onClick={() => setMenuOpen(!menuOpen)}
                        aria-label="Toggle navigation"
                        aria-expanded={menuOpen}
                    >
                        <span />
                        <span />
                        <span />
                    </button>
                </div>
            </nav>

            {/* Mobile overlay */}
            {menuOpen && (
                <div className="nav__overlay" onClick={() => setMenuOpen(false)} />
            )}

            {/* Mobile drawer */}
            <div className={`nav__drawer ${menuOpen ? 'nav__drawer--open' : ''}`}>
                <ul>
                    {navLinks.map((link) =>
                        link.href ? (
                            <li key={link.label}>
                                <a
                                    href={link.href}
                                    onClick={(e) => handleAnchorClick(e, link.href)}
                                >
                                    {link.label}
                                </a>
                            </li>
                        ) : (
                            <li key={link.label}>
                                <Link
                                    to={link.to}
                                    className={location.pathname === link.to ? 'active' : ''}
                                    onClick={() => setMenuOpen(false)}
                                >
                                    {link.label}
                                </Link>
                            </li>
                        )
                    )}
                </ul>
            </div>
        </>
    );
}
