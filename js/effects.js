/* ============================================================
   EFFECTS - Animaciones y Microinteracciones
   Hero carousel, scroll reveal, header scroll, parallax
   ============================================================ */

const ComponentReveal = {
  init() {
    this.initScrollReveal();
    this.initHeroCarousel();
    this.initHeaderScroll();
    this.initMegaMenu();
    this.initTilt();
    this.initMagneticButtons();
  },

  /* ---------- SCROLL REVEAL (IntersectionObserver) ---------- */
  initScrollReveal() {
    const elements = document.querySelectorAll('[data-reveal]');
    if (!('IntersectionObserver' in window)) {
      elements.forEach(el => el.classList.add('is-revealed'));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.12,
      rootMargin: '0px 0px -40px 0px',
    });

    elements.forEach(el => observer.observe(el));
  },

  /* ---------- HERO CAROUSEL (autoplay + arrows + dots) ---------- */
  initHeroCarousel() {
    this.heroTrack = document.getElementById('hero-track');
    if (!this.heroTrack) return;

    this.heroSlides = this.heroTrack.querySelectorAll('.hero__slide');
    this.heroDots = document.querySelectorAll('.hero__dot');
    this.heroCurrent = 0;
    this.heroTotal = this.heroSlides.length;
    this.heroTimer = null;
    this.heroInterval = 6000;

    const prevBtn = document.getElementById('hero-prev');
    const nextBtn = document.getElementById('hero-next');
    if (prevBtn) prevBtn.addEventListener('click', () => this.heroPrev());
    if (nextBtn) nextBtn.addEventListener('click', () => this.heroNext());

    this.heroDots.forEach(dot => {
      dot.addEventListener('click', () => {
        const idx = parseInt(dot.dataset.slide) || 0;
        this.heroGo(idx);
      });
    });

    // Pausar autoplay al hover
    this.heroTrack.closest('.hero')?.addEventListener('mouseenter', () => this.heroStop());
    this.heroTrack.closest('.hero')?.addEventListener('mouseleave', () => this.heroStart());

    // Touch swipe
    let startX = 0;
    let startY = 0;
    const hero = this.heroTrack.closest('.hero');
    if (hero) {
      hero.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
      }, { passive: true });
      hero.addEventListener('touchend', (e) => {
        const dx = e.changedTouches[0].clientX - startX;
        const dy = e.changedTouches[0].clientY - startY;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
          if (dx < 0) this.heroNext();
          else this.heroPrev();
        }
      }, { passive: true });
    }

    this.heroStart();

    // Revelar contenido del primer slide activo tras cargar
    setTimeout(() => {
      const active = this.heroTrack.querySelector('.hero__slide.is-active');
      if (active) {
        active.querySelectorAll('[data-reveal]').forEach((el, i) => {
          el.classList.add('is-revealed');
          el.style.transitionDelay = (0.4 + i * 0.15) + 's';
        });
      }
    }, 200);
  },

  heroGo(index) {
    if (index < 0) index = this.heroTotal - 1;
    if (index > this.heroTotal - 1) index = 0;
    if (index === this.heroCurrent) return;

    const currentSlide = this.heroSlides[this.heroCurrent];
    currentSlide.classList.remove('is-active');
    currentSlide.classList.add('is-leaving');

    setTimeout(() => currentSlide.classList.remove('is-leaving'), 1000);

    this.heroCurrent = index;
    this.heroSlides[index].classList.add('is-active');

    // Dots
    this.heroDots.forEach((dot, i) => {
      dot.classList.toggle('is-active', i === index);
    });

    // Re-trigger reveal animations inside the active slide
    this.heroSlides[index].querySelectorAll('[data-reveal]').forEach((el, i) => {
      el.classList.add('is-revealed');
      el.style.transitionDelay = (0.4 + i * 0.15) + 's';
    });
  },

  heroNext() {
    this.heroGo(this.heroCurrent + 1);
    this.heroRestart();
  },

  heroPrev() {
    this.heroGo(this.heroCurrent - 1);
    this.heroRestart();
  },

  heroStart() {
    this.heroStop();
    this.heroTimer = setInterval(() => this.heroNext(), this.heroInterval);
  },

  heroStop() {
    if (this.heroTimer) {
      clearInterval(this.heroTimer);
      this.heroTimer = null;
    }
  },

  heroRestart() {
    this.heroStart();
  },

  /* ---------- HEADER SCROLL (shadow + style change) ---------- */
  initHeaderScroll() {
    const header = document.getElementById('header');
    if (!header) return;

    const onScroll = () => {
      header.classList.toggle('is-scrolled', window.scrollY > 20);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  },

  /* ---------- MEGA MENU (click / hover sync with mobile) ---------- */
  initMegaMenu() {
    // En desktop el mega menu ya funciona por CSS :hover.
    // Cerramos menús al hacer click en un link para evitar que quede abierto.
    document.querySelectorAll('.mega-menu a').forEach(link => {
      link.addEventListener('click', () => {
        document.querySelectorAll('.mega-menu').forEach(m => m.classList.remove('mega-menu--open'));
      });
    });
  },

  /* ---------- TILT EFFECT on cards ---------- */
  initTilt() {
    const cards = document.querySelectorAll('.service-card');
    if (!cards.length || window.matchMedia('(hover: none)').matches) return;

    cards.forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        card.style.transition = 'transform 0.15s ease';
        card.style.transform = `perspective(800px) rotateX(${(-y * 6)}deg) rotateY(${(x * 6)}deg) translateY(-6px)`;
      });
      card.addEventListener('mouseleave', () => {
        card.style.transition = 'transform 0.5s var(--base)';
        card.style.transform = 'perspective(800px) rotateX(0) rotateY(0)';
      });
    });
  },

  /* ---------- MAGNETIC BUTTONS ---------- */
  initMagneticButtons() {
    const btns = document.querySelectorAll('.hero__cta, .btn--whatsapp.cta__btn');
    if (!btns.length || window.matchMedia('(hover: none)').matches) return;

    btns.forEach(btn => {
      btn.addEventListener('mousemove', (e) => {
        const rect = btn.getBoundingClientRect();
        const x = (e.clientX - rect.left - rect.width / 2) * 0.2;
        const y = (e.clientY - rect.top - rect.height / 2) * 0.2;
        btn.style.transition = 'transform 0.15s ease';
        btn.style.transform = `translate(${x}px, ${y}px)`;
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.transition = 'transform 0.5s var(--base)';
        btn.style.transform = 'translate(0, 0)';
      });
    });
  },

  /* ---------- HELPERS ---------- */
  scrollToProducts() {
    const el = document.getElementById('productos');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },
};

// Export del helper global usado en HTML
window.scrollToProducts = () => ComponentReveal.scrollToProducts();

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => ComponentReveal.init());
