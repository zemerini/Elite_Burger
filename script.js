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
  const legendHeaderEl = document.getElementById('legendCardHeader') || document.getElementById('legendToggleBtn');
  if (legendHeaderEl) {
    makePressable(legendHeaderEl, { pressScale: 0.99 });
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
        if (playing && typeof playing.catch === 'function') playing.catch(() => { });
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

  // --- Apple-style 3D Glass Flip Cards & Menu Toggle ---
  const menuTogglePill = document.getElementById('menuTogglePill');
  const btnSingle = document.getElementById('btn-single');
  const btnMenu = document.getElementById('btn-menu');
  const menuSection = document.getElementById('menu');
  const cards = Array.from(document.querySelectorAll('.menu-card'));

  if (cards.length > 0) {
    const cardControllers = [];

    // Helper to sync global toggle button state based on cards
    function syncToggleFromCards() {
      if (!menuTogglePill || !btnSingle || !btnMenu) return;
      const menuCount = cardControllers.filter(c => c.getTarget() === 180).length;
      if (menuCount === cardControllers.length) {
        syncToggleUI('menu');
      } else if (menuCount === 0) {
        syncToggleUI('single');
      }
    }

    cards.forEach((card, index) => {
      const inner = card.querySelector('.menu-card__inner');
      const frontFace = card.querySelector('.menu-card__face--front');
      const backFace = card.querySelector('.menu-card__face--back');
      const frontSheen = frontFace ? frontFace.querySelector('.menu-card__glass-sheen') : null;
      const backSheen = backFace ? backFace.querySelector('.menu-card__glass-sheen') : null;

      let targetAngle = 0; // 0 = single, 180 = menu
      let currentAngle = 0;

      // Apple WWDC 2018 rotation spring: damping 0.82, response 0.42
      // Erlaubt unterbrechungsfreie Umkehr aus jedem beliebigen Flug-Winkel
      const spring = createSpring(0, { response: 0.42, damping: 0.82, restDelta: 0.05 }, (angle) => {
        currentAngle = angle;

        if (prefersReducedMotion()) {
          const p = Math.max(0, Math.min(1, angle / 180));
          if (frontFace) {
            frontFace.style.opacity = (1 - p).toFixed(2);
            frontFace.style.pointerEvents = p > 0.5 ? 'none' : 'auto';
          }
          if (backFace) {
            backFace.style.opacity = p.toFixed(2);
            backFace.style.pointerEvents = p <= 0.5 ? 'none' : 'auto';
          }
          if (inner) inner.style.transform = 'none';
          return;
        }

        // Apple 3D Physics:
        // Z-Elevation: bei 90° hebt sich die Karte um 26px in den Raum zum Betrachter
        const rad = (angle * Math.PI) / 180;
        const depth = Math.sin(rad) * 26;
        if (inner) {
          if (Math.abs(angle) < 0.05) {
            inner.style.transform = '';
          } else if (Math.abs(angle - 180) < 0.05) {
            inner.style.transform = 'rotateY(180deg)';
          } else {
            inner.style.transform = `translate3d(0, 0, ${depth.toFixed(2)}px) rotateY(${angle.toFixed(2)}deg)`;
          }
        }

        // Sichtbarkeit an der 90°-Kante umschalten verhindert Z-Fighting und Durchscheinen
        const isFlippedOver = angle >= 90;
        if (frontFace) {
          frontFace.style.visibility = isFlippedOver ? 'hidden' : 'visible';
          frontFace.style.pointerEvents = isFlippedOver ? 'none' : 'auto';
        }
        if (backFace) {
          backFace.style.visibility = isFlippedOver ? 'visible' : 'hidden';
          backFace.style.pointerEvents = isFlippedOver ? 'auto' : 'none';
        }

        // Dynamischer Lichtstreif (Specular Sheen) wandert über das Glas
        const sheenOffset = (angle / 180) * 160 - 30;
        if (frontSheen) frontSheen.style.transform = `translateX(${sheenOffset.toFixed(1)}%) rotate(25deg)`;
        if (backSheen) backSheen.style.transform = `translateX(${(100 - sheenOffset).toFixed(1)}%) rotate(25deg)`;

        // Status-Attribute synchronisieren
        card.setAttribute('data-mode', isFlippedOver ? 'menu' : 'single');
        card.setAttribute('aria-expanded', isFlippedOver ? 'true' : 'false');
      });

      function flipTo(target, { immediate = false } = {}) {
        targetAngle = target;
        if (immediate || prefersReducedMotion()) {
          spring.jump(target);
        } else {
          spring.to(target);
        }
      }

      function toggleFlip() {
        const next = targetAngle === 0 ? 180 : 0;
        flipTo(next);
        syncToggleFromCards();
      }

      // Touch & Pointer Feedback (Sofortige Reaktion auf pointerdown per SKILL.md)
      let pointerStartX = 0;
      let pointerStartY = 0;
      let isPointerDown = false;
      let isDragScroll = false;

      card.addEventListener('pointerdown', (e) => {
        if (e.button !== undefined && e.button > 0) return;
        // Tipp auf die Allergen-Zeile ist eine eigene Aktion, kein Karten-Flip
        if (e.target.closest('.product-allergens')) return;
        isPointerDown = true;
        isDragScroll = false;
        pointerStartX = e.clientX;
        pointerStartY = e.clientY;
        card.classList.add('is-pressed');
      });

      card.addEventListener('pointermove', (e) => {
        if (!isPointerDown) return;
        if (Math.hypot(e.clientX - pointerStartX, e.clientY - pointerStartY) > 8) {
          isDragScroll = true;
          card.classList.remove('is-pressed');
        }
      });

      card.addEventListener('pointerup', () => {
        isPointerDown = false;
        card.classList.remove('is-pressed');
      });

      card.addEventListener('pointercancel', () => {
        isPointerDown = false;
        card.classList.remove('is-pressed');
      });

      card.addEventListener('pointerleave', () => {
        isPointerDown = false;
        card.classList.remove('is-pressed');
      });

      card.addEventListener('click', (e) => {
        if (isDragScroll) return;
        if (e.target.closest('a')) return;
        if (e.target.closest('.allergen-code, .product-allergens')) return;
        toggleFlip();
      });

      // Barrierefreiheit: Tastatur-Navigation (Enter & Space)
      card.addEventListener('keydown', (e) => {
        if (e.target.closest('.product-allergens')) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleFlip();
        }
      });

      cardControllers.push({
        card,
        flipTo,
        toggleFlip,
        getTarget: () => targetAngle,
        getCurrent: () => currentAngle
      });
    });

    // Global Toggle Pill (Single / Menü)
    if (menuTogglePill && btnSingle && btnMenu && menuSection) {
      const slider = menuTogglePill.querySelector('.menu__toggle-slider');
      const sliderSpring = slider
        ? createSpring(0, { response: 0.3, damping: 0.8, restDelta: 0.0005 }, (progress) => {
          slider.style.transform = `translateX(${progress * 100}%)`;
        })
        : null;

      let waveTimeouts = [];

      function clearWaveTimeouts() {
        waveTimeouts.forEach(t => clearTimeout(t));
        waveTimeouts = [];
      }

      function syncToggleUI(mode) {
        const isMenu = mode === 'menu';
        menuTogglePill.setAttribute('data-active', mode);
        btnSingle.classList.toggle('active', !isMenu);
        btnSingle.setAttribute('aria-pressed', (!isMenu).toString());
        btnMenu.classList.toggle('active', isMenu);
        btnMenu.setAttribute('aria-pressed', isMenu.toString());
        menuSection.classList.toggle('menu--show-menu', isMenu);

        if (sliderSpring) {
          if (prefersReducedMotion()) {
            sliderSpring.jump(isMenu ? 1 : 0);
          } else {
            sliderSpring.to(isMenu ? 1 : 0);
          }
        }
      }

      function setGlobalMode(mode) {
        clearWaveTimeouts();
        syncToggleUI(mode);
        const targetAngle = mode === 'menu' ? 180 : 0;

        cardControllers.forEach((ctrl, i) => {
          if (prefersReducedMotion()) {
            ctrl.flipTo(targetAngle, { immediate: true });
          } else {
            // Apple Cascading Wave (Stagger von 45ms pro Karte)
            const timeout = setTimeout(() => {
              ctrl.flipTo(targetAngle);
            }, i * 45);
            waveTimeouts.push(timeout);
          }
        });
      }

      btnSingle.addEventListener('click', () => setGlobalMode('single'));
      btnMenu.addEventListener('click', () => setGlobalMode('menu'));
    }
  }

  // --- Legend Accordion & Allergen Jump Handler ---
  const legendCard = document.getElementById('legendCard') || document.querySelector('.legend-card');
  const legendHeader = document.getElementById('legendCardHeader') || document.querySelector('.legend-card__header');
  const legendToggleBtn = document.getElementById('legendToggleBtn');
  const legendContent = document.getElementById('legendContent');
  const legendSubtitle = document.getElementById('legendSubtitle') || (legendCard ? legendCard.querySelector('.legend-card__subtitle') : null);

  function setLegendExpanded(expanded) {
    if (!legendContent) return;
    legendContent.classList.toggle('is-collapsed', !expanded);

    if (legendHeader) {
      legendHeader.setAttribute('aria-expanded', expanded.toString());
      legendHeader.setAttribute('aria-label', expanded ? 'Allergene & Zusatzstoffe Legende einklappen' : 'Allergene & Zusatzstoffe Legende aufklappen');
    }
    if (legendCard) {
      legendCard.setAttribute('data-expanded', expanded.toString());
    }
    if (legendToggleBtn) {
      legendToggleBtn.setAttribute('aria-expanded', expanded.toString());
      const textSpan = legendToggleBtn.querySelector('.legend-card__toggle-text');
      if (textSpan) {
        textSpan.textContent = expanded ? 'Legende einklappen' : 'Legende ausklappen';
      }
    }
    if (legendSubtitle) {
      legendSubtitle.textContent = expanded ? 'Tippen zum Einklappen' : 'Tippen zum Aufklappen';
    }
    // Legende zu = Markierung erledigt
    if (!expanded) clearAllergenHighlights();
  }

  function toggleLegend() {
    if (!legendContent) return;
    const isCurrentlyCollapsed = legendContent.classList.contains('is-collapsed');
    setLegendExpanded(isCurrentlyCollapsed);
  }

  if (legendHeader) {
    legendHeader.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleLegend();
    });

    legendHeader.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleLegend();
      }
    });
  }

  // Also clicking anywhere on the card when collapsed expands it smoothly
  if (legendCard) {
    legendCard.addEventListener('click', (e) => {
      // If header was clicked, it's already handled with e.stopPropagation()
      // If clicked inside content while open, don't collapse (user selecting text or reading)
      if (legendContent && !legendContent.classList.contains('is-collapsed') && e.target.closest('#legendContent')) {
        return;
      }
      // If collapsed, clicking anywhere on the card opens it!
      if (legendContent && legendContent.classList.contains('is-collapsed')) {
        setLegendExpanded(true);
      }
    });
  }

  // --- Mobile Legend Category Tabs ---
  const tabBtnAllergens = document.getElementById('tabBtnAllergens');
  const tabBtnAdditives = document.getElementById('tabBtnAdditives');
  const colAllergens = document.getElementById('legendColAllergens');
  const colAdditives = document.getElementById('legendColAdditives');

  function setLegendTab(tab) {
    if (!tabBtnAllergens || !tabBtnAdditives || !colAllergens || !colAdditives) return;
    const isAllergens = tab === 'allergens';

    tabBtnAllergens.classList.toggle('is-active', isAllergens);
    tabBtnAllergens.setAttribute('aria-selected', isAllergens.toString());

    tabBtnAdditives.classList.toggle('is-active', !isAllergens);
    tabBtnAdditives.setAttribute('aria-selected', (!isAllergens).toString());

    colAllergens.classList.toggle('is-active', isAllergens);
    colAdditives.classList.toggle('is-active', !isAllergens);
  }

  if (tabBtnAllergens && tabBtnAdditives) {
    tabBtnAllergens.addEventListener('click', (e) => {
      e.stopPropagation();
      setLegendTab('allergens');
    });

    tabBtnAdditives.addEventListener('click', (e) => {
      e.stopPropagation();
      setLegendTab('additives');
    });
  }

  // --- Allergen-Markierung & Zurück-Navigation ---
  // Ein Tipp auf die Klammer eines Produkts (egal auf welchen Code) markiert ALLE
  // darin enthaltenen Allergene und Zusatzstoffe in der Legende. Ein "Zurück"-Button
  // erlaubt es, mit einem Klick genau zum Ausgangsprodukt zurückzuspringen.
  let activeAllergenSource = null;
  let returnTargetElement = null;

  const legendReturnBar = document.getElementById('legendReturnBar');
  const legendReturnBtn = document.getElementById('legendReturnBtn');
  const legendReturnTarget = document.getElementById('legendReturnTarget');
  const legendReturnFooter = document.getElementById('legendReturnFooter');
  const legendReturnFooterBtn = document.getElementById('legendReturnFooterBtn');
  const legendReturnTargetBottom = document.getElementById('legendReturnTargetBottom');

  function getLegendItemId(code) {
    return /^\d+$/.test(code) ? `additive-item-${code}` : `allergen-item-${code}`;
  }

  function getCodesFrom(container) {
    const codes = Array.from(container.querySelectorAll('.allergen-code'), (el) => {
      const raw = el.getAttribute('data-code') || el.textContent;
      const match = raw.trim().replace(/[()]/g, '').match(/^[a-z0-9]+/i);
      return match ? match[0].toLowerCase() : '';
    });
    return [...new Set(codes.filter(Boolean))];
  }

  // Zähler an den mobilen Tabs, damit Markierungen im anderen Tab nicht übersehen werden
  function ensureTabMarker(tabBtn) {
    let marker = tabBtn.querySelector('.legend-card__tab-marker');
    if (!marker) {
      marker = document.createElement('span');
      marker.className = 'legend-card__tab-marker';
      marker.hidden = true;
      tabBtn.appendChild(marker);
    }
    return marker;
  }

  function updateTabMarkers() {
    const pairs = [
      [tabBtnAllergens, colAllergens, 'Allergene'],
      [tabBtnAdditives, colAdditives, 'Zusatzstoffe'],
    ];
    for (const [tabBtn, col, label] of pairs) {
      if (!tabBtn || !col) continue;
      const count = col.querySelectorAll('.legend-list__item.is-highlighted').length;
      const marker = ensureTabMarker(tabBtn);
      marker.hidden = count === 0;
      marker.textContent = count > 0 ? String(count) : '';
      tabBtn.setAttribute('aria-label', count > 0 ? `${label}, ${count} markiert` : label);
    }
  }

  function clearAllergenHighlights() {
    for (const item of document.querySelectorAll('.legend-list__item.is-highlighted')) {
      item.classList.remove('is-highlighted');
    }
    if (activeAllergenSource) {
      activeAllergenSource.classList.remove('is-active');
      activeAllergenSource = null;
    }
    if (legendReturnBar) legendReturnBar.hidden = true;
    if (legendReturnFooter) legendReturnFooter.hidden = true;
    updateTabMarkers();
  }

  function scrollLegendIntoView() {
    const target = legendCard || legendContent;
    if (!target) return;
    // Fixierten Header berücksichtigen, damit der Legendenkopf nicht verdeckt wird
    const headerBottom = header ? Math.max(0, header.getBoundingClientRect().bottom) : 0;
    const top = target.getBoundingClientRect().top + window.scrollY - headerBottom - 12;
    window.scrollTo({ top: Math.max(0, top), behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }

  function highlightProductAllergens(container) {
    const items = getCodesFrom(container)
      .map((code) => document.getElementById(getLegendItemId(code)))
      .filter(Boolean);

    clearAllergenHighlights();
    if (items.length === 0) return;

    activeAllergenSource = container;
    container.classList.add('is-active');

    // Produktname & Zielelement für den "Zurück"-Button ermitteln
    const card = container.closest('.menu-card');
    const listItem = container.closest('.menu-list__item');
    let productName = 'Produkt';

    if (card) {
      returnTargetElement = card;
      const nameEl = card.querySelector('.menu-card__name');
      if (nameEl) {
        const clone = nameEl.cloneNode(true);
        clone.querySelectorAll('.product-allergens, .menu-card__name-badge, .wac-morph__coin, [aria-hidden="true"]').forEach((el) => el.remove());
        productName = clone.textContent.replace(/\s+/g, ' ').trim() || 'Burger';
      }
    } else if (listItem) {
      returnTargetElement = listItem;
      const nameEl = listItem.querySelector('.menu-list__name');
      productName = nameEl ? nameEl.textContent.trim() : 'Produkt';
    } else {
      returnTargetElement = container;
    }

    // Zurück-Buttons beschriften und anzeigen
    if (legendReturnTarget) legendReturnTarget.textContent = productName;
    if (legendReturnTargetBottom) legendReturnTargetBottom.textContent = productName;
    if (legendReturnBar) legendReturnBar.hidden = false;
    if (legendReturnFooter) legendReturnFooter.hidden = false;

    if (legendContent && legendContent.classList.contains('is-collapsed')) {
      setLegendExpanded(true);
    }

    // Mobile: Allergene-Tab bevorzugen, Zusatzstoffe nur wenn es keine Allergene gibt
    const hasAllergens = items.some((item) => item.id.startsWith('allergen-item-'));
    setLegendTab(hasAllergens ? 'allergens' : 'additives');

    // Reflow erzwingen, damit der Puls auch beim erneuten Tippen desselben Produkts abläuft
    void items[0].offsetWidth;
    for (const item of items) {
      item.classList.add('is-highlighted');
    }
    updateTabMarkers();

    // Nach dem Aufklappen ist das Layout erst im nächsten Frame final
    requestAnimationFrame(scrollLegendIntoView);
  }

  function returnToProduct() {
    if (!returnTargetElement) return;

    const headerBottom = header ? Math.max(0, header.getBoundingClientRect().bottom) : 0;
    const rect = returnTargetElement.getBoundingClientRect();
    const top = rect.top + window.scrollY - headerBottom - 24;

    window.scrollTo({
      top: Math.max(0, top),
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });

    // Sanfte Puls-Hervorhebung des Ausgangsprodukts zur visuellen Orientierung
    returnTargetElement.classList.add('product-returned-pulse');
    setTimeout(() => {
      if (returnTargetElement) returnTargetElement.classList.remove('product-returned-pulse');
    }, 2200);
  }

  if (legendReturnBtn) {
    legendReturnBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      returnToProduct();
    });
  }

  if (legendReturnFooterBtn) {
    legendReturnFooterBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      returnToProduct();
    });
  }

  document.addEventListener('click', (e) => {
    const container = e.target.closest('.product-allergens');
    if (!container) return;
    e.preventDefault();
    highlightProductAllergens(container);
  });

  // Tastatur: Enter/Leertaste auf einem Code verhält sich wie ein Tipp
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const codeEl = e.target.closest('.allergen-code');
    if (!codeEl) return;
    const container = codeEl.closest('.product-allergens');
    if (!container) return;
    e.preventDefault();
    highlightProductAllergens(container);
  });

  // --- Menu Data State ---
  // Expose menu data globally for state inspection and client applications
  fetch('menu-data.json')
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (data) window.MENU_DATA = data;
    })
    .catch(() => { });

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

