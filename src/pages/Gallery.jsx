import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';
import Lightbox from '../components/Lightbox.jsx';
import './Gallery.css';

const FILTERS = ['all', 'residential', 'commercial', 'industrial'];

export default function Gallery() {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [lightbox, setLightbox] = useState({ open: false, images: [], index: 0 });

    useEffect(() => {
        async function load() {
            try {
                const { data, error } = await supabase
                    .from('projects')
                    .select(`*, project_photos(storage_path, is_cover, order_index)`)
                    .order('order_index', { ascending: false });

                if (error) throw error;
                setProjects(data || []);
            } catch (err) {
                console.error('Error loading gallery:', err);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    const getImageUrls = (project) => {
        const photos = [...(project.project_photos || [])].sort(
            (a, b) => a.order_index - b.order_index
        );
        return photos.map(
            (p) =>
                supabase.storage
                    .from('project-images')
                    .getPublicUrl(p.storage_path).data.publicUrl
        );
    };

    const getCover = (project) => {
        const urls = getImageUrls(project);
        return urls[0] ? `${urls[0]}?width=600&resize=cover` : null;
    };

    const filtered =
        filter === 'all'
            ? projects
            : projects.filter((p) => p.category === filter);

    const openLightbox = (project) => {
        const images = getImageUrls(project);
        if (images.length === 0) return;
        setLightbox({ open: true, images, index: 0 });
    };

    const navigate = useCallback(
        (dir) => {
            setLightbox((prev) => {
                const next = prev.index + dir;
                const len = prev.images.length;
                return { ...prev, index: next < 0 ? len - 1 : next >= len ? 0 : next };
            });
        },
        []
    );

    return (
        <main>
            {/* Hero */}
            <section className="gallery-hero">
                <div className="container">
                    <div className="badge badge-gold">Portfolio</div>
                    <h1>Our Solar Installations</h1>
                    <p>
                        Explore completed solar power projects across Metro Manila and nearby
                        provinces.
                    </p>
                </div>
            </section>

            {/* Gallery */}
            <section className="section">
                <div className="container">
                    {/* Filters */}
                    <div className="gallery-filters">
                        {FILTERS.map((f) => (
                            <button
                                key={f}
                                className={`gallery-filter ${filter === f ? 'gallery-filter--active' : ''}`}
                                onClick={() => setFilter(f)}
                            >
                                {f === 'all' ? 'All Projects' : f.charAt(0).toUpperCase() + f.slice(1)}
                            </button>
                        ))}
                    </div>

                    {/* Grid */}
                    <div className="gallery-grid">
                        {loading ? (
                            [0, 1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="skeleton gallery-skeleton" />
                            ))
                        ) : filtered.length === 0 ? (
                            <p className="gallery-empty">No projects found.</p>
                        ) : (
                            filtered.map((project) => {
                                const coverUrl = getCover(project);
                                const photoCount = (project.project_photos || []).length;

                                return (
                                    <div
                                        key={project.id}
                                        className="gallery-card"
                                        onClick={() => openLightbox(project)}
                                    >
                                        <div className="gallery-card__img">
                                            {coverUrl && (
                                                <img src={coverUrl} alt={project.title} loading="lazy" />
                                            )}
                                            <div className="gallery-card__overlay">
                                                <span className="gallery-card__count">
                                                    {photoCount} {photoCount === 1 ? 'Photo' : 'Photos'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="gallery-card__info">
                                            <h3>{project.title}</h3>
                                            <p className="gallery-card__specs">{project.specs}</p>
                                            <p className="gallery-card__location">{project.location}</p>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* CTA */}
                    <div className="gallery-cta card">
                        <strong>Want to see your property transformed?</strong>
                        <p>
                            Contact us today for a free consultation. We'll design a custom solar
                            solution tailored to your energy needs.
                        </p>
                        <a href="/#contact" className="btn btn-gold">
                            Get Your Free Quote
                        </a>
                    </div>
                </div>
            </section>

            {/* Lightbox */}
            {lightbox.open && (
                <Lightbox
                    images={lightbox.images}
                    index={lightbox.index}
                    onClose={() => setLightbox((prev) => ({ ...prev, open: false }))}
                    onNavigate={navigate}
                />
            )}
        </main>
    );
}
