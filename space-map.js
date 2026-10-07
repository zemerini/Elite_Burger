/**
 * ==========================================================================
 * ELITE BURGER — CINEMATIC SPACE ZOOM CONTROLLER
 * 3D Globe Satellite Fly-To with Atmospheric Cloud Penetration
 * ==========================================================================
 */

(function () {
  'use strict';

  // --- Configuration ---
  const DEFAULT_MAPBOX_TOKEN = 'pk.eyJ1IjoibGVhcmQwMSIsImEiOiJjbXV4dHN1NGYwZDhkMnpzbHlsM3ViZ2lrIn0.fOGSoV4GrzQZUwO6CGB4NA';

  // Exact Rooftop Coordinates for Kommodore-Johnsen-Boulevard 21, 28217 Bremen
  const TARGET_COORDS = [8.75513, 53.101985]; 
  const START_ZOOM = 1.5;
  const TARGET_ZOOM = 17.5;
  const START_PITCH = 0;
  const TARGET_PITCH = 0; // Pure 2D top-down view
  const START_BEARING = 0;
  const TARGET_BEARING = 0; // North-up 2D orientation
  const FLY_DURATION = 3800; // ms

  // DOM Elements
  const stageEl = document.getElementById('spaceLocationStage');
  const mapContainer = document.getElementById('spaceMap');
  const fallbackEl = document.getElementById('spaceFallback');
  const cloudCanvas = document.getElementById('cloudOverlay');
  const telemetryValueEl = document.getElementById('telemetryAltitude');
  const telemetryLabelEl = document.getElementById('telemetryStatus');
  const replayBtn = document.getElementById('mapReplayBtn');
  const copyBtn = document.getElementById('copyAddressBtn');
  const tokenBanner = document.getElementById('tokenBanner');
  const tokenInput = document.getElementById('tokenInput');
  const tokenSubmit = document.getElementById('tokenSubmit');

  if (!stageEl || !mapContainer || !cloudCanvas) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Retrieve active token
  function getActiveToken() {
    if (DEFAULT_MAPBOX_TOKEN && DEFAULT_MAPBOX_TOKEN.startsWith('pk.')) {
      return DEFAULT_MAPBOX_TOKEN.trim();
    }
    const saved = sessionStorage.getItem('elite_mapbox_token');
    if (saved && saved.startsWith('pk.')) return saved.trim();
    return '';
  }

  const activeToken = getActiveToken();

  // If token is missing, show helper banner
  if (!activeToken) {
    showTokenBanner();
  }

  function showTokenBanner() {
    if (tokenBanner) {
      tokenBanner.classList.add('is-active');
      if (tokenSubmit && tokenInput) {
        tokenSubmit.addEventListener('click', (e) => {
          e.preventDefault();
          const val = tokenInput.value.trim();
          if (val && val.startsWith('pk.')) {
            sessionStorage.setItem('elite_mapbox_token', val);
            tokenBanner.classList.remove('is-active');
            initExperience(val);
          }
        });
      }
    }
  }

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

  // --- Telemetry Altitude HUD ---
  function updateTelemetry(progress) {
    if (!telemetryValueEl || !telemetryLabelEl) return;

    if (progress <= 0.05) {
      telemetryLabelEl.textContent = 'Orbit';
      telemetryValueEl.textContent = '35.786 km';
    } else if (progress < 0.25) {
      telemetryLabelEl.textContent = 'Mesosphäre';
      const alt = Math.round(35786 - (progress / 0.25) * (35786 - 85));
      telemetryValueEl.textContent = `${alt.toLocaleString('de-DE')} km`;
    } else if (progress < 0.55) {
      telemetryLabelEl.textContent = 'Stratosphäre';
      const alt = Math.round(85 - ((progress - 0.25) / 0.3) * (85 - 12));
      telemetryValueEl.textContent = `${alt} km`;
    } else if (progress < 0.8) {
      telemetryLabelEl.textContent = 'Wolkendecke';
      const alt = Math.round(12000 - ((progress - 0.55) / 0.25) * (12000 - 900));
      telemetryValueEl.textContent = `${alt.toLocaleString('de-DE')} m`;
    } else {
      telemetryLabelEl.textContent = 'Anflug Weser';
      const alt = Math.round(900 - ((progress - 0.8) / 0.2) * 850);
      telemetryValueEl.textContent = `${Math.max(50, alt)} m`;
    }
  }

  // --- Mapbox State ---
  let map = null;
  let marker = null;
  let markerElement = null;
  let hasAnimatedOnce = false;
  let fallbackActive = false;

  // Check WebGL support
  function isWebGLSupported() {
    if (window.mapboxgl && typeof window.mapboxgl.supported === 'function') {
      return window.mapboxgl.supported({ failIfMajorPerformanceCaveat: false });
    }
    try {
      const c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl') || c.getContext('webgl2')));
    } catch (e) {
      return false;
    }
  }

  // Fallback Satellite Display (if WebGL is disabled or hardware-restricted)
  function activateSatelliteFallback() {
    if (fallbackActive) return;
    fallbackActive = true;
    console.info('Aktiviere HD-Satelliten-Modus für optimale Ansicht.');

    if (fallbackEl && activeToken) {
      const staticUrl = `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/8.75513,53.101985,17,0,0/1400x900@2x?access_token=${activeToken}`;
      fallbackEl.style.backgroundImage = `url("${staticUrl}")`;
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
    markerElement.style.top = '52%';
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
    updateTelemetry(1);
  }

  // Initialize Mapbox 3D Globe
  function initMapbox(token) {
    if (!window.mapboxgl) {
      setTimeout(() => initMapbox(token), 300);
      return;
    }

    if (!isWebGLSupported()) {
      activateSatelliteFallback();
      return;
    }

    try {
      window.mapboxgl.accessToken = token;

      map = new window.mapboxgl.Map({
        container: 'spaceMap',
        style: 'mapbox://styles/mapbox/satellite-streets-v12',
        center: TARGET_COORDS,
        zoom: START_ZOOM,
        pitch: START_PITCH,
        bearing: START_BEARING,
        projection: 'globe',
        attributionControl: false,
        interactive: true
      });

      map.on('style.load', () => {
        try {
          map.setFog({
            color: 'rgb(12, 14, 18)',
            'high-color': 'rgb(18, 22, 32)',
            'horizon-blend': 0.08,
            'space-color': 'rgb(7, 8, 12)',
            'star-intensity': 0.85
          });
        } catch (e) {
          console.warn('Fog setup skipped:', e);
        }
      });

      map.on('load', () => {
        map.resize();
        setupMarker();
        setupIntersectionObserver();
      });

      map.on('move', () => {
        const curZoom = map.getZoom();
        const p = Math.max(0, Math.min(1, (curZoom - START_ZOOM) / (TARGET_ZOOM - START_ZOOM)));
        updateTelemetry(p);
      });

      map.on('error', (e) => {
        console.warn('Mapbox runtime issue:', e);
        // If critical style load error, fallback gracefully
        if (e && e.error && e.error.status === 401) {
          showTokenBanner();
        }
      });

      window.addEventListener('resize', () => {
        if (map) map.resize();
      }, { passive: true });

    } catch (err) {
      console.warn('Mapbox initialization fallback triggered:', err);
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

    marker = new window.mapboxgl.Marker({
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
      updateTelemetry(1);
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
      updateTelemetry(1);
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

  // Replay Button listener
  if (replayBtn) {
    replayBtn.addEventListener('click', () => {
      if (fallbackActive) {
        startCloudAnimation();
        if (markerElement) {
          markerElement.classList.remove('is-visible');
          setTimeout(() => markerElement.classList.add('is-visible'), FLY_DURATION);
        }
        return;
      }

      if (!map) return;

      if (markerElement) {
        markerElement.classList.remove('is-visible');
      }

      map.flyTo({
        center: TARGET_COORDS,
        zoom: START_ZOOM,
        pitch: START_PITCH,
        bearing: START_BEARING,
        duration: 1500,
        essential: true
      });

      map.once('moveend', () => {
        setTimeout(() => {
          triggerCinematicFlyTo();
        }, 300);
      });
    });
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

  function initExperience(token) {
    initMapbox(token);
  }

  // Start initialization
  if (activeToken) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => initExperience(activeToken));
    } else {
      initExperience(activeToken);
    }
  }

})();
