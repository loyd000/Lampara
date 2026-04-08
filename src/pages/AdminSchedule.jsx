import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';

const MONTH_NAMES = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
];
const DAY_HEADERS = ['SUN','MON','TUE','WED','THU','FRI','SAT'];

const STATUS_OPTS = [
    { value: 'open',          label: '☀️  Open for Booking'      },
    { value: 'not_available', label: '❌  Not Available'          },
    { value: 'scheduled',     label: '✅  Scheduled Installation' },
    { value: 'pending',       label: '📋  For Confirmation'       },
];

const STATUS_COLORS = {
    open:          { bg: 'rgba(201,168,76,0.14)', border: 'rgba(201,168,76,0.35)' },
    not_available: { bg: 'rgba(239,68,68,0.10)',  border: 'rgba(239,68,68,0.30)'  },
    scheduled:     { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.35)' },
    pending:       { bg: 'rgba(251,146,60,0.12)', border: 'rgba(251,146,60,0.35)' },
};

function toDateStr(year, month, day) {
    return `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

function formatFull(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-PH', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
}

/* ============================================================
   ADMIN SCHEDULE TAB ENTRY POINT
   ============================================================ */
export default function ScheduleTab() {
    const today = new Date();
    const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
    const [slots, setSlots]       = useState({});
    const [loading, setLoading]   = useState(true);
    const [editDate, setEditDate] = useState(null); // { dateStr, slot }
    const [activeSection, setActiveSection] = useState('calendar'); // 'calendar' | 'bookings'

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
        const ds = toDateStr(year, month, day);
        setEditDate({ dateStr: ds, slot: slots[ds] || null });
    };

    const onSlotSaved = (dateStr, slot) => {
        setSlots(prev => ({ ...prev, [dateStr]: slot }));
        setEditDate(null);
    };

    const onSlotDeleted = (dateStr) => {
        setSlots(prev => {
            const next = { ...prev };
            delete next[dateStr];
            return next;
        });
        setEditDate(null);
    };

    return (
        <div>
            {/* Sub-tabs */}
            <div style={{ display:'flex', gap:8, marginBottom: 24 }}>
                {['calendar','bookings'].map(s => (
                    <button
                        key={s}
                        className={`admin-tab ${activeSection === s ? 'active' : ''}`}
                        style={{ fontSize:'0.8125rem', padding:'6px 16px', minHeight:36 }}
                        onClick={() => setActiveSection(s)}
                    >
                        {s === 'calendar' ? '📅 Calendar' : '📬 Bookings'}
                    </button>
                ))}
            </div>

            {activeSection === 'calendar' && (
                <>
                    <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:20 }}>
                        <button className="btn btn-outline" style={{ padding:'6px 14px', minHeight:36 }}
                            onClick={() => setViewDate(new Date(year, month - 1, 1))}>←</button>
                        <h3 style={{ flex:1, textAlign:'center', fontSize:'1.25rem' }}>
                            {MONTH_NAMES[month]} {year}
                        </h3>
                        <button className="btn btn-outline" style={{ padding:'6px 14px', minHeight:36 }}
                            onClick={() => setViewDate(new Date(year, month + 1, 1))}>→</button>
                    </div>

                    <p style={{ fontSize:'0.8125rem', color:'var(--text-muted)', marginBottom:12 }}>
                        Click on any day to set its availability status.
                    </p>

                    {loading ? (
                        <div style={{ display:'flex', justifyContent:'center', padding:48 }}>
                            <div className="spinner" />
                        </div>
                    ) : (
                        <div style={{ overflowX:'auto' }}>
                            {/* Day headers */}
                            <div className="asched-grid asched-grid--hdr">
                                {DAY_HEADERS.map(d => (
                                    <div key={d} className="asched-dow">{d}</div>
                                ))}
                            </div>
                            {/* Cells */}
                            <div className="asched-grid">
                                {cells.map((day, idx) => {
                                    if (!day) return <div key={`e${idx}`} className="asched-cell asched-cell--empty" />;
                                    const ds   = toDateStr(year, month, day);
                                    const slot = slots[ds];
                                    const colors = slot ? STATUS_COLORS[slot.status] : null;
                                    return (
                                        <div
                                            key={ds}
                                            className="asched-cell"
                                            style={colors ? { background: colors.bg, borderColor: colors.border, cursor:'pointer' } : { cursor:'pointer' }}
                                            onClick={() => handleDayClick(day)}
                                            title={slot ? `${slot.status}${slot.location ? ' — ' + slot.location : ''}` : 'Click to set'}
                                        >
                                            <span className="asched-cell__num">{day}</span>
                                            {slot && (
                                                <div className="asched-cell__body">
                                                    <span>{STATUS_OPTS.find(o => o.value === slot.status)?.label.split('  ')[0]}</span>
                                                    {slot.location && (
                                                        <span className="asched-cell__loc">{slot.location}</span>
                                                    )}
                                                </div>
                                            )}
                                            {!slot && <span className="asched-cell__add">+</span>}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </>
            )}

            {activeSection === 'bookings' && <BookingsPanel />}

            {/* Day Edit Modal */}
            {editDate && (
                <DayEditModal
                    dateStr={editDate.dateStr}
                    slot={editDate.slot}
                    onClose={() => setEditDate(null)}
                    onSaved={onSlotSaved}
                    onDeleted={onSlotDeleted}
                />
            )}

            <style>{`
                .asched-grid {
                    display: grid;
                    grid-template-columns: repeat(7,1fr);
                    gap: 3px;
                    min-width: 420px;
                }
                .asched-grid--hdr { margin-bottom: 3px; }
                .asched-dow {
                    text-align: center;
                    font-size: 0.625rem;
                    font-weight: 600;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.06em;
                    padding: 4px 0;
                }
                .asched-cell {
                    aspect-ratio: 1;
                    min-height: 64px;
                    border: 1.5px solid var(--border-light);
                    border-radius: 6px;
                    background: var(--surface-alt);
                    padding: 4px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 2px;
                    position: relative;
                    transition: box-shadow .2s;
                }
                .asched-cell:hover { box-shadow: 0 0 0 2px var(--gold); }
                .asched-cell--empty { background: transparent; border-color: transparent; }
                .asched-cell__num {
                    font-size: 0.6875rem;
                    font-weight: 600;
                    color: var(--text-secondary);
                    align-self: flex-start;
                }
                .asched-cell__body {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    text-align: center;
                    font-size: 0.75rem;
                    flex: 1;
                    justify-content: center;
                    line-height: 1.2;
                }
                .asched-cell__loc {
                    font-size: 0.5625rem;
                    color: var(--text-muted);
                    margin-top: 2px;
                }
                .asched-cell__add {
                    position: absolute;
                    inset: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.25rem;
                    color: var(--border);
                    font-weight: 300;
                    opacity: 0;
                    transition: opacity .2s;
                }
                .asched-cell:hover .asched-cell__add { opacity: 1; }
            `}</style>
        </div>
    );
}

/* ============================================================
   DAY EDIT MODAL
   ============================================================ */
function DayEditModal({ dateStr, slot, onClose, onSaved, onDeleted }) {
    const [form, setForm] = useState({
        status:   slot?.status   || 'open',
        location: slot?.location || '',
        notes:    slot?.notes    || '',
    });
    const [saving,   setSaving]   = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [error,    setError]    = useState('');

    const handleChange = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

    const handleSave = async () => {
        setSaving(true);
        setError('');
        try {
            const payload = {
                date:     dateStr,
                status:   form.status,
                location: form.status === 'scheduled' ? form.location : null,
                notes:    form.notes || null,
            };

            if (slot?.id) {
                const { data, error: err } = await supabase
                    .from('schedule_slots')
                    .update(payload)
                    .eq('id', slot.id)
                    .select()
                    .single();
                if (err) throw err;
                onSaved(dateStr, data);
            } else {
                const { data, error: err } = await supabase
                    .from('schedule_slots')
                    .insert(payload)
                    .select()
                    .single();
                if (err) throw err;
                onSaved(dateStr, data);
            }
        } catch (err) {
            setError(err.message);
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!slot?.id) { onClose(); return; }
        if (!window.confirm(`Remove the schedule entry for ${dateStr}?`)) return;
        setDeleting(true);
        await supabase.from('schedule_slots').delete().eq('id', slot.id);
        onDeleted(dateStr);
    };

    return (
        <div className="admin-modal-overlay" onClick={onClose}>
            <div className="admin-modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
                <div className="admin-modal__header">
                    <h2 style={{ fontSize:'1.1rem' }}>{formatFull(dateStr)}</h2>
                    <button className="admin-modal__close" onClick={onClose}>×</button>
                </div>

                <div style={{ padding: 24, display:'flex', flexDirection:'column', gap:16 }}>
                    {/* Status */}
                    <div className="admin-field">
                        <label>Status</label>
                        <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:4 }}>
                            {STATUS_OPTS.map(opt => (
                                <label
                                    key={opt.value}
                                    style={{
                                        display:'flex', alignItems:'center', gap:10, cursor:'pointer',
                                        padding:'10px 14px', borderRadius:8,
                                        border: `1.5px solid ${form.status === opt.value ? 'var(--gold)' : 'var(--border)'}`,
                                        background: form.status === opt.value ? 'rgba(201,168,76,0.07)' : 'var(--surface)',
                                        fontWeight: form.status === opt.value ? 600 : 400,
                                        transition: 'all .2s',
                                    }}
                                >
                                    <input
                                        type="radio"
                                        name="status"
                                        value={opt.value}
                                        checked={form.status === opt.value}
                                        onChange={handleChange}
                                        style={{ accentColor:'var(--gold)' }}
                                    />
                                    <span style={{ fontSize:'0.9375rem' }}>{opt.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Location (only for scheduled) */}
                    {form.status === 'scheduled' && (
                        <div className="admin-field">
                            <label>Location Label <span style={{ fontWeight:400, opacity:.6 }}>(shown on calendar)</span></label>
                            <input
                                name="location"
                                value={form.location}
                                onChange={handleChange}
                                placeholder="e.g. Sta. Rosa, Laguna"
                            />
                        </div>
                    )}

                    {/* Notes (internal) */}
                    <div className="admin-field">
                        <label>Internal Notes <span style={{ fontWeight:400, opacity:.6 }}>(not shown publicly)</span></label>
                        <textarea
                            name="notes"
                            value={form.notes}
                            onChange={handleChange}
                            rows={2}
                            placeholder="e.g. 18kWp hybrid, contact: 09XX..."
                        />
                    </div>

                    {error && <p className="admin-error">{error}</p>}

                    <div className="admin-modal__actions">
                        {slot?.id && (
                            <button
                                className="btn btn-outline"
                                style={{ color:'var(--error)', borderColor:'var(--error)', marginRight:'auto' }}
                                onClick={handleDelete}
                                disabled={deleting}
                            >
                                {deleting ? 'Removing…' : 'Clear Day'}
                            </button>
                        )}
                        <button className="btn btn-outline" onClick={onClose}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                            {saving ? 'Saving…' : 'Save'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ============================================================
   BOOKINGS PANEL
   ============================================================ */
function BookingsPanel() {
    const [bookings, setBookings] = useState([]);
    const [loading,  setLoading]  = useState(true);
    const [filter,   setFilter]   = useState('pending');

    useEffect(() => { loadBookings(); }, []);

    async function loadBookings() {
        setLoading(true);
        const { data } = await supabase
            .from('bookings')
            .select('*')
            .order('date', { ascending: true });
        setBookings(data || []);
        setLoading(false);
    }

    const updateStatus = async (id, status) => {
        await supabase.from('bookings').update({ status }).eq('id', id);
        setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b));
    };

    const filtered = filter === 'all'
        ? bookings
        : bookings.filter(b => b.status === filter);

    const counts = {
        all:       bookings.length,
        pending:   bookings.filter(b => b.status === 'pending').length,
        confirmed: bookings.filter(b => b.status === 'confirmed').length,
        declined:  bookings.filter(b => b.status === 'declined').length,
    };

    const statusBadge = (s) => {
        const map = {
            pending:   { label:'Pending',   color:'#f59e0b', bg:'rgba(245,158,11,0.1)'  },
            confirmed: { label:'Confirmed', color:'#10b981', bg:'rgba(16,185,129,0.1)'  },
            declined:  { label:'Declined',  color:'#ef4444', bg:'rgba(239,68,68,0.1)'   },
        };
        const m = map[s] || map.pending;
        return (
            <span style={{
                display:'inline-flex', alignItems:'center', padding:'2px 10px',
                borderRadius:999, fontSize:'0.75rem', fontWeight:600,
                color:m.color, background:m.bg,
            }}>{m.label}</span>
        );
    };

    return (
        <div>
            {/* Filter tabs */}
            <div style={{ display:'flex', gap:6, marginBottom:20, flexWrap:'wrap' }}>
                {['pending','confirmed','declined','all'].map(f => (
                    <button
                        key={f}
                        className={`gallery-filter ${filter === f ? 'gallery-filter--active' : ''}`}
                        style={{ fontSize:'0.8125rem', padding:'4px 14px', minHeight:34 }}
                        onClick={() => setFilter(f)}
                    >
                        {f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f]})
                    </button>
                ))}
            </div>

            {loading ? (
                <div style={{ display:'flex', justifyContent:'center', padding:48 }}>
                    <div className="spinner" />
                </div>
            ) : filtered.length === 0 ? (
                <p style={{ color:'var(--text-muted)', padding:'32px 0', textAlign:'center' }}>
                    No {filter === 'all' ? '' : filter + ' '}bookings found.
                </p>
            ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                    {filtered.map(b => (
                        <div key={b.id} style={{
                            background:'var(--surface)', border:'1px solid var(--border-light)',
                            borderRadius:10, padding:'16px 20px',
                            display:'flex', flexDirection:'column', gap:8,
                        }}>
                            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16, flexWrap:'wrap' }}>
                                <div>
                                    <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                                        <span style={{ fontWeight:700, fontSize:'1rem', color:'var(--navy)' }}>{b.name}</span>
                                        {statusBadge(b.status)}
                                    </div>
                                    <p style={{ fontSize:'0.875rem', color:'var(--gold-dim)', fontWeight:500, marginTop:2 }}>
                                        📅 {formatFull(b.date)}
                                    </p>
                                </div>
                                {b.status === 'pending' && (
                                    <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                                        <button
                                            className="btn btn-outline"
                                            style={{ padding:'4px 14px', minHeight:34, fontSize:'0.8125rem', color:'var(--success)', borderColor:'var(--success)' }}
                                            onClick={() => updateStatus(b.id,'confirmed')}
                                        >
                                            Confirm
                                        </button>
                                        <button
                                            className="btn btn-outline"
                                            style={{ padding:'4px 14px', minHeight:34, fontSize:'0.8125rem', color:'var(--error)', borderColor:'var(--error)' }}
                                            onClick={() => updateStatus(b.id,'declined')}
                                        >
                                            Decline
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:'4px 24px' }}>
                                <p style={{ fontSize:'0.8125rem', color:'var(--text-secondary)' }}>
                                    ✉️ <a href={`mailto:${b.email}`} style={{ color:'var(--navy)' }}>{b.email}</a>
                                </p>
                                {b.phone && (
                                    <p style={{ fontSize:'0.8125rem', color:'var(--text-secondary)' }}>
                                        📞 {b.phone}
                                    </p>
                                )}
                                <p style={{ fontSize:'0.8125rem', color:'var(--text-secondary)', gridColumn:'1/-1' }}>
                                    📍 {b.address}
                                </p>
                                {b.message && (
                                    <p style={{ fontSize:'0.8125rem', color:'var(--text-secondary)', gridColumn:'1/-1', fontStyle:'italic' }}>
                                        💬 "{b.message}"
                                    </p>
                                )}
                            </div>

                            <p style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginTop:4 }}>
                                Submitted {new Date(b.created_at).toLocaleString('en-PH')}
                            </p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
