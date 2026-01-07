// ========================================
// LAMPARA ADMIN PANEL - Main Application
// ========================================

// DOM Elements
const loginScreen = document.getElementById('loginScreen');
const dashboardScreen = document.getElementById('dashboardScreen');
const loginForm = document.getElementById('loginForm');
const logoutBtn = document.getElementById('logoutBtn');
const addProjectBtn = document.getElementById('addProjectBtn');
const projectModal = document.getElementById('projectModal');
const projectForm = document.getElementById('projectForm');
const projectsList = document.getElementById('projectsList');
const loadingOverlay = document.getElementById('loadingOverlay');
const photoInput = document.getElementById('photoInput');
const uploadPhotoBtn = document.getElementById('uploadPhotoBtn');
const photoPreview = document.getElementById('photoPreview');

// State
let currentUser = null;
let currentProject = null;
let selectedFiles = [];

// Initialize
init();

async function init() {
    // Check if user is already logged in
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        currentUser = session.user;
        showDashboard();
        loadProjects();
    } else {
        showLogin();
    }

    // Setup event listeners
    setupEventListeners();
}

function setupEventListeners() {
    loginForm.addEventListener('submit', handleLogin);
    logoutBtn.addEventListener('click', handleLogout);
    addProjectBtn.addEventListener('click', () => openProjectModal());
    projectForm.addEventListener('submit', handleProjectSubmit);
    uploadPhotoBtn.addEventListener('click', () => photoInput.click());
    photoInput.addEventListener('change', handlePhotoSelect);

    // Modal close buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => closeModal());
    });

    // Close modal on outside click
    projectModal.addEventListener('click', (e) => {
        if (e.target === projectModal) closeModal();
    });
}

// ========================================
// AUTHENTICATION
// ========================================

async function handleLogin(e) {
    e.preventDefault();
    showLoading(true);

    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        showError('loginError', error.message);
        showLoading(false);
    } else {
        currentUser = data.user;
        showDashboard();
        loadProjects();
    }
}

async function handleLogout() {
    await supabaseClient.auth.signOut();
    currentUser = null;
    showLogin();
}

// ========================================
// PROJECT MANAGEMENT
// ========================================

async function loadProjects() {
    showLoading(true);

    // Fetch projects with their photos
    const { data: projects, error } = await supabaseClient
        .from('projects')
        .select(`
            *,
            project_photos (*)
        `)
        .order('order_index', { ascending: false });

    showLoading(false);

    if (error) {
        console.error('Error loading projects:', error);
        return;
    }

    renderProjects(projects);
}

function renderProjects(projects) {
    if (!projects || projects.length === 0) {
        projectsList.innerHTML = '<p style="text-align: center; color: #666;">No projects yet. Click "Add New Project" to get started!</p>';
        return;
    }

    projectsList.innerHTML = projects.map(project => `
        <div class="project-card" data-id="${project.id}">
            <h3>${project.title}</h3>
            <div class="project-meta">
                ${project.location} • ${project.category.charAt(0).toUpperCase() + project.category.slice(1)}
            </div>
<p style="font-size: 13px; color: #666;">${project.specs}</p>
            <div class="project-photos">
                ${project.project_photos.slice(0, 4).map(photo => `
                    <img src="${supabaseClient.storage.from('project-images').getPublicUrl(photo.storage_path).data.publicUrl}?width=200&resize=cover" 
                         class="project-photo-thumb" alt="" loading="lazy">
                `).join('')}
                ${project.project_photos.length > 4 ? `<span style="font-size: 12px; color: #666;">+${project.project_photos.length - 4} more</span>` : ''}
            </div>
            <div class="project-actions">
                <button class="btn btn-secondary" onclick="editProject('${project.id}')">Edit</button>
                <button class="btn btn-danger" onclick="deleteProject('${project.id}')">Delete</button>
            </div>
        </div>
    `).join('');
}

async function handleProjectSubmit(e) {
    e.preventDefault();
    showLoading(true);

    const projectData = {
        title: document.getElementById('projectTitle').value,
        specs: document.getElementById('projectSpecs').value,
        location: document.getElementById('projectLocation').value,
        category: document.getElementById('projectCategory').value,
        description: document.getElementById('projectDescription').value,
        user_id: currentUser.id
    };

    try {
        let projectId = document.getElementById('projectId').value;

        if (projectId) {
            // Update existing project
            const { error } = await supabaseClient
                .from('projects')
                .update(projectData)
                .eq('id', projectId);

            if (error) throw error;
        } else {
            // Create new project
            const { data, error } = await supabaseClient
                .from('projects')
                .insert([projectData])
                .select()
                .single();

            if (error) throw error;
            projectId = data.id;
        }

        // Upload photos if any
        if (selectedFiles.length > 0) {
            await uploadPhotos(projectId);
        }

        closeModal();
        loadProjects();
        showLoading(false);

    } catch (error) {
        showError('formError', error.message);
        showLoading(false);
    }
}

