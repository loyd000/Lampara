document.addEventListener('DOMContentLoaded', () => {
    loadFeaturedProjects();
});

async function loadFeaturedProjects() {
    const grid = document.querySelector('.installation-grid');
    if (!grid) return;

    // Preserve the "View Full Gallery" link container which is usually outside grid
    // But inside grid, we might want skeletons.
    // The current index.html has static cards. We'll clear them.

    // Skeleton Loader
    grid.innerHTML = Array(3).fill(0).map(() =>
        '<div class="skeleton" style="min-height: 400px; height: 100%;"></div>'
    ).join('');

    try {
        // Fetch top 3 projects
        // We assume "Featured" means top by order_index (most recent/important)
        const { data: projects, error } = await supabaseClient
            .from('projects')
            .select(`
                *,
                project_photos (
                    storage_path
                )
            `)
            .order('order_index', { ascending: false })
            .limit(3);

        if (error) throw error;

        if (!projects || projects.length === 0) {
            grid.innerHTML = '<p class="text-centercol-span-3">No projects found.</p>';
            return;
        }

        grid.innerHTML = ''; // Clear skeletons

        projects.forEach(project => {
            // Get cover image
            const photos = project.project_photos || [];
            // Sort logic if we had order_index in photos, but for home, just taking first is okay
            // Better to assume first returned is okay or sort if we had the field.

            let coverUrl = 'assets/placeholder.jpg';
            if (photos.length > 0) {
                // Get URL
                const rawUrl = supabaseClient.storage.from('project-images').getPublicUrl(photos[0].storage_path).data.publicUrl;
                // Optimize
                coverUrl = `${rawUrl}?width=600&resize=cover`;
            }

            const card = document.createElement('div');
            card.className = 'installation-card';
            card.innerHTML = `
                <div class="installation-image">
                    <img src="${coverUrl}" alt="${project.title}" loading="lazy">
                </div>
                <div class="installation-info">
                    <h4>${project.title}</h4>
                    <p>${project.specs}</p>
                </div>
            `;
            grid.appendChild(card);
        });

    } catch (error) {
        console.error('Error loading featured projects:', error);
        // Fallback to static content defined in HTML? 
        // Or just show error.
        // For now, if error, we might leave skeletons or show nothing.
        grid.innerHTML = '<p class="text-center col-span-3">Unable to load projects.</p>';
    }
}
