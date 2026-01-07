document.addEventListener('DOMContentLoaded', () => {
    loadGallery();
});

// State
let allProjects = [];

async function loadGallery() {
    const galleryGrid = document.getElementById('galleryGrid');

    // Check if we're on the gallery page
    if (!galleryGrid) return;

    // Skeleton Loader (Prevent Layout Shift)
    galleryGrid.innerHTML = Array(6).fill(0).map(() =>
        '<div class="skeleton" style="min-height: 400px; height: 100%;"></div>'
    ).join('');

    try {
        // Fetch projects with photos
        const { data: projects, error } = await supabaseClient
            .from('projects')
            .select(`
                *,
                project_photos (
                    storage_path,
                    is_cover,
                    order_index
                )
            `)
            .order('order_index', { ascending: false });

        if (error) throw error;

        allProjects = projects;
        renderGallery(projects);
        initializeFilters();

    } catch (error) {
        console.error('Error loading gallery:', error);
        galleryGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: red;">Error loading projects. Please try again later.</div>';
    }
}

function renderGallery(projects) {
    const galleryGrid = document.getElementById('galleryGrid');
    galleryGrid.innerHTML = '';

    if (projects.length === 0) {
        galleryGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center;">No projects found.</div>';
        return;
    }

    projects.forEach((project, index) => {
        // Sort photos
        const photos = project.project_photos || [];
        photos.sort((a, b) => a.order_index - b.order_index);

        // Get URLs
        const imageUrls = photos.map(p =>
            supabaseClient.storage.from('project-images').getPublicUrl(p.storage_path).data.publicUrl
        );

        const coverUrl = imageUrls[0];
        // Optimization: Request smaller image for grid thumbnail
        const coverImage = coverUrl ? `${coverUrl}?width=600&resize=cover` : 'assets/placeholder.jpg';
        const photoCount = imageUrls.length;

        // Create Card HTML
        const card = document.createElement('div');
        card.className = 'gallery-card';
        card.setAttribute('data-category', project.category);
        // Store images for lightbox
        card.setAttribute('data-images', JSON.stringify(imageUrls));

        card.innerHTML = `
            <div class="gallery-image">
                <img src="${coverImage}" alt="${project.title}" loading="lazy">
                <div class="gallery-overlay">
                    <button class="view-btn" onclick="openSupabaseLightbox(${index})">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="11" cy="11" r="8"></circle>
                            <path d="m21 21-4.35-4.35"></path>
                            <line x1="11" y1="8" x2="11" y2="14"></line>
                            <line x1="8" y1="11" x2="14" y2="11"></line>
                        </svg>
                        View ${photoCount} Photos
                    </button>
                </div>
            </div>
            <div class="gallery-info">
                <h3>${project.title}</h3>
                <p class="project-specs">${project.specs}</p>
                <p class="project-location">📍 ${project.location}</p>
                <p class="project-description">${project.description}</p>
            </div>
        `;

        galleryGrid.appendChild(card);
    });

    // Animate tokens? handled by CSS
}

function initializeFilters() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    const galleryCards = document.querySelectorAll('.gallery-card');

    filterButtons.forEach(button => {
        // Remove old listeners to be safe (though cloning is better, these are new buttons usually?)
        // Actually, the buttons are static in HTML. So the listeners in script.js MIGHT still be active.
        // But the cards are new.
        // We should replace the listener logic to reference the NEW cards.

        button.replaceWith(button.cloneNode(true)); // Remove old listeners
    });

    // Re-select fresh buttons
    const newFilterButtons = document.querySelectorAll('.filter-btn');

    newFilterButtons.forEach(button => {
        button.addEventListener('click', function () {
            // Update active button
            newFilterButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');

            // Filter cards
            const filterValue = this.getAttribute('data-filter');
            // Re-select cards as they are dynamic
            const currentCards = document.querySelectorAll('.gallery-card');

            currentCards.forEach(card => {
                if (filterValue === 'all' || card.getAttribute('data-category') === filterValue) {
                    card.style.display = 'block'; // Or remove hidden class
                    // script.js used .hidden class display:none. 
                    // Let's use the same class for consistency if CSS has it.
                    card.classList.remove('hidden');
                } else {
                    card.classList.add('hidden');
                }
            });
        });
    });
}

// ========================================
// LIGHTBOX (Adapted for Supabase Data)
// ========================================

let currentLightboxIndex = 0;
let currentProjectImages = [];

function openSupabaseLightbox(projectIndex) {
    const project = allProjects[projectIndex];
    if (!project) return;

    // Sort photos
    const photos = project.project_photos || [];
    photos.sort((a, b) => a.order_index - b.order_index);

    // Get URLs
    currentProjectImages = photos.map(p =>
        supabaseClient.storage.from('project-images').getPublicUrl(p.storage_path).data.publicUrl
    );

    currentLightboxIndex = 0;
    updateLightboxImage();

    document.getElementById('lightbox').classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent scrolling
}

function closeLightbox() {
    document.getElementById('lightbox').classList.remove('active');
    document.body.style.overflow = 'auto';
}

function changeLightboxImage(direction) {
    currentLightboxIndex += direction;

    if (currentLightboxIndex < 0) {
        currentLightboxIndex = currentProjectImages.length - 1;
    } else if (currentLightboxIndex >= currentProjectImages.length) {
        currentLightboxIndex = 0;
    }

    updateLightboxImage();
}

function updateLightboxImage() {
    const img = document.getElementById('lightbox-image');
    const caption = document.getElementById('lightbox-caption');

    img.src = currentProjectImages[currentLightboxIndex];
    caption.textContent = `Image ${currentLightboxIndex + 1} of ${currentProjectImages.length}`;
}

// Global exports
window.openSupabaseLightbox = openSupabaseLightbox;
window.closeLightbox = closeLightbox;
window.changeLightboxImage = changeLightboxImage;

// Close lightbox on outside click
document.getElementById('lightbox')?.addEventListener('click', (e) => {
    if (e.target.id === 'lightbox') closeLightbox();
});

// Keyboard navigation
document.addEventListener('keydown', (e) => {
    if (!document.getElementById('lightbox')?.classList.contains('active')) return;

    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') changeLightboxImage(-1);
    if (e.key === 'ArrowRight') changeLightboxImage(1);
});
