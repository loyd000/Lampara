import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';
import { checkRateLimit } from '../lib/rateLimit.js';
import './Schedule.css';

// ============================================================
// EmailJS Credentials from Environment Variables
// ============================================================
const EMAILJS_SERVICE_ID      = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const EMAILJS_COMPANY_TPL     = import.meta.env.VITE_EMAILJS_BOOKING_TEMPLATE_ID;
const EMAILJS_PUBLIC_KEY      = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
// ============================================================

const MONTH_NAMES = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
];
const DAY_HEADERS = ['SUN','MON','TUE','WED','THU','FRI','SAT'];

const STATUS_CFG = {
    open:          { icon: '☀️', label: 'Open for Booking',       cls: 'open',          clickable: true  },
    not_available: { icon: '❌', label: 'Not Available',           cls: 'not-available', clickable: false },
    scheduled:     { icon: '✅', label: 'Scheduled Installation',  cls: 'scheduled',     clickable: false },
    pending:       { icon: '📋', label: 'For Confirmation',        cls: 'pending',       clickable: false },
};

function toDateStr(year, month, day) {
    return `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

function formatDisplay(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-PH', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
}

async function sendEmail(templateId, params) {
    try {
        const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                service_id: EMAILJS_SERVICE_ID,
                template_id: templateId,
                user_id: EMAILJS_PUBLIC_KEY,
                template_params: params,
            }),
        });
        
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.message || `HTTP ${response.status}`);
        }
        
        return null; // Success
    } catch (err) {
        console.error('Email send failed:', err);
        return err.message; // Return error message
    }
}

/* ============================================================
   PUBLIC SCHEDULE PAGE
   ============================================================ */
export default function Schedule() {
    const today      = new Date();
    const todayStr   = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());

    const [viewDate, setViewDate]         = useState(new Date(today.getFullYear(), today.getMonth(), 1));
    const [slots, setSlots]               = useState({});
    const [loading, setLoading]           = useState(true);
    const [bookingDate, setBookingDate]   = useState(null);
    const [successMsg, setSuccessMsg]     = useState('');

    const year  = viewDate.getFullYear();
    const month = viewDate.getMonth();

    useEffect(() => { loadSlots(); }, [viewDate]);

    async function loadSlots() {
        setLoading(true);
        const start = toDateStr(year, month, 1);
        const end   = toDateStr(year, month, new Date(year, month + 1, 0).getDate());
        const { data } = await supabase
            .from('schedule_slots')
            .select('*')
            .gte('date', start)
            .lte('date', end);
        const map = {};
        (data || []).forEach(s => { map[s.date] = s; });
        setSlots(map);
        setLoading(false);
    }

    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const daysInMonth    = new Date(year, month + 1, 0).getDate();
    const cells = [
        ...Array(firstDayOfWeek).fill(null),
        ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];

    const handleDayClick = (day) => {
        const ds   = toDateStr(year, month, day);
        const slot = slots[ds];
        if (slot?.status === 'open' && ds >= todayStr) {
            setSuccessMsg('');
            setBookingDate(ds);
        }
    };

    return (
        <main>
            {/* Hero */}
            <section className="schedule-hero">
                <div className="container schedule-hero__inner">
                    <div className="badge badge-gold">Availability</div>
                    <h1>Installation Schedule</h1>
                    <p>
                        View our monthly availability and request an installation slot.
                        Click on a ☀️ day to book your appointment.
                    </p>
                </div>
            </section>

            {/* Calendar */}
            <section className="section">
                <div className="container">
                    <div className="sched-card" data-aos="fade-up">

                        {/* Month navigator */}
                        <div className="sched-nav">
                            <button
                                className="sched-nav__btn"
                                onClick={() => setViewDate(new Date(year, month - 1, 1))}
                                aria-label="Previous month"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M15 18l-6-6 6-6" />
                                </svg>
                            </button>
                            <h2 className="sched-nav__title">{MONTH_NAMES[month]} {year}</h2>
                            <button
                                className="sched-nav__btn"
                                onClick={() => setViewDate(new Date(year, month + 1, 1))}
                                aria-label="Next month"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M9 18l6-6-6-6" />
                                </svg>
                            </button>
                        </div>

                        {loading ? (
                            <div className="sched-loading"><div className="spinner" /></div>
                        ) : (
                            <>
                                {/* Day-of-week headers */}
                                <div className="sched-grid sched-grid--headers">
                                    {DAY_HEADERS.map(d => (
                                        <div key={d} className="sched-dow">{d}</div>
                                    ))}
                                </div>

                                {/* Day cells */}
                                <div className="sched-grid">
                                    {cells.map((day, idx) => {
                                        if (!day) return <div key={`e${idx}`} className="sched-cell sched-cell--empty" />;

                                        const ds     = toDateStr(year, month, day);
                                        const slot   = slots[ds];
                                        const cfg    = slot ? STATUS_CFG[slot.status] : null;
                                        const isPast = ds < todayStr;
                                        const isToday = ds === todayStr;
                                        const canClick = cfg?.clickable && !isPast;

                                        return (
                                            <div
                                                key={ds}
                                                className={[
                                                    'sched-cell',
                                                    cfg  ? `sched-cell--${cfg.cls}` : '',
                                                    canClick ? 'sched-cell--clickable' : '',
                                                    isPast   ? 'sched-cell--past'     : '',
                                                    isToday  ? 'sched-cell--today'    : '',
                                                ].filter(Boolean).join(' ')}
                                                onClick={() => canClick && handleDayClick(day)}
                                                role={canClick ? 'button' : undefined}
                                                tabIndex={canClick ? 0 : undefined}
                                                onKeyDown={e => e.key === 'Enter' && canClick && handleDayClick(day)}
                                                aria-label={cfg ? `${ds}: ${cfg.label}` : ds}
                                            >
                                                <span className="sched-cell__num">{day}</span>
                                                {cfg && (
                                                    <div className="sched-cell__body">
                                                        <span className="sched-cell__icon">{cfg.icon}</span>
                                                        {slot?.status === 'scheduled' && slot.location && (
                                                            <span className="sched-cell__loc">{slot.location}</span>
                                                        )}
                                                        {canClick && (
                                                            <span className="sched-cell__hint">Book</span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        )}

                        {/* Legend */}
                        <div className="sched-legend">
                            {Object.entries(STATUS_CFG).map(([key, cfg]) => (
                                <div key={key} className="sched-legend__item">
                                    <span className={`sched-legend__icon sched-legend__icon--${cfg.cls}`}>{cfg.icon}</span>
                                    <span>{cfg.label}</span>
                                </div>
                            ))}
                        </div>

                        <p className="sched-asof">
                            as of {today.toLocaleDateString('en-PH', { month:'long', day:'numeric', year:'numeric' })}
                        </p>
                    </div>
                </div>
            </section>

            {/* Booking Modal */}
            {bookingDate && (
                <BookingModal
                    date={bookingDate}
                    dateDisplay={formatDisplay(bookingDate)}
                    onClose={() => setBookingDate(null)}
                    onSuccess={(msg) => { setBookingDate(null); setSuccessMsg(msg); }}
                />
            )}

            {/* Success Toast */}
            {successMsg && (
                <div className="sched-toast">
                    <span>✅ {successMsg}</span>
                    <button onClick={() => setSuccessMsg('')} aria-label="Dismiss">×</button>
                </div>
            )}
        </main>
    );
}

/* ============================================================
   BOOKING MODAL
   ============================================================ */
function BookingModal({ date, dateDisplay, onClose, onSuccess }) {
    const [form, setForm] = useState({ name:'', email:'', phone:'', address:'', message:'' });
    const [sending, setSending] = useState(false);
    const [error, setError]     = useState('');

    const handleChange = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

    const validateBooking = () => {
        // Trim whitespace for validation
        const name = form.name.trim();
        const email = form.email.trim();
        const phone = form.phone.trim();
        const address = form.address.trim();
        
        // Validate name
        if (!name || name.length < 2) {
            return 'Please enter a valid full name (at least 2 characters)';
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return 'Please enter a valid email address';
        }
        
        // Validate phone if provided
        if (phone && !/^[\d\s\-\+\(\)]{7,}$/.test(phone)) {
            return 'Please enter a valid phone number';
        }
        
        // Validate address
        if (!address || address.length < 5) {
            return 'Please enter a valid address (at least 5 characters)';
        }
        
        return null; // No errors
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        
        // Check rate limit - max 3 booking attempts per 2 minutes
        const rateLimitCheck = checkRateLimit('booking_form', { maxAttempts: 3, windowMs: 120000 });
        if (rateLimitCheck.isLimited) {
            setError(`❌ Too many booking attempts. Please wait ${rateLimitCheck.retryAfter} seconds before trying again.`);
            return;
        }
        
        // Validate before submitting
        const validationError = validateBooking();
        if (validationError) {
            setError(validationError);
            return;
        }
        
        setSending(true);

        try {
            // Sanitize inputs: trim whitespace
            const sanitized = {
                date,
                name: form.name.trim(),
                email: form.email.toLowerCase().trim(),
                phone: form.phone?.trim() || null,
                address: form.address.trim(),
                message: form.message?.trim() || null,
            };
            
            // 1. Save booking to Supabase
            const { error: dbErr } = await supabase.from('bookings').insert(sanitized);
            if (dbErr) throw new Error(`Database error: ${dbErr.message}`);

            // 2. Notify company
            const emailErr = await sendEmail(EMAILJS_COMPANY_TPL, {
                booking_date:   dateDisplay,
                client_name:    sanitized.name,
                client_email:   sanitized.email,
                client_phone:   sanitized.phone   || 'Not provided',
                client_address: sanitized.address,
                client_message: sanitized.message || 'No additional notes',
                to_email:       'lamparaeis@gmail.com',
            });
            
            // Email failure is not critical - booking already saved
            if (emailErr) {
                console.warn('Email notification failed:', emailErr);
            }

            onSuccess('Booking submitted! We\'ll reach out within 24 hours to confirm your appointment.');
        } catch (err) {
            console.error('Booking error:', err);
            setError(`Booking failed: ${err.message}. Please try again or message us on Facebook.`);
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="sched-overlay" onClick={onClose}>
            <div className="sched-modal" onClick={e => e.stopPropagation()}>
                <div className="sched-modal__header">
                    <div>
                        <h3>Request a Booking</h3>
                        <p className="sched-modal__date">📅 {dateDisplay}</p>
                    </div>
                    <button className="sched-modal__close" onClick={onClose} aria-label="Close">×</button>
                </div>

                <form onSubmit={handleSubmit} className="sched-modal__form" noValidate>
                    <div className="sched-field">
                        <label htmlFor="bk-name">Full Name *</label>
                        <input
                            id="bk-name"
                            name="name"
                            value={form.name}
                            onChange={handleChange}
                            required
                            placeholder="Juan dela Cruz"
                            aria-label="Full Name"
                            aria-required="true"
                        />
                    </div>

                    <div className="sched-row">
                        <div className="sched-field">
                            <label htmlFor="bk-email">Email Address *</label>
                            <input
                                id="bk-email"
                                name="email"
                                type="email"
                                value={form.email}
                                onChange={handleChange}
                                required
                                placeholder="you@email.com"
                                aria-label="Email Address"
                                aria-required="true"
                                aria-describedby={error ? 'booking-error' : undefined}
                            />
                        </div>
                        <div className="sched-field">
                            <label htmlFor="bk-phone">
                                Phone <span className="sched-optional">(Optional)</span>
                            </label>
                            <input
                                id="bk-phone"
                                name="phone"
                                type="tel"
                                value={form.phone}
                                onChange={handleChange}
                                placeholder="09XX XXX XXXX"
                                aria-label="Phone (optional)"
                            />
                        </div>
                    </div>

                    <div className="sched-field">
                        <label htmlFor="bk-address">Property Address *</label>
                        <input
                            id="bk-address"
                            name="address"
                            value={form.address}
                            onChange={handleChange}
                            required
                            aria-label="Property Address"
                            aria-required="true"
                            placeholder="e.g. Brgy. San Jose, Cavite City, Cavite" />
                    </div>

                    <div className="sched-field">
                        <label htmlFor="bk-message">
                            Message / Notes <span className="sched-optional">(Optional)</span>
                        </label>
                        <textarea id="bk-message" name="message" value={form.message}
                            onChange={handleChange}
                            rows={3}
                            placeholder="Tell us about your property, current electric bill, system preference, or any questions…"
                            aria-label="Additional message or questions"
                        />
                    </div>

                    {error && (
                        <p id="booking-error" className="sched-error" role="alert">
                            {error}
                        </p>
                    )}

                    <div className="sched-modal__actions">
                        <button type="button" className="btn btn-outline" onClick={onClose} aria-label="Cancel booking">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn btn-gold btn-lg"
                            disabled={sending}
                            aria-label={sending ? 'Submitting booking request' : 'Submit booking request'}
                            aria-busy={sending}
                        >
                            {sending ? 'Submitting…' : 'Submit Request'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