async function editProject(projectId) {
    showLoading(true);

    const { data: project, error } = await supabaseClient
        .from('projects')
        .select(`
            *,
            project_photos (*)
        `)
        .eq('id', projectId)
        .single();

    showLoading(false);

    if (error) {
        alert('Error loading project');
        return;
    }

    // Fill form with project data
    document.getElementById('projectId').value = project.id;
    document.getElementById('projectTitle').value = project.title;
    document.getElementById('projectSpecs').value = project.specs;
    document.getElementById('projectLocation').value = project.location;
    document.getElementById('projectCategory').value = project.category;
    document.getElementById('projectDescription').value = project.description;

    // Show existing photos
    photoPreview.innerHTML = project.project_photos.map(photo => `
        <div class="photo-preview-item">
            <img src="${supabaseClient.storage.from('project-images').getPublicUrl(photo.storage_path).data.publicUrl}?width=200&resize=cover" alt="" loading="lazy">
            <button type="button" class="photo-remove" onclick="removeExistingPhoto('${photo.id}')">×</button>
        </div>
    `).join('');

    document.getElementById('modalTitle').textContent = 'Edit Project';
    openProjectModal();
}

async function deleteProject(projectId) {
    if (!confirm('Are you sure you want to delete this project? This cannot be undone.')) {
        return;
    }

    showLoading(true);

    // Delete photos from storage first
    const { data: photos } = await supabaseClient
        .from('project_photos')
        .select('storage_path')
        .eq('project_id', projectId);

    if (photos && photos.length > 0) {
        const paths = photos.map(p => p.storage_path);
        await supabaseClient.storage.from('project-images').remove(paths);
    }

    // Delete project (cascade will delete project_photos)
    const { error } = await supabaseClient
        .from('projects')
        .delete()
        .eq('id', projectId);

    showLoading(false);

    if (!error) {
        loadProjects();
    } else {
        alert('Error deleting project');
    }
}

// ========================================
// PHOTO MANAGEMENT
// ========================================

function handlePhotoSelect(e) {
    selectedFiles = Array.from(e.target.files);
    displayPhotoPreview();
}

function displayPhotoPreview() {
    photoPreview.innerHTML = selectedFiles.map((file, index) => `
        <div class="photo-preview-item">
            <img src="${URL.createObjectURL(file)}" alt="">
            <button type="button" class="photo-remove" onclick="removePhoto(${index})">×</button>
        </div>
    `).join('');
}

function removePhoto(index) {
    selectedFiles.splice(index, 1);
    displayPhotoPreview();
}

async function removeExistingPhoto(photoId) {
    if (!confirm('Delete this photo?')) return;

    showLoading(true);

    // Get storage path
    const { data: photo } = await supabaseClient
        .from('project_photos')
        .select('storage_path')
        .eq('id', photoId)
        .single();

    // Delete from storage
    await supabaseClient.storage.from('project-images').remove([photo.storage_path]);

    // Delete from database
    await supabaseClient
        .from('project_photos')
        .delete()
        .eq('id', photoId);

    showLoading(false);

    // Reload form
    const projectId = document.getElementById('projectId').value;
    editProject(projectId);
}

async function uploadPhotos(projectId) {
    const uploadPromises = selectedFiles.map(async (file, i) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${projectId}/${Date.now()}-${i}.${fileExt}`;

        // Upload to storage
        const { error: uploadError } = await supabaseClient.storage
            .from('project-images')
            .upload(fileName, file);

        if (uploadError) {
            console.error('Upload error:', uploadError);
            return; // Skip this file on error
        }

        // Add to database
        await supabaseClient.from('project_photos').insert([{
            project_id: projectId,
            storage_path: fileName,
            is_cover: i === 0, // First photo is cover (logic might need adjustment for concurrent, but roughly okay)
            order_index: i
        }]);
    });

    await Promise.all(uploadPromises);
}

// ========================================
// UI HELPERS
// ========================================

function showLogin() {
    loginScreen.style.display = 'block';
    dashboardScreen.style.display = 'none';
}

function showDashboard() {
    loginScreen.style.display = 'none';
    dashboardScreen.style.display = 'block';
    document.getElementById('userEmail').textContent = currentUser.email;
}

function openProjectModal() {
    document.getElementById('modalTitle').textContent = 'Add New Project';
    projectForm.reset();
    document.getElementById('projectId').value = '';
    selectedFiles = [];
    photoPreview.innerHTML = '';
    projectModal.classList.add('active');
}

function closeModal() {
    projectModal.classList.remove('active');
}

function showLoading(show) {
    loadingOverlay.style.display = show ? 'flex' : 'none';
}

function showError(elementId, message) {
    const errorEl = document.getElementById(elementId);
    errorEl.textContent = message;
    errorEl.classList.add('show');
    setTimeout(() => errorEl.classList.remove('show'), 5000);
}

// Make functions globally accessible
window.editProject = editProject;
window.deleteProject = deleteProject;
window.removePhoto = removePhoto;
window.removeExistingPhoto = removeExistingPhoto;
