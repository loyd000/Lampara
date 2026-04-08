import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';
import './Schedule.css';

// ============================================================
// EmailJS — Replace these with your actual credentials
// ============================================================
const EMAILJS_SERVICE_ID      = 'service_lampara';
const EMAILJS_COMPANY_TPL     = 'template_booking_company'; // notifies lamparaeis@gmail.com
const EMAILJS_PUBLIC_KEY      = '_rgBAjoEUDIAq9fGO';
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
    await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            service_id: EMAILJS_SERVICE_ID,
            template_id: templateId,
            user_id: EMAILJS_PUBLIC_KEY,
            template_params: params,
        }),
    });
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSending(true);
        setError('');

        try {
            // 1. Save booking to Supabase
            const { error: dbErr } = await supabase.from('bookings').insert({
                date,
                name:    form.name,
                email:   form.email,
                phone:   form.phone  || null,
                address: form.address,
                message: form.message || null,
            });
            if (dbErr) throw dbErr;

            // 2. Notify company
            await sendEmail(EMAILJS_COMPANY_TPL, {
                booking_date:   dateDisplay,
                client_name:    form.name,
                client_email:   form.email,
                client_phone:   form.phone   || 'Not provided',
                client_address: form.address,
                client_message: form.message || 'No additional notes',
                to_email:       'lamparaeis@gmail.com',
            });

            onSuccess('Booking submitted! We\'ll reach out within 24 hours to confirm your appointment.');
        } catch (err) {
            console.error(err);
            setError('Something went wrong. Please try again or message us on Facebook.');
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
                        <input id="bk-name" name="name" value={form.name} onChange={handleChange}
                            required placeholder="Juan dela Cruz" />
                    </div>

                    <div className="sched-row">
                        <div className="sched-field">
                            <label htmlFor="bk-email">Email Address *</label>
                            <input id="bk-email" name="email" type="email" value={form.email}
                                onChange={handleChange} required placeholder="you@email.com" />
                        </div>
                        <div className="sched-field">
                            <label htmlFor="bk-phone">
                                Phone <span className="sched-optional">(Optional)</span>
                            </label>
                            <input id="bk-phone" name="phone" type="tel" value={form.phone}
                                onChange={handleChange} placeholder="09XX XXX XXXX" />
                        </div>
                    </div>

                    <div className="sched-field">
                        <label htmlFor="bk-address">Property Address *</label>
                        <input id="bk-address" name="address" value={form.address}
                            onChange={handleChange} required
                            placeholder="e.g. Brgy. San Jose, Cavite City, Cavite" />
                    </div>

                    <div className="sched-field">
                        <label htmlFor="bk-message">
                            Message / Notes <span className="sched-optional">(Optional)</span>
                        </label>
                        <textarea id="bk-message" name="message" value={form.message}
                            onChange={handleChange} rows={3}
                            placeholder="Tell us about your property, current electric bill, system preference, or any questions…" />
                    </div>

                    {error && <p className="sched-error">{error}</p>}

                    <div className="sched-modal__actions">
                        <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-gold btn-lg" disabled={sending}>
                            {sending ? 'Submitting…' : 'Submit Request'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
