import { Link } from 'react-router-dom';
import './Footer.css';

export default function Footer() {
    return (
        <footer className="footer">
            <div className="container">
                <div className="footer__grid">
                    <div className="footer__brand">
                        <Link to="/" className="footer__logo">
                            <img src="/assets/logo.png" alt="Lampara" />
                            <span>Lampara</span>
                        </Link>
                        <p>Empowering homes with clean, renewable solar energy.</p>
                    </div>

                    <div className="footer__col">
                        <h4>Quick Links</h4>
                        <ul>
                            <li><Link to="/">Home</Link></li>
                            <li><Link to="/#packages">Packages</Link></li>
                            <li><Link to="/gallery">Gallery</Link></li>
                            <li><Link to="/#contact">Contact</Link></li>
                        </ul>
                    </div>

                    <div className="footer__col">
                        <h4>Connect</h4>
                        <ul>
                            <li>
                                <a
                                    href="https://facebook.com/lamparaeis"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    Facebook
                                </a>
                            </li>
                            <li>Metro Manila & Calabarzon</li>
                        </ul>
                    </div>
                </div>

                <div className="footer__bottom">
                    <p>&copy; {new Date().getFullYear()} Lampara Solar Power Installation</p>
                </div>
            </div>
        </footer>
    );
}
