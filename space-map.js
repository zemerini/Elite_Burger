/**
 * ==========================================================================
 * ELITE BURGER — CINEMATIC SPACE ZOOM CONTROLLER (OPEN SOURCE / MAPLIBRE GL)
 * 100% Free & Open-Source: Keine API-Keys, keine Limits, keine Quota-Kosten!
 * Nutzt Esri World Imagery (High-Res Satellit) via MapLibre GL JS
 * ==========================================================================
 */

(function () {
  'use strict';

  // Exact Rooftop Coordinates for Kommodore-Johnsen-Boulevard 21, 28217 Bremen
  const TARGET_COORDS = [8.75513, 53.101985];
  const START_ZOOM = 2.2; // Globale Ansicht aus dem Weltall
  const TARGET_ZOOM = 17.6; // Gestochen scharfe Ansicht der Hausnummer 21
  const START_PITCH = 0;
  const TARGET_PITCH = 0; // Pure 2D top-down view
  const START_BEARING = 0;
  const TARGET_BEARING = 0;
  const FLY_DURATION = 3800; // ms

  // DOM Elements
  const stageEl = document.getElementById('spaceLocationStage');
  const mapContainer = document.getElementById('spaceMap');
  const fallbackEl = document.getElementById('spaceFallback');
  const cloudCanvas = document.getElementById('cloudOverlay');
  const copyBtn = document.getElementById('copyAddressBtn');

  if (!stageEl || !mapContainer || !cloudCanvas) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // --- Cloud & Atmospheric Fog Engine (Procedural Canvas) ---
  const ctx = cloudCanvas.getContext('2d');
  let animationProgress = 0;
  let cloudAnimRunning = false;
  let cloudStartTime = 0;
  let particles = [];

  function resizeCanvas() {
    const rect = stageEl.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cloudCanvas.width = rect.width * dpr;
    cloudCanvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    initParticles(rect.width, rect.height);
  }

  function initParticles(width, height) {
    particles = [];
    const count = 38;
    for (let i = 0; i < count; i++) {
      particles.push({
        x: (Math.random() - 0.5) * width * 1.4 + width / 2,
        y: (Math.random() - 0.5) * height * 1.4 + height / 2,
        baseRadius: Math.random() * 120 + 90,
        opacity: Math.random() * 0.35 + 0.25
      });
    }
  }

  window.addEventListener('resize', resizeCanvas, { passive: true });
  resizeCanvas();

  function renderClouds(progress) {
    const width = cloudCanvas.width / (Math.min(window.devicePixelRatio || 1, 2));
    const height = cloudCanvas.height / (Math.min(window.devicePixelRatio || 1, 2));

    ctx.clearRect(0, 0, width, height);

    let envelope = 0;
    if (progress < 0.15) {
      envelope = 0;
    } else if (progress < 0.35) {
      envelope = (progress - 0.15) / 0.2;
    } else if (progress <= 0.65) {
      envelope = 1;
    } else if (progress < 0.85) {
      envelope = 1 - (progress - 0.65) / 0.2;
    } else {
      envelope = 0;
    }

    if (envelope <= 0.01) {
      cloudCanvas.style.opacity = '0';
      return;
    }

    cloudCanvas.style.opacity = (envelope * 0.95).toFixed(3);

    const centerX = width / 2;
    const centerY = height / 2;

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const radialDistX = p.x - centerX;
      const radialDistY = p.y - centerY;
      const expansion = 1 + progress * 1.8;

      const curX = centerX + radialDistX * expansion;
      const curY = centerY + radialDistY * expansion;
      const curRadius = p.baseRadius * (1 + progress * 1.6);

      const grad = ctx.createRadialGradient(
        curX, curY, curRadius * 0.05,
        curX, curY, curRadius
      );

      const alpha = p.opacity * envelope;
      grad.addColorStop(0, `rgba(235, 240, 250, ${alpha * 0.65})`);
      grad.addColorStop(0.4, `rgba(185, 195, 215, ${alpha * 0.4})`);
      grad.addColorStop(0.75, `rgba(130, 140, 165, ${alpha * 0.18})`);
      grad.addColorStop(1, 'rgba(100, 110, 130, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(curX, curY, curRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function startCloudAnimation() {
    if (prefersReducedMotion) return;
    cloudAnimRunning = true;
    cloudStartTime = performance.now();

    function step(now) {
      if (!cloudAnimRunning) return;
      const elapsed = now - cloudStartTime;
      animationProgress = Math.min(elapsed / FLY_DURATION, 1);

      renderClouds(animationProgress);

      if (animationProgress < 1) {
        requestAnimationFrame(step);
      } else {
        cloudAnimRunning = false;
        ctx.clearRect(0, 0, cloudCanvas.width, cloudCanvas.height);
        cloudCanvas.style.opacity = '0';
      }
    }

    requestAnimationFrame(step);
  }

  // --- Map Engine State ---
  let map = null;
  let marker = null;
  let markerElement = null;
  let hasAnimatedOnce = false;
  let fallbackActive = false;

  function isWebGLSupported() {
    try {
      const c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl') || c.getContext('webgl2')));
    } catch (e) {
      return false;
    }
  }

  // Open-Source Esri World Imagery (Kostenlos, unbegrenzt, gestochen scharf)
  const esriSatelliteStyle = {
    version: 8,
    sources: {
      'esri-world-imagery': {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        ],
        tileSize: 256,
        maxzoom: 19,
        attribution: 'Esri, Maxar, Earthstar Geographics'
      },
      'esri-world-labels': {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'
        ],
        tileSize: 256,
        maxzoom: 19
      }
    },
    layers: [
      {
        id: 'satellite-tiles',
        type: 'raster',
        source: 'esri-world-imagery'
      },
      {
        id: 'place-labels',
        type: 'raster',
        source: 'esri-world-labels',
        minzoom: 10
      }
    ]
  };

  function activateSatelliteFallback() {
    if (fallbackActive) return;
    fallbackActive = true;

    if (fallbackEl) {
      // Satellitenkachel für Bremen Überseestadt
      fallbackEl.style.backgroundImage = 'url("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/17/42491/68032.jpg")';
      fallbackEl.classList.add('is-active');
    }

    setupDOMMarkerStandalone();
    setupIntersectionObserver();
  }

  function setupDOMMarkerStandalone() {
    if (markerElement) return;
    markerElement = document.createElement('div');
    markerElement.className = 'space-marker is-visible';
    markerElement.style.position = 'absolute';
    markerElement.style.top = '48%';
    markerElement.style.left = '50%';
    markerElement.style.zIndex = '4';
    markerElement.setAttribute('role', 'button');
    markerElement.setAttribute('aria-label', 'Elite Burger Bremen');

    markerElement.innerHTML = `
      <div class="space-marker__pulse"></div>
      <div class="space-marker__body">
        <img src="images/Logo_transparent.png" alt="Elite Burger" class="space-marker__icon">
      </div>
    `;

    markerElement.addEventListener('click', () => {
      window.open('https://maps.google.com/?q=Kommodore-Johnsen-Boulevard+21,+28217+Bremen', '_blank', 'noopener,noreferrer');
    });

    stageEl.appendChild(markerElement);
  }

  function initMapEngine() {
    const MapEngine = window.maplibregl || window.mapboxgl;

    if (!MapEngine) {
      setTimeout(initMapEngine, 200);
      return;
    }

    if (!isWebGLSupported()) {
      activateSatelliteFallback();
      return;
    }

    try {
      map = new MapEngine.Map({
        container: 'spaceMap',
        style: esriSatelliteStyle,
        center: TARGET_COORDS,
        zoom: START_ZOOM,
        pitch: START_PITCH,
        bearing: START_BEARING,
        attributionControl: false,
        interactive: true
      });

      map.on('load', () => {
        map.resize();
        setupMarker();
        setupIntersectionObserver();
      });

      map.on('error', (e) => {
        console.warn('Map engine notice:', e);
      });

      window.addEventListener('resize', () => {
        if (map) map.resize();
      }, { passive: true });

    } catch (err) {
      console.warn('Map initialization fallback triggered:', err);
      activateSatelliteFallback();
    }
  }

  function setupMarker() {
    if (!map || markerElement) return;

    markerElement = document.createElement('div');
    markerElement.className = 'space-marker';
    markerElement.setAttribute('role', 'button');
    markerElement.setAttribute('aria-label', 'Elite Burger Bremen');

    markerElement.innerHTML = `
      <div class="space-marker__pulse"></div>
      <div class="space-marker__body">
        <img src="images/Logo_transparent.png" alt="Elite Burger" class="space-marker__icon">
      </div>
    `;

    const MapEngine = window.maplibregl || window.mapboxgl;
    marker = new MapEngine.Marker({
      element: markerElement,
      anchor: 'bottom'
    })
      .setLngLat(TARGET_COORDS)
      .addTo(map);

    markerElement.addEventListener('click', () => {
      window.open('https://maps.google.com/?q=Kommodore-Johnsen-Boulevard+21,+28217+Bremen', '_blank', 'noopener,noreferrer');
    });
  }

  function triggerCinematicFlyTo() {
    if (fallbackActive) {
      startCloudAnimation();
      if (markerElement) {
        markerElement.classList.remove('is-visible');
        setTimeout(() => markerElement.classList.add('is-visible'), FLY_DURATION);
      }
      return;
    }

    if (!map) return;

    map.resize();

    if (markerElement) {
      markerElement.classList.remove('is-visible');
    }

    if (prefersReducedMotion) {
      map.jumpTo({
        center: TARGET_COORDS,
        zoom: TARGET_ZOOM,
        pitch: TARGET_PITCH,
        bearing: TARGET_BEARING
      });
      if (markerElement) markerElement.classList.add('is-visible');
      return;
    }

    startCloudAnimation();

    map.flyTo({
      center: TARGET_COORDS,
      zoom: TARGET_ZOOM,
      pitch: TARGET_PITCH,
      bearing: TARGET_BEARING,
      duration: FLY_DURATION,
      essential: true,
      curve: 1.42,
      easing: (t) => 1 - Math.pow(1 - t, 3)
    });

    map.once('moveend', () => {
      if (markerElement) {
        markerElement.classList.add('is-visible');
      }
    });
  }

  function setupIntersectionObserver() {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (map) map.resize();
            if (!hasAnimatedOnce) {
              hasAnimatedOnce = true;
              setTimeout(() => {
                triggerCinematicFlyTo();
              }, 400);
            }
          }
        });
      },
      {
        threshold: 0.2
      }
    );

    observer.observe(stageEl);
  }

  // Copy Address Button
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      const address = 'Kommodore-Johnsen-Boulevard 21, 28217 Bremen';
      try {
        await navigator.clipboard.writeText(address);
        copyBtn.classList.add('is-copied');
        const originalTitle = copyBtn.getAttribute('title');
        copyBtn.setAttribute('title', 'Adresse kopiert!');
        setTimeout(() => {
          copyBtn.classList.remove('is-copied');
          if (originalTitle) copyBtn.setAttribute('title', originalTitle);
        }, 2200);
      } catch (e) {
        console.error('Clipboard copy failed:', e);
      }
    });
  }

  // Initialisieren
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMapEngine);
  } else {
    initMapEngine();
  }

})();
