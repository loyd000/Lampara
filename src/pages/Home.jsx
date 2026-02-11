import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase.js';
import './Home.css';

export default function Home() {
    return (
        <main>
            <Hero />
            <Stats />
            <About />
            <Packages />
            <Installations />
            <SolarInfo />
            <Calculator />
            <Testimonials />
            <FAQ />
            <Contact />
            <BackToTop />
            <MessengerFab />
        </main>
    );
}

/* ============================
   HERO
   ============================ */
function Hero() {
    return (
        <section id="home" className="hero">
            <div className="hero__overlay" />
            <div className="container hero__content">
                <div className="hero__badge badge badge-gold">Trusted Solar Partner</div>
                <h1 className="hero__title">
                    Power Outage Worries,<br />
                    <span className="hero__accent">No More.</span>
                </h1>
                <p className="hero__sub">
                    Professional solar installation that saves up to 90% on electricity bills.
                    Premium hybrid systems backed by 25-year warranty.
                </p>
                <div className="hero__actions">
                    <a href="#packages" className="btn btn-gold btn-lg">View Packages</a>
                    <a href="#contact" className="btn btn-outline btn-lg" style={{ borderColor: 'rgba(255,255,255,0.3)', color: '#fff' }}>
                        Get Free Quote
                    </a>
                </div>
                <div className="hero__trust">
                    <div className="hero__trust-item">
                        <strong>1000+</strong>
                        <span>Installations</span>
                    </div>
                    <div className="hero__trust-sep" />
                    <div className="hero__trust-item">
                        <strong>25 yr</strong>
                        <span>Warranty</span>
                    </div>
                    <div className="hero__trust-sep" />
                    <div className="hero__trust-item">
                        <strong>5MW+</strong>
                        <span>Installed</span>
                    </div>
                </div>
            </div>
        </section>
    );
}

/* ============================
   STATS
   ============================ */
