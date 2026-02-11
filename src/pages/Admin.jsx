import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase.js';
import './Admin.css';

export default function Admin() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user || null);
            setLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => setUser(session?.user || null)
        );

        return () => subscription.unsubscribe();
    }, []);

    if (loading) {
        return (
            <div className="admin-loading">
                <div className="spinner" />
            </div>
        );
    }

    return user ? <Dashboard user={user} /> : <Login />;
}

/* ============================
   LOGIN
   ============================ */
function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);

        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setError(error.message);
        setSubmitting(false);
    };

    return (
        <div className="admin-login">
            <div className="admin-login__card">
                <div className="admin-login__header">
                    <img src="/assets/logo.png" alt="Lampara" className="admin-login__logo" />
                    <h1>Admin Panel</h1>
                    <p>Gallery Management System</p>
                </div>
                <form onSubmit={handleSubmit} className="admin-login__form">
                    <div className="admin-field">
                        <label htmlFor="email">Email</label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            placeholder="your@email.com"
                        />
                    </div>
                    <div className="admin-field">
                        <label htmlFor="password">Password</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            placeholder="••••••••"
                        />
                    </div>
                    {error && <p className="admin-error">{error}</p>}
                    <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={submitting}>
                        {submitting ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>
            </div>
        </div>
    );
}

/* ============================
   DASHBOARD
   ============================ */
