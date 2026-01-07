// function toggleMenu() {
//     const menu = document.getElementById('nav-menu');
//     const menuToggle = document.querySelector('.menu-toggle');
//     menu.classList.toggle('active');
//     menuToggle.classList.toggle('active');
// }
// Replaced by new Glass Nav Logic

// ========================================
// Glass Navigation Logic
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    // Scroll Effect
    window.addEventListener('scroll', function () {
        const navbar = document.querySelector('.navbar-glass');
        if (!navbar) return;

        if (window.scrollY > 50) { // Trigger earlier than 100 for smoother feel
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // Mobile Menu
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');

    if (hamburger && navLinks) {
        hamburger.addEventListener('click', function (e) {
            e.stopPropagation(); // Prevent closing immediately
            hamburger.classList.toggle('active');
            navLinks.classList.toggle('active');
        });

        // Close menu when clicking a link
        document.querySelectorAll('.nav-links a').forEach(link => {
            link.addEventListener('click', function () {
                hamburger.classList.remove('active');
                navLinks.classList.remove('active');
            });
        });

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (navLinks.classList.contains('active') &&
                !navLinks.contains(e.target) &&
                !hamburger.contains(e.target)) {
                hamburger.classList.remove('active');
                navLinks.classList.remove('active');
            }
        });
    }
});

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

async function calculateSavings() {
    // Constants defined by user
    const SUN_HOURS = 4.5;
    const DERATING_FACTOR = 0.8;
    const ELECTRICITY_RATE = 12; // PHP per kWh
    const DAYS_PER_MONTH = 30;

    const response = await fetch('config/pricing.json');
    const systemPrices = await response.json();

    // Calculate production and savings based on system size
    // Formula: Size * Sun Hours * Derating * Rate * Days
    const dailyProduction = selectedSystem * SUN_HOURS * DERATING_FACTOR;
    const dailySavings = dailyProduction * ELECTRICITY_RATE;
    const monthlySavings = dailySavings * DAYS_PER_MONTH;
    const annualSavings = monthlySavings * 12;

    const systemPrice = systemPrices[selectedSystem] || 195000;

    const paybackYears = annualSavings > 0
        ? (systemPrice / annualSavings).toFixed(1)
        : 'N/A';

    document.getElementById('monthlySavings').textContent = '₱' + Math.round(monthlySavings).toLocaleString();
    document.getElementById('annualSavings').textContent = '₱' + Math.round(annualSavings).toLocaleString();
    document.getElementById('paybackPeriod').textContent = paybackYears === 'N/A' ? paybackYears : paybackYears + ' years';
}

// Initialize calculator and new features
document.addEventListener('DOMContentLoaded', function () {
    // Set default active button
    const defaultBtn = document.querySelector('[data-size="6.6"]');
    if (defaultBtn) defaultBtn.classList.add('active');

    // Make calculateSavings async and call it
    if (typeof calculateSavings === 'function') calculateSavings();

    // Initialize Phase 4 Features
    initScrollAnimations();
    initFloatingElements();
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
// Note: Gallery logic and lightbox interactions are now handled by:
// js/gallery-loader.js (integrates with Supabase)

// ==================== Phase 4: Interactions ====================

function initScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.animationPlayState = 'running';
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.animate-fade-up, .animate-fade-down').forEach(el => {
        el.style.opacity = '0';
        el.style.animationPlayState = 'paused';
        observer.observe(el);
    });
}

function initFloatingElements() {
    const backToTop = document.getElementById('backToTop');
    if (!backToTop) return;

    window.addEventListener('scroll', () => {
        if (window.scrollY > 500) {
            backToTop.classList.add('visible');
        } else {
            backToTop.classList.remove('visible');
        }
    });

    backToTop.addEventListener('click', (e) => {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}
