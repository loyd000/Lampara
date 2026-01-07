function toggleMenu() {
    const menu = document.getElementById('nav-menu');
    const menuToggle = document.querySelector('.menu-toggle');
    menu.classList.toggle('active');
    menuToggle.classList.toggle('active');
}

// Solar Calculator
let selectedSystem = 6.6;

function selectSystem(size, event) {
    selectedSystem = size;
    document.querySelectorAll('.system-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    if (event && event.target) {
        event.target.classList.add('active');
    }
    calculateSavings();
}

function calculateSavings() {
    const monthlyBill = parseFloat(document.getElementById('monthlyBill').value) || 0;

    // Solar efficiency rate (percentage of bill that can be offset)
    const efficiencyRate = {
        3.3: 0.35,
        6.6: 0.70,
        8.3: 0.88,
        12.2: 1.0
    };

    const systemPrices = {
        3.3: 137000,
        6.6: 195000,
        8.3: 250000,
        12.2: 337000
    };

    const rate = efficiencyRate[selectedSystem] || 0.70;
    const systemPrice = systemPrices[selectedSystem] || 195000;

    const monthlySavings = monthlyBill * rate;
    const annualSavings = monthlySavings * 12;
    const paybackYears = annualSavings > 0
        ? (systemPrice / annualSavings).toFixed(1)
        : 'N/A';

    document.getElementById('monthlySavings').textContent = '₱' + Math.round(monthlySavings).toLocaleString();
    document.getElementById('annualSavings').textContent = '₱' + Math.round(annualSavings).toLocaleString();
    document.getElementById('paybackPeriod').textContent = paybackYears === 'N/A' ? paybackYears : paybackYears + ' years';
}

// Update calculator when inputs change
document.addEventListener('DOMContentLoaded', function () {
    const billInput = document.getElementById('monthlyBill');
    const billRange = document.getElementById('billRange');

    if (billInput && billRange) {
        billInput.addEventListener('input', function () {
            billRange.value = this.value;
            calculateSavings();
        });

        billRange.addEventListener('input', function () {
            billInput.value = this.value;
            calculateSavings();
        });
    }

    // Set default active button
    const defaultBtn = document.querySelector('[data-size="6.6"]');
    if (defaultBtn) defaultBtn.classList.add('active');

    calculateSavings();
});

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
        // Close mobile menu if open
        const menu = document.getElementById('nav-menu');
        const menuToggle = document.querySelector('.menu-toggle');
        menu.classList.remove('active');
        if (menuToggle) {
            menuToggle.classList.remove('active');
        }
    });
});

// ==================== Gallery Page Functionality ====================

// Gallery Filter System
const filterButtons = document.querySelectorAll('.filter-btn');
const galleryCards = document.querySelectorAll('.gallery-card');

filterButtons.forEach(button => {
    button.addEventListener('click', function () {
        // Update active button
        filterButtons.forEach(btn => btn.classList.remove('active'));
        this.classList.add('active');

        // Filter cards
        const filterValue = this.getAttribute('data-filter');
        galleryCards.forEach(card => {
            if (filterValue === 'all' || card.getAttribute('data-category') === filterValue) {
                card.classList.remove('hidden');
            } else {
                card.classList.add('hidden');
            }
        });
    });
});

// Lightbox Functionality
let currentLightboxIndex = 0;
let currentProjectIndex = 0;
const projectImages = [];

// Collect all project images from data-images attributes
document.querySelectorAll('.gallery-card').forEach((card, projectIdx) => {
    const imagesData = card.getAttribute('data-images');
    if (imagesData) {
        try {
            const images = JSON.parse(imagesData);
            const h3 = card.querySelector('h3');
            const specs = card.querySelector('.project-specs');
            const title = h3 ? h3.textContent : 'Project';
            const subtitle = specs ? specs.textContent : '';

            projectImages.push({
                images: images,
                title: title,
                subtitle: subtitle
            });
        } catch (e) {
            console.error('Error parsing images data:', e);
        }
    }
});

function openLightbox(projectIndex) {
    currentProjectIndex = projectIndex;
    currentLightboxIndex = 0; // Start at first image of the project

    const lightbox = document.getElementById('lightbox');
    const lightboxImage = document.getElementById('lightbox-image');
    const lightboxCaption = document.getElementById('lightbox-caption');

    if (lightbox && projectImages[projectIndex]) {
        const project = projectImages[projectIndex];
        lightboxImage.src = project.images[0];
        lightboxImage.alt = project.title;

        // Update caption with photo counter if multiple images
        const photoCount = project.images.length;
        if (photoCount > 1) {
            lightboxCaption.textContent = `${project.title} - ${project.subtitle} (Photo 1 of ${photoCount})`;
        } else {
            lightboxCaption.textContent = `${project.title} - ${project.subtitle}`;
        }

        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent scrolling
    }
}

function closeLightbox() {
    const lightbox = document.getElementById('lightbox');
    if (lightbox) {
        lightbox.classList.remove('active');
        document.body.style.overflow = ''; // Restore scrolling
    }
}

function changeLightboxImage(direction) {
    const project = projectImages[currentProjectIndex];
    if (!project) return;

    currentLightboxIndex += direction;

    // Loop around within the current project's images
    if (currentLightboxIndex >= project.images.length) {
        currentLightboxIndex = 0;
    } else if (currentLightboxIndex < 0) {
        currentLightboxIndex = project.images.length - 1;
    }

    const lightboxImage = document.getElementById('lightbox-image');
    const lightboxCaption = document.getElementById('lightbox-caption');

    lightboxImage.src = project.images[currentLightboxIndex];
    lightboxImage.alt = project.title;

    // Update caption with current photo number
    const photoCount = project.images.length;
    if (photoCount > 1) {
        lightboxCaption.textContent = `${project.title} - ${project.subtitle} (Photo ${currentLightboxIndex + 1} of ${photoCount})`;
    } else {
        lightboxCaption.textContent = `${project.title} - ${project.subtitle}`;
    }
}

// Close lightbox with Escape key
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        closeLightbox();
    } else if (e.key === 'ArrowLeft') {
        changeLightboxImage(-1);
    } else if (e.key === 'ArrowRight') {
        changeLightboxImage(1);
    }
});

// Close lightbox when clicking outside the image
document.addEventListener('click', function (e) {
    const lightbox = document.getElementById('lightbox');
    if (lightbox && e.target === lightbox) {
        closeLightbox();
    }
});