function Dashboard({ user }) {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(false);
    const [editing, setEditing] = useState(null);

    const loadProjects = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('projects')
            .select('*, project_photos(id, storage_path, order_index)')
            .order('order_index', { ascending: false });

        if (!error) setProjects(data || []);
        setLoading(false);
    };

    useEffect(() => { loadProjects(); }, []);

    const handleLogout = async () => {
        await supabase.auth.signOut();
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this project and all its photos?')) return;

        const project = projects.find((p) => p.id === id);
        const photos = project?.project_photos || [];

        // Delete photos from storage
        if (photos.length > 0) {
            await supabase.storage
                .from('project-images')
                .remove(photos.map((p) => p.storage_path));
        }

        // Delete photo records
        await supabase.from('project_photos').delete().eq('project_id', id);

        // Delete project
        await supabase.from('projects').delete().eq('id', id);

        loadProjects();
    };

    const openEdit = (project) => {
        setEditing(project);
        setModal(true);
    };

    const openNew = () => {
        setEditing(null);
        setModal(true);
    };

    return (
        <div className="admin-dashboard">
            <header className="admin-header">
                <div className="container admin-header__inner">
                    <h1>
                        <img src="/assets/logo.png" alt="" style={{ width: 24, height: 24, display: 'inline', verticalAlign: 'middle', marginRight: 8 }} />
                        Gallery Manager
                    </h1>
                    <div className="admin-header__actions">
                        <span className="admin-header__email">{user.email}</span>
                        <button className="btn btn-outline" onClick={handleLogout}>Logout</button>
                    </div>
                </div>
            </header>

            <main className="container admin-main">
                <div className="admin-toolbar">
                    <h2>Projects ({projects.length})</h2>
                    <button className="btn btn-primary" onClick={openNew}>+ Add Project</button>
                </div>

                {loading ? (
                    <div className="admin-loading-inline"><div className="spinner" /></div>
                ) : projects.length === 0 ? (
                    <p className="admin-empty">No projects yet. Add your first one!</p>
                ) : (
                    <div className="admin-projects">
                        {projects.map((project) => {
                            const photos = project.project_photos || [];
                            const coverPath = photos[0]?.storage_path;
                            const coverUrl = coverPath
                                ? supabase.storage.from('project-images').getPublicUrl(coverPath).data.publicUrl + '?width=200&resize=cover'
                                : null;

                            return (
                                <div key={project.id} className="admin-project-card">
                                    <div className="admin-project-card__img">
                                        {coverUrl ? (
                                            <img src={coverUrl} alt={project.title} />
                                        ) : (
                                            <div className="admin-project-card__placeholder">No Image</div>
                                        )}
                                    </div>
                                    <div className="admin-project-card__info">
                                        <h3>{project.title}</h3>
                                        <p>{project.specs}</p>
                                        <p className="admin-project-card__meta">
                                            {project.location} · {project.category} · {photos.length} photos
                                        </p>
                                    </div>
                                    <div className="admin-project-card__actions">
                                        <button className="btn btn-outline" onClick={() => openEdit(project)}>Edit</button>
                                        <button className="btn btn-outline" style={{ color: 'var(--error)', borderColor: 'var(--error)' }} onClick={() => handleDelete(project.id)}>Delete</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>

            {modal && (
                <ProjectModal
                    project={editing}
                    onClose={() => { setModal(false); setEditing(null); }}
                    onSaved={() => { setModal(false); setEditing(null); loadProjects(); }}
                />
            )}
        </div>
    );
}

/* ============================
   PROJECT MODAL
   ============================ */
function ProjectModal({ project, onClose, onSaved }) {
    const [form, setForm] = useState({
        title: project?.title || '',
        specs: project?.specs || '',
        location: project?.location || '',
        category: project?.category || '',
        description: project?.description || '',
    });
    const [files, setFiles] = useState([]);
    const [existingPhotos, setExistingPhotos] = useState(project?.project_photos || []);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const fileRef = useRef(null);

    const handleChange = (e) => {
        setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleFileChange = (e) => {
        setFiles((prev) => [...prev, ...Array.from(e.target.files)]);
    };

    const removeFile = (idx) => {
        setFiles((prev) => prev.filter((_, i) => i !== idx));
    };

    const removeExistingPhoto = async (photo) => {
        if (!window.confirm('Remove this photo?')) return;
        await supabase.storage.from('project-images').remove([photo.storage_path]);
        await supabase.from('project_photos').delete().eq('id', photo.id);
        setExistingPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSaving(true);

        try {
            let projectId = project?.id;

            if (projectId) {
                // Update
                const { error } = await supabase
                    .from('projects')
                    .update(form)
                    .eq('id', projectId);
                if (error) throw error;
            } else {
                // Insert
                const { data, error } = await supabase
                    .from('projects')
                    .insert({ ...form, order_index: Date.now() })
                    .select()
                    .single();
                if (error) throw error;
                projectId = data.id;
            }

            // Upload new photos
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const ext = file.name.split('.').pop();
                const path = `${projectId}/${Date.now()}-${i}.${ext}`;

                const { error: uploadError } = await supabase.storage
                    .from('project-images')
                    .upload(path, file);
                if (uploadError) throw uploadError;

                const { error: insertError } = await supabase
                    .from('project_photos')
                    .insert({
                        project_id: projectId,
                        storage_path: path,
                        order_index: existingPhotos.length + i,
                        is_cover: i === 0 && existingPhotos.length === 0,
                    });
                if (insertError) throw insertError;
            }

            onSaved();
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="admin-modal-overlay" onClick={onClose}>
            <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
                <div className="admin-modal__header">
                    <h2>{project ? 'Edit Project' : 'Add New Project'}</h2>
                    <button className="admin-modal__close" onClick={onClose}>&times;</button>
                </div>
                <form onSubmit={handleSubmit} className="admin-modal__form">
                    <div className="admin-field">
                        <label>Project Title *</label>
                        <input name="title" value={form.title} onChange={handleChange} required placeholder="e.g., 18.6kWp Hybrid System" />
                    </div>
                    <div className="admin-field">
                        <label>Specifications *</label>
                        <input name="specs" value={form.specs} onChange={handleChange} required placeholder="e.g., AE Bifacial Solar with 3x Dyness 280Ah" />
                    </div>
                    <div className="admin-field">
                        <label>Location *</label>
                        <input name="location" value={form.location} onChange={handleChange} required placeholder="e.g., Padre Garcia, Batangas" />
                    </div>
                    <div className="admin-field">
                        <label>Category *</label>
                        <select name="category" value={form.category} onChange={handleChange} required>
                            <option value="">Select...</option>
                            <option value="residential">Residential</option>
                            <option value="commercial">Commercial</option>
                            <option value="industrial">Industrial</option>
                        </select>
                    </div>
                    <div className="admin-field">
                        <label>Description *</label>
                        <textarea name="description" value={form.description} onChange={handleChange} required rows={3} placeholder="Describe the project..." />
                    </div>

                    {/* Existing photos */}
                    {existingPhotos.length > 0 && (
                        <div className="admin-photos">
                            <label>Existing Photos</label>
                            <div className="admin-photos__grid">
                                {existingPhotos.map((photo) => {
                                    const url = supabase.storage.from('project-images').getPublicUrl(photo.storage_path).data.publicUrl + '?width=120&resize=cover';
                                    return (
                                        <div key={photo.id} className="admin-photos__item">
                                            <img src={url} alt="" />
                                            <button type="button" onClick={() => removeExistingPhoto(photo)}>&times;</button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* New photos */}
                    <div className="admin-field">
                        <label>Add Photos</label>
                        <input
                            type="file"
                            ref={fileRef}
                            accept="image/*"
                            multiple
                            onChange={handleFileChange}
                            style={{ display: 'none' }}
                        />
                        <button type="button" className="btn btn-outline" onClick={() => fileRef.current?.click()}>
                            Select Photos
                        </button>
                        {files.length > 0 && (
                            <div className="admin-photos__grid" style={{ marginTop: 'var(--sp-3)' }}>
                                {files.map((f, i) => (
                                    <div key={i} className="admin-photos__item">
                                        <img src={URL.createObjectURL(f)} alt="" />
                                        <button type="button" onClick={() => removeFile(i)}>&times;</button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {error && <p className="admin-error">{error}</p>}

                    <div className="admin-modal__actions">
                        <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={saving}>
                            {saving ? 'Saving...' : 'Save Project'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