function Stats() {
    const stats = [
        { value: '5+', label: 'Years Experience' },
        { value: '1,000+', label: 'Installations' },
        { value: '100%', label: 'Satisfied Clients' },
        { value: '5MW+', label: 'Power Installed' },
    ];

    return (
        <section className="stats">
            <div className="container">
                <div className="stats__grid">
                    {stats.map((s) => (
                        <div key={s.label} className="stats__item">
                            <div className="stats__value">{s.value}</div>
                            <div className="stats__label">{s.label}</div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

/* ============================
   ABOUT
   ============================ */
function About() {
    return (
        <section id="about" className="section">
            <div className="container">
                <div className="about">
                    <div className="about__text">
                        <div className="section-header">
                            <div className="badge badge-gold">About Us</div>
                            <h2>Your Trusted Solar Partner</h2>
                            <p>
                                Lampara specializes in complete solar power installation services,
                                providing high-quality systems that reduce your electricity bills
                                and environmental impact.
                            </p>
                        </div>
                        <p>
                            Our team of certified professionals ensures every installation meets
                            the highest standards, with comprehensive warranties and ongoing
                            support. From residential homes to commercial establishments, we
                            design custom solar solutions that fit your energy needs and budget.
                        </p>
                    </div>
                    <div className="about__image">
                        <img
                            src="https://images.unsplash.com/photo-1552664730-d307ca884978?w=600&h=450&fit=crop"
                            alt="Lampara Solar Installation Team"
                            loading="lazy"
                        />
                    </div>
                </div>
            </div>
        </section>
    );
}

/* ============================
   PACKAGES
   ============================ */
function Packages() {
    return (
        <section id="packages" className="section packages-section">
            <div className="container">
                <div className="section-header center">
                    <div className="badge badge-gold">Pricing</div>
                    <h2>Solar Packages 2025</h2>
                    <p>Complete systems with installation and warranty coverage</p>
                </div>

                <div className="packages__grid">
                    <div className="card packages__card">
                        <h3>Additional Batteries</h3>
                        <div className="packages__items">
                            <div className="packages__row">
                                <span>Dyness 51.2V100AH</span>
                                <span className="packages__price">₱72,500</span>
                            </div>
                            <div className="packages__row">
                                <span>Dyness 51.2V280AH</span>
                                <span className="packages__price">₱120,000</span>
                            </div>
                            <div className="packages__row">
                                <span>Pylontech 48V100AH</span>
                                <span className="packages__price">₱53,000</span>
                            </div>
                        </div>
                    </div>

                    <div className="card packages__card">
                        <h3>Netmetering Packages</h3>
                        <div className="packages__items">
                            <div className="packages__row">
                                <span>Service Entrance Rectification</span>
                                <span className="packages__price">₱20,000 – ₱35,000</span>
                            </div>
                            <div className="packages__row">
                                <span>Documentation & Leg Works</span>
                                <span className="packages__price">₱30,000</span>
                            </div>
                        </div>
                        <p className="packages__note">
                            *Final price varies depending on LGU requirements
                        </p>
                    </div>
                </div>

                <div className="card packages__warranty">
                    <h3>Warranty Coverage</h3>
                    <div className="packages__warranty-grid">
                        <div className="packages__warranty-item">
                            <strong>Solar Panels 550–580W</strong>
                            <span>12 years product warranty</span>
                        </div>
                        <div className="packages__warranty-item">
                            <strong>Solis Hybrid Inverter</strong>
                            <span>5 years product warranty</span>
                        </div>
                        <div className="packages__warranty-item">
                            <strong>Dyness Lithium Battery</strong>
                            <span>5 years product warranty</span>
                        </div>
                        <div className="packages__warranty-item">
                            <strong>Pylontech Lithium Battery</strong>
                            <span>5 years product warranty</span>
                        </div>
                        <div className="packages__warranty-item">
                            <strong>After Sales</strong>
                            <span>1 year accessories & 3 years workmanship</span>
                        </div>
                    </div>
                    <p className="packages__note">
                        All packages include complete materials with installation. Prices may vary
                        based on roof type and location outside our standard service area.
                    </p>
                </div>
            </div>
        </section>
    );
}

/* ============================
   INSTALLATIONS (Featured)
   ============================ */
function Installations() {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            try {
                const { data, error } = await supabase
                    .from('projects')
                    .select('*, project_photos(storage_path)')
                    .order('order_index', { ascending: false })
                    .limit(3);

                if (error) throw error;
                setProjects(data || []);
            } catch (err) {
                console.error('Error loading featured projects:', err);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    const getCover = (project) => {
        const photos = project.project_photos || [];
        if (photos.length === 0) return null;
        return supabase.storage
            .from('project-images')
            .getPublicUrl(photos[0].storage_path).data.publicUrl + '?width=600&resize=cover';
    };

    return (
        <section id="installations" className="section">
            <div className="container">
                <div className="section-header center">
                    <div className="badge badge-gold">Portfolio</div>
                    <h2>Featured Installations</h2>
                    <p>Recent solar power projects across Metro Manila and nearby provinces</p>
                </div>

                <div className="installs__grid">
                    {loading
                        ? [0, 1, 2].map((i) => (
                            <div key={i} className="skeleton installs__skeleton" />
                        ))
                        : projects.map((p) => (
                            <div key={p.id} className="card installs__card">
                                <div className="installs__img">
                                    {getCover(p) && (
                                        <img src={getCover(p)} alt={p.title} loading="lazy" />
                                    )}
                                </div>
                                <div className="installs__info">
                                    <h3>{p.title}</h3>
                                    <p>{p.specs}</p>
                                </div>
                            </div>
                        ))}
                </div>

                <div className="text-center" style={{ marginTop: 'var(--sp-10)' }}>
                    <a href="/gallery" className="btn btn-primary">View Full Gallery</a>
                </div>
            </div>
        </section>
    );
}

/* ============================
   SOLAR INFO
   ============================ */
function SolarInfo() {
    const benefits = [
        {
            icon: (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="10" /><path d="M8 12l2 2 4-4" />
                </svg>
            ),
            title: 'Save Money',
            desc: 'Reduce electricity bills by up to 90%. Pay off your investment in 3–5 years.',
        },
        {
            icon: (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M12 3v1m0 16v1m-7.07-2.93l.71-.71m12.02-12.02l.71-.71M3 12h1m16 0h1m-2.93 7.07l-.71-.71M6.34 6.34l-.71-.71" />
                    <circle cx="12" cy="12" r="4" />
                </svg>
            ),
            title: 'Clean Energy',
            desc: 'Reduce your carbon footprint with renewable energy from the sun.',
        },
        {
            icon: (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="6" y="7" width="12" height="13" rx="1" /><path d="M10 7V5a2 2 0 014 0v2" /><path d="M9 14h6" /><path d="M9 11h6" />
                </svg>
            ),
            title: 'Energy Independence',
            desc: 'Generate your own electricity and reduce dependence on the grid.',
        },
        {
            icon: (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M3 22V8l9-6 9 6v14" /><path d="M9 22V12h6v10" />
                </svg>
            ),
            title: 'Property Value',
            desc: 'Solar installations increase home value and attract buyers.',
        },
    ];

    return (
        <section id="solar-info" className="section" style={{ background: 'var(--surface-alt)' }}>
            <div className="container">
                <div className="section-header center">
                    <div className="badge badge-gold">Why Solar</div>
                    <h2>Why Choose Solar Power?</h2>
                </div>
                <div className="benefits__grid">
                    {benefits.map((b) => (
                        <div key={b.title} className="card benefits__card">
                            <div className="benefits__icon">{b.icon}</div>
                            <h3>{b.title}</h3>
                            <p>{b.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

/* ============================
   CALCULATOR
   ============================ */
function Calculator() {
    const [selected, setSelected] = useState(6.6);
    const [prices, setPrices] = useState({});
    const sizes = [3.3, 6.6, 8.3, 12.2];

    useEffect(() => {
        fetch('/config/pricing.json')
            .then((r) => r.json())
            .then(setPrices)
            .catch(console.error);
    }, []);

    const SUN_HOURS = 4.5;
    const DERATING = 0.8;
    const RATE = 12;
    const DAYS = 30;

    const daily = selected * SUN_HOURS * DERATING;
    const monthly = Math.round(daily * RATE * DAYS);
    const annual = monthly * 12;
    const systemPrice = prices[selected] || 195000;
    const payback = annual > 0 ? (systemPrice / annual).toFixed(1) : 'N/A';

    return (
        <section id="calculator" className="section">
            <div className="container">
                <div className="section-header center">
                    <div className="badge badge-gold">Estimate</div>
                    <h2>Solar Savings Calculator</h2>
                    <p>See how much you could save with solar power</p>
                </div>

                <div className="calc">
                    <div className="calc__sizes">
                        <label className="calc__label">System Size (kWp)</label>
                        <div className="calc__options">
                            {sizes.map((s) => (
                                <button
                                    key={s}
                                    className={`calc__btn ${selected === s ? 'calc__btn--active' : ''}`}
                                    onClick={() => setSelected(s)}
                                >
                                    {s} kWp
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="calc__results">
                        <div className="calc__result">
                            <span className="calc__result-label">Monthly Savings</span>
                            <span className="calc__result-value">₱{monthly.toLocaleString()}</span>
                        </div>
                        <div className="calc__divider" />
                        <div className="calc__result">
                            <span className="calc__result-label">Annual Savings</span>
                            <span className="calc__result-value">₱{annual.toLocaleString()}</span>
                        </div>
                        <div className="calc__divider" />
                        <div className="calc__result">
                            <span className="calc__result-label">Payback Period</span>
                            <span className="calc__result-value">{payback === 'N/A' ? payback : `${payback} yrs`}</span>
                        </div>
                    </div>

                    <p className="calc__note">
                        Based on average solar efficiency and current electricity rates.
                        Actual savings may vary.
                    </p>
                </div>
            </div>
        </section>
    );
}

/* ============================
   TESTIMONIALS
   ============================ */
function Testimonials() {
    const items = [
        {
            text: 'My electricity bill went down from ₱12k to just ₱800! Best investment for my home.',
            name: 'John D.',
            info: 'Cavite · 6.6kWp Hybrid',
            initials: 'JD',
        },
        {
            text: 'Highly recommended! Installation was fast and clean. No more brownout worries.',
            name: 'Maria S.',
            info: 'Laguna · 5kWp Hybrid',
            initials: 'MS',
        },
        {
            text: 'Great after-sales support. They helped me monitor my harvesting through the app.',
            name: 'Robert J.',
            info: 'Batangas · 10kWp Hybrid',
            initials: 'RJ',
        },
    ];

    return (
        <section className="section" style={{ background: 'var(--surface-alt)' }}>
            <div className="container">
                <div className="section-header center">
                    <div className="badge badge-gold">Testimonials</div>
                    <h2>What Our Clients Say</h2>
                </div>
                <div className="testimonials__grid">
                    {items.map((t) => (
                        <div key={t.name} className="card testimonials__card">
                            <p className="testimonials__text">"{t.text}"</p>
                            <div className="testimonials__author">
                                <div className="testimonials__avatar">{t.initials}</div>
                                <div>
                                    <strong>{t.name}</strong>
                                    <span>{t.info}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

/* ============================
   FAQ
   ============================ */
function FAQ() {
    const items = [
        {
            q: 'How much can I save with solar?',
            a: 'Most homeowners save 80–90% on their monthly electricity bill. The exact amount depends on your system size and usage habits.',
        },
        {
            q: 'What happens during brownouts?',
            a: 'With a Hybrid System (includes batteries), your essential appliances continue running. Standard On-Grid systems will shut down for safety.',
        },
        {
            q: 'How long is the warranty?',
            a: 'We offer a 25-Year Linear Performance Warranty on solar panels and a 5-Year Warranty on inverters (extendable).',
        },
        {
            q: 'Do you handle the permits?',
            a: 'Yes! We assist with all necessary Net Metering applications and LGU permits required for installation.',
        },
    ];

    return (
        <section className="section">
            <div className="container">
                <div className="section-header center">
                    <div className="badge badge-gold">FAQ</div>
                    <h2>Frequently Asked Questions</h2>
                </div>
                <div className="faq__list">
                    {items.map((item) => (
                        <FAQItem key={item.q} q={item.q} a={item.a} />
                    ))}
                </div>
            </div>
        </section>
    );
}

function FAQItem({ q, a }) {
    const [open, setOpen] = useState(false);

    return (
        <div className={`faq__item ${open ? 'faq__item--open' : ''}`}>
            <button className="faq__question" onClick={() => setOpen(!open)}>
                <span>{q}</span>
                <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="faq__chevron"
                >
                    <path d="M6 9l6 6 6-6" />
                </svg>
            </button>
            <div className="faq__answer">
                <p>{a}</p>
            </div>
        </div>
    );
}

/* ============================
   CONTACT
   ============================ */
function Contact() {
    return (
        <section id="contact" className="contact-section">
            <div className="container">
                <div className="contact__inner">
                    <div className="section-header">
                        <h2 style={{ color: '#fff' }}>Ready to Go Solar?</h2>
                        <p style={{ color: 'rgba(255,255,255,0.7)' }}>
                            Contact us today for a free consultation and quote.
                        </p>
                    </div>
                    <a
                        href="https://www.facebook.com/lamparaeis"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-gold btn-lg"
                    >
                        Message us on Facebook
                    </a>
                    <p className="contact__area">
                        Servicing: Metro Manila, Cavite, Laguna, Batangas, Rizal, Quezon
                    </p>
                </div>
            </div>
        </section>
    );
}

/* ============================
   BACK TO TOP
   ============================ */
function BackToTop() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const onScroll = () => setVisible(window.scrollY > 500);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    return (
        <button
            className={`back-to-top ${visible ? 'back-to-top--visible' : ''}`}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            aria-label="Back to top"
        >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 15l-6-6-6 6" />
            </svg>
        </button>
    );
}

/* ============================
   MESSENGER FAB
   ============================ */
function MessengerFab() {
    return (
        <a
            href="https://m.me/lamparaeis"
            target="_blank"
            rel="noopener noreferrer"
            className="messenger-fab"
            aria-label="Chat with us on Messenger"
        >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#fff">
                <path d="M12 2C6.48 2 2 6.03 2 11c0 2.87 1.51 5.43 3.89 7.18H3v3.5l3.52-1.93c1.68.73 3.55 1.15 5.48 1.15 5.52 0 10-4.03 10-9S17.52 2 12 2zm1.19 12.11L10.5 11.23l-4.37 4.19 4.81-5.11 2.69 2.88 4.36-4.18-4.8 5.1z" />
            </svg>
        </a>
    );
}
