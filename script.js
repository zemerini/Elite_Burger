/**
 * BUNSMITH — Premium Smashburger
 * Interactive Script: Scroll reveals, header state, ambient glow
 */

(function () {
  'use strict';

  // --- Scroll Reveal with IntersectionObserver ---
  const revealElements = document.querySelectorAll('.reveal');

  if (revealElements.length > 0) {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            revealObserver.unobserve(entry.target);
          }
        }
      },
      {
        threshold: 0.15,
        rootMargin: '0px 0px -40px 0px',
      }
    );

    for (const el of revealElements) {
      revealObserver.observe(el);
    }
  }

  // --- Sticky Header Scroll State ---
  const header = document.getElementById('header');

  if (header) {
    let lastScrollY = 0;
    let ticking = false;

    function updateHeaderState() {
      const scrollY = window.scrollY;
      if (scrollY > 50) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
      lastScrollY = scrollY;
      ticking = false;
    }

    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(updateHeaderState);
        ticking = true;
      }
    }, { passive: true });
  }

  // --- Ambient Cursor Glow (desktop only) ---
  const ambientGlow = document.getElementById('ambientGlow');

  if (ambientGlow && window.matchMedia('(pointer: fine)').matches) {
    let glowActive = false;

    document.addEventListener('mousemove', (e) => {
      if (!glowActive) {
        ambientGlow.classList.add('active');
        glowActive = true;
      }

      requestAnimationFrame(() => {
        ambientGlow.style.left = `${e.clientX - 200}px`;
        ambientGlow.style.top = `${e.clientY - 200}px`;
      });
    });

    document.addEventListener('mouseleave', () => {
      ambientGlow.classList.remove('active');
      glowActive = false;
    });
  }

  // --- Smooth scroll for CTA ---
  const heroCta = document.getElementById('hero-cta');
  if (heroCta) {
    heroCta.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.getElementById('menu');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  // --- Parallax hero image on scroll ---
  const heroBgImage = document.querySelector('.hero__bg-image');
  if (heroBgImage && window.matchMedia('(prefers-reduced-motion: no-preference)').matches) {
    let parallaxTicking = false;

    window.addEventListener('scroll', () => {
      if (!parallaxTicking) {
        requestAnimationFrame(() => {
          const scrolled = window.scrollY;
          const rate = scrolled * 0.3;
          heroBgImage.style.transform = `translateY(${rate}px) scale(1.05)`;
          parallaxTicking = false;
        });
        parallaxTicking = true;
      }
    }, { passive: true });
  }

  // --- Staggered card animation on scroll ---
  const menuCards = document.querySelectorAll('.menu-card');
  if (menuCards.length > 0) {
    const cardObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const card = entry.target;
            const index = Array.from(menuCards).indexOf(card);
            card.style.transitionDelay = `${index * 100}ms`;
            card.classList.add('visible');
            cardObserver.unobserve(card);
          }
        }
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -20px 0px',
      }
    );

    for (const card of menuCards) {
      cardObserver.observe(card);
    }
  }

  // --- Easter Egg: Auto W ↔ M flip ---
  const easterEggW = document.getElementById('easter-egg-w');
  if (easterEggW) {
    setInterval(() => {
      easterEggW.classList.toggle('flipped');
    }, 4000);
  }

  // --- Menu Toggle (Single / Menü) ---
  const menuTogglePill = document.getElementById('menuTogglePill');
  const btnSingle = document.getElementById('btn-single');
  const btnMenu = document.getElementById('btn-menu');
  const menuSection = document.getElementById('menu');

  if (menuTogglePill && btnSingle && btnMenu && menuSection) {
    function setMenuMode(mode) {
      if (mode === 'menu') {
        menuTogglePill.setAttribute('data-active', 'menu');
        btnSingle.classList.remove('active');
        btnSingle.setAttribute('aria-pressed', 'false');
        btnMenu.classList.add('active');
        btnMenu.setAttribute('aria-pressed', 'true');
        menuSection.classList.add('menu--show-menu');
      } else {
        menuTogglePill.setAttribute('data-active', 'single');
        btnSingle.classList.add('active');
        btnSingle.setAttribute('aria-pressed', 'true');
        btnMenu.classList.remove('active');
        btnMenu.setAttribute('aria-pressed', 'false');
        menuSection.classList.remove('menu--show-menu');
      }
    }

    btnSingle.addEventListener('click', () => setMenuMode('single'));
    btnMenu.addEventListener('click', () => setMenuMode('menu'));
  }

  // --- Dynamic News Loading ---
  async function loadNews() {
    const container = document.getElementById('news-container');
    if (!container) return;

    try {
      const response = await fetch('get_news.php');
      if (!response.ok) throw new Error('Netzwerk-Antwort war nicht ok');
      const newsList = await response.json();

      if (newsList.length === 0) {
        container.innerHTML = '<p class="news-empty" style="color: var(--text-muted); font-style: italic;">Zurzeit gibt es keine Neuigkeiten.</p>';
        return;
      }

      container.innerHTML = newsList.map(item => `
        <article class="news-card">
          <div class="news-card__meta">
            <span class="news-card__badge news-card__badge--accent">${escapeHtml(item.badge)}</span>
            <time class="news-card__date" datetime="${escapeHtml(item.news_date)}">${escapeHtml(item.news_date)}</time>
          </div>
          <h4 class="news-card__title">${escapeHtml(item.title)}</h4>
          <p class="news-card__text">${escapeHtml(item.content)}</p>
        </article>
      `).join('');
    } catch (error) {
      console.error('Fehler beim Laden der News:', error);
      container.innerHTML = '<p class="news-error" style="color: var(--danger-color); font-size: 0.95rem;">Neuigkeiten konnten nicht geladen werden.</p>';
    }
  }

  function escapeHtml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // News laden, sobald das DOM bereit ist
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadNews);
  } else {
    loadNews();
  }
})();

