import { useEffect, useCallback } from 'react';
import './Lightbox.css';

export default function Lightbox({ images, index, onClose, onNavigate }) {
    const handleKeyDown = useCallback(
        (e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft') onNavigate(-1);
            if (e.key === 'ArrowRight') onNavigate(1);
        },
        [onClose, onNavigate]
    );

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
    }, [handleKeyDown]);

    if (!images || images.length === 0) return null;

    return (
        <div className="lightbox" onClick={onClose}>
            <div className="lightbox__content" onClick={(e) => e.stopPropagation()}>
                <button className="lightbox__close" onClick={onClose} aria-label="Close">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                </button>

                {images.length > 1 && (
                    <>
                        <button
                            className="lightbox__nav lightbox__nav--prev"
                            onClick={() => onNavigate(-1)}
                            aria-label="Previous"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M15 18l-6-6 6-6" />
                            </svg>
                        </button>
                        <button
                            className="lightbox__nav lightbox__nav--next"
                            onClick={() => onNavigate(1)}
                            aria-label="Next"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M9 18l6-6-6-6" />
                            </svg>
                        </button>
                    </>
                )}

                <img
                    src={images[index]}
                    alt={`Image ${index + 1} of ${images.length}`}
                    className="lightbox__img"
                />

                <div className="lightbox__caption">
                    {index + 1} / {images.length}
                </div>
            </div>
        </div>
    );
}
