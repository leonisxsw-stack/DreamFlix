// === DreamFlix — Shared Navigation & Interactions ===

document.addEventListener('DOMContentLoaded', () => {

    // --- Lenis Smooth Scroll ---
    const lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothTouch: false,
    });
    function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
    requestAnimationFrame(raf);
    window._lenis = lenis;

    // --- Navbar Scroll Effect ---
    const nav = document.getElementById('df-nav');
    if (nav) {
        window.addEventListener('scroll', () => {
            nav.classList.toggle('scrolled', window.scrollY > 60);
        });
    }

    // --- Slider Arrows ---
    document.querySelectorAll('.df-arrow').forEach(btn => {
        btn.addEventListener('click', () => {
            const slider = btn.closest('.df-slider-wrap').querySelector('.df-slider');
            const dir = btn.classList.contains('right') ? 1 : -1;
            slider.scrollBy({ left: slider.clientWidth * 0.8 * dir, behavior: 'smooth' });
        });
    });

    // --- Chip Filters ---
    document.querySelectorAll('.chips').forEach(group => {
        group.querySelectorAll('.chip').forEach(chip => {
            chip.addEventListener('click', () => {
                group.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
            });
        });
    });

    // --- Toggle Switches ---
    document.querySelectorAll('.toggle').forEach(t => {
        t.addEventListener('click', () => t.classList.toggle('on'));
    });

    // --- Mobile Bar Active Page ---
    const page = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.mobile-tab').forEach(tab => {
        const href = tab.getAttribute('href') || '';
        if (href.includes(page) || (page === 'index.html' && href.includes('index'))) {
            tab.classList.add('active');
        }
    });

    // --- Sidebar Active Link ---
    document.querySelectorAll('.sidebar-link').forEach(link => {
        if (link.getAttribute('href') && link.getAttribute('href').includes(page)) {
            link.classList.add('active');
        }
        link.addEventListener('click', () => {
            document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
        });
    });

    // --- Liquid Card Glow (Desktop) ---
    document.addEventListener('pointermove', (e) => {
        const cards = document.querySelectorAll('.df-card, .df-grid-card');
        cards.forEach(card => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            card.style.setProperty('--mouse-x', `${x}px`);
            card.style.setProperty('--mouse-y', `${y}px`);
        });
    });

    // --- Galactic Button Particles ---
    const RANDOM = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);
    const starParticles = document.querySelectorAll('.star');
    starParticles.forEach(p => {
        p.setAttribute('style', `
            --angle: ${RANDOM(0, 360)};
            --duration: ${RANDOM(6, 20)};
            --delay: ${RANDOM(1, 10)};
            --alpha: ${RANDOM(40, 90) / 100};
            --size: ${RANDOM(2, 6)};
            --distance: ${RANDOM(40, 200)};
        `);
    });

    console.log(`DreamFlix loaded on: ${page}`);
});