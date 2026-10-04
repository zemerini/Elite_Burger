/**
 * BUNSMITH — Premium Smashburger
 * Interactive Script: Scroll reveals, header state, ambient glow, springs
 */

(function () {
  'use strict';

  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const prefersReducedMotion = () => reducedMotionQuery.matches;

  // --- Spring-Engine ---
  // Apple-Parametrisierung: damping = Dämpfungsgrad (1 = kein Überschwingen),
  // response = Zeit einer ungedämpften Schwingung in Sekunden (kleiner = knackiger).
  // Ein neues Ziel startet immer vom aktuellen Wert UND der aktuellen Geschwindigkeit:
  // dadurch ist jede Bewegung jederzeit unterbrech- und umkehrbar, ohne Sprung.
  function createSpring(initial, config, onUpdate) {
    let value = initial;
    let velocity = 0;
    let target = initial;
    let response = config.response ?? 0.35;
    let damping = config.damping ?? 1;
    const restDelta = config.restDelta ?? 0.001;
    let raf = 0;
    let last = 0;

    function tick(now) {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      if (dt <= 0) {
        raf = requestAnimationFrame(tick);
        return;
      }

      const omega = (2 * Math.PI) / response;
      const stiffness = omega * omega;
      const drag = 2 * damping * omega;
      const steps = Math.ceil(dt / (1 / 240));
      const h = dt / steps;

      for (let i = 0; i < steps; i++) {
        velocity += (-stiffness * (value - target) - drag * velocity) * h;
        value += velocity * h;
      }

      if (Math.abs(velocity) < restDelta * 10 && Math.abs(value - target) < restDelta) {
        value = target;
        velocity = 0;
        raf = 0;
        onUpdate(value);
        return;
      }

      onUpdate(value);
      raf = requestAnimationFrame(tick);
    }

    return {
      to(next, options = {}) {
        target = next;
        if (options.response != null) response = options.response;
        if (options.damping != null) damping = options.damping;
        if (!raf) {
          last = performance.now();
          raf = requestAnimationFrame(tick);
        }
      },
      jump(next) {
        cancelAnimationFrame(raf);
        raf = 0;
        value = target = next;
        velocity = 0;
        onUpdate(value);
      },
    };
  }

  // --- Press- & Hover-Feedback per Feder ---
  // Reagiert auf pointerdown (nicht erst auf click), bricht ab, wenn der Finger
  // wegwandert, und löst sich beim Loslassen mit leichtem Nachfedern.
  function makePressable(el, { hoverScale = 1, hoverLift = 0, pressScale = 0.96 } = {}) {
    if (!el) return;
    let hovering = false;
    let pressed = false;

    const render = () => {
      el.style.transform = scale.atRest && lift.atRest
        ? ''
        : `translate3d(0, ${liftValue}px, 0) scale(${scaleValue})`;
    };

    let scaleValue = 1;
    let liftValue = 0;
    const scale = createSpring(1, { response: 0.3, damping: 1, restDelta: 0.0005 }, (v) => {
      scaleValue = v;
      scale.atRest = v === 1;
      render();
    });
    const lift = createSpring(0, { response: 0.35, damping: 1, restDelta: 0.01 }, (v) => {
      liftValue = v;
      lift.atRest = v === 0;
      render();
    });
    scale.atRest = true;
    lift.atRest = true;

    function settle({ released = false } = {}) {
      const reduce = prefersReducedMotion();
      const hoverOn = hovering && !reduce;
      if (pressed) {
        scale.to(reduce ? 0.985 : pressScale, { response: 0.16, damping: 1 });
        lift.to(0, { response: 0.16, damping: 1 });
      } else {
        // Loslassen trägt Schwung: leicht unterdämpft; Hover-Wechsel bleibt kritisch gedämpft
        const spring = released ? { response: 0.4, damping: 0.78 } : { response: 0.35, damping: 1 };
        scale.to(hoverOn ? hoverScale : 1, spring);
        lift.to(hoverOn ? hoverLift : 0, spring);
      }
    }

    el.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse') return;
      hovering = true;
      if (!pressed) settle();
    });

    el.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button > 0) return;
      pressed = true;
      settle();
    });

    const release = () => {
      if (!pressed) return;
      pressed = false;
      settle({ released: true });
    };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);

    el.addEventListener('pointerleave', () => {
      hovering = false;
      if (pressed) {
        pressed = false;
        settle({ released: true });
      } else {
        settle();
      }
    });
  }

  makePressable(document.querySelector('.hero__cta'), { hoverScale: 1.03, hoverLift: -2, pressScale: 0.965 });
  for (const link of document.querySelectorAll('.footer__social-link')) {
    makePressable(link, { hoverScale: 1.06, hoverLift: -3, pressScale: 0.92 });
  }
  for (const btn of document.querySelectorAll('.menu__toggle-btn')) {
    makePressable(btn, { pressScale: 0.94 });
  }

  // --- Scroll Reveal with IntersectionObserver ---
  // Stagger pro Batch: was gleichzeitig sichtbar wird, kaskadiert kurz hintereinander.
  const revealElements = document.querySelectorAll('.reveal');

  if (revealElements.length > 0) {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        const entering = entries.filter((entry) => entry.isIntersecting);
        entering.forEach((entry, index) => {
          entry.target.style.setProperty('--reveal-delay', `${Math.min(index, 5) * 80}ms`);
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        });
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

    updateHeaderState();
  }

  // --- Ambient Cursor Glow (desktop only) ---
  // Folgt dem Cursor mit weicher Annäherung (Compositor-only: transform).
  const ambientGlow = document.getElementById('ambientGlow');

  if (ambientGlow && window.matchMedia('(pointer: fine)').matches) {
    let glowActive = false;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let glowRaf = 0;

    function glowTick() {
      const ease = prefersReducedMotion() ? 1 : 0.12;
      currentX += (targetX - currentX) * ease;
      currentY += (targetY - currentY) * ease;
      ambientGlow.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;

      if (Math.abs(targetX - currentX) < 0.5 && Math.abs(targetY - currentY) < 0.5) {
        glowRaf = 0;
        return;
      }
      glowRaf = requestAnimationFrame(glowTick);
    }

    document.addEventListener('mousemove', (e) => {
      targetX = e.clientX - 200;
      targetY = e.clientY - 200;

      if (!glowActive) {
        currentX = targetX;
        currentY = targetY;
        ambientGlow.classList.add('active');
        glowActive = true;
      }

      if (!glowRaf) glowRaf = requestAnimationFrame(glowTick);
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
        target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
      }
    });
  }

  // --- Hero-Video: bei reduzierter Bewegung stehen lassen (Poster bleibt sichtbar) ---
  const heroVideo = document.querySelector('.hero__bg-video');
  if (heroVideo) {
    const syncVideoToMotionPreference = () => {
      if (prefersReducedMotion()) {
        heroVideo.pause();
      } else {
        const playing = heroVideo.play();
        if (playing && typeof playing.catch === 'function') playing.catch(() => {});
      }
    };
    if (prefersReducedMotion()) syncVideoToMotionPreference();
    reducedMotionQuery.addEventListener('change', syncVideoToMotionPreference);
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
    const slider = menuTogglePill.querySelector('.menu__toggle-slider');

    // Schieber als Feder: jederzeit umlenkbar, minimales Nachfedern wie ein physischer Schalter
    const sliderSpring = slider
      ? createSpring(0, { response: 0.3, damping: 0.8, restDelta: 0.0005 }, (progress) => {
        slider.style.transform = `translateX(${progress * 100}%)`;
      })
      : null;

    function setMenuMode(mode) {
      const isMenu = mode === 'menu';

      if (isMenu) {
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

      if (sliderSpring) {
        if (prefersReducedMotion()) {
          sliderSpring.jump(isMenu ? 1 : 0);
        } else {
          sliderSpring.to(isMenu ? 1 : 0);
        }
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
