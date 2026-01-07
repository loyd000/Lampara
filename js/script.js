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
    // Constants defined by user
    const SUN_HOURS = 4.5;
    const DERATING_FACTOR = 0.8;
    const ELECTRICITY_RATE = 12; // PHP per kWh
    const DAYS_PER_MONTH = 30;

    const systemPrices = {
        3.3: 137000,
        6.6: 195000,
        8.3: 250000,
        12.2: 337000
    };

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
// Note: Gallery logic and lightbox interactions are now handled by:
// js/gallery-loader.js (integrates with Supabase)
