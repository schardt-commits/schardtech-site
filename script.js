/* ============================================================
   SCHARDTECH SITE — script.js
   v0.1
============================================================ */

// ============================================================
// DATA — Projetores (fonte: Planilha SchardTechOriginal.xlsx)
// ============================================================
const projectors = [
  {
    id: 'voxflix-vf71',
    name: 'Voxflix VF71',
    price: 850,
    resolution: '1080p',
    lumens: 580,
    inputLag: 40,
    support4k: false,
    sealedOptics: false,
    battery: false,
    batteryMah: null,
    audio: '5W',
    system: 'Android',
    type: 'LED/LCD',
    mlLink: 'https://www.mercadolivre.com.br/projetor-voxflix-vf71/up/MLBU3897198654?pdp_filters=item_id:MLB6594040884',
    videoId: '1soF7qRHsCo',
    available: true,
    image: 'https://http2.mlstatic.com/D_NQ_NP_2X_920630-MLB104799973149_012026-F.webp'
  },
  {
    id: 'wanbo-vali-1',
    name: 'Wanbo Vali 1',
    price: 1500,
    resolution: '1080p',
    lumens: 500,
    inputLag: 50,
    support4k: false,
    sealedOptics: true,
    battery: false,
    batteryMah: null,
    audio: '2x6W',
    system: 'Android TV',
    type: 'LED/LCD',
    mlLink: 'https://www.mercadolivre.com.br/projetor-wanbo-vali-1-android-tv/up/MLBU3897190056?pdp_filters=item_id:MLB6594052510',
    videoId: 'L_0ajiDrnUI',
    available: true,
    image: 'https://http2.mlstatic.com/D_NQ_NP_2X_788810-MLB96055877561_102025-F.webp'
  }
];

// ============================================================
// DATA — Vídeos em destaque (fonte: YouTube API — canal SchardTech)
// ============================================================
const featuredVideos = [
  { id: '0ihG8QKEioQ', title: 'BRILHO ABSURDO! Testei o A24 Max Novo projetor da Vevshao' },
  { id: 'PGbi8fr7aS4', title: 'Esse projetor esconde algo: Everycom HQ9W Ultra | Análise completa' },
  { id: 's7gfCpdJCVw', title: 'Tela 100&quot; Portátil Byintek: DÁ PARA VER DOS DOIS LADOS?' },
  { id: 'y40NWkwjuYg', title: 'Qual Melhor Projetor Custo Beneficio!' },
  { id: 'Fh47l1L81Po', title: 'Nunca Mais Erre na Escolha! O Jeito Mais Fácil de Achar seu Projetor!' },
  { id: 'S8yGCgKlGyY', title: 'Projetor Full HD por menos de R$450 — Vale a Pena? L9W Ultra Touyinger' },
];

// ============================================================
// SVG — Ícone de projetor para placeholder
// ============================================================
function projectorIcon() {
  return `<svg width="80" height="64" viewBox="0 0 80 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="8" y="16" width="48" height="32" rx="6" stroke="#4FA3C7" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="24" cy="32" r="9" stroke="#4FA3C7" stroke-width="2.2"/>
    <circle cx="24" cy="32" r="3.5" fill="#4FA3C7" opacity="0.35"/>
    <rect x="58" y="22" width="14" height="4" rx="2" fill="#4FA3C7" opacity="0.4"/>
    <rect x="58" y="30" width="14" height="4" rx="2" fill="#4FA3C7" opacity="0.28"/>
    <rect x="58" y="38" width="10" height="4" rx="2" fill="#4FA3C7" opacity="0.18"/>
    <path d="M8 37L1 48" stroke="#4FA3C7" stroke-width="1.5" stroke-linecap="round" opacity="0.25"/>
    <path d="M8 28L1 17" stroke="#4FA3C7" stroke-width="1.5" stroke-linecap="round" opacity="0.25"/>
    <circle cx="56" cy="26" r="2" fill="#4FA3C7" opacity="0.5"/>
  </svg>`;
}

// ============================================================
// RENDER — Cards de projetores
// ============================================================
function renderProjectors(data) {
  const grid = document.getElementById('projectorGrid');
  if (!grid) return;

  grid.innerHTML = data.map((p, i) => {
    const lagCls = p.inputLag <= 25 ? 'tag-lag-elite'
                 : p.inputLag <= 50 ? 'tag-lag-good'
                 : p.inputLag <= 90 ? 'tag-lag-casual'
                 : 'tag-lag-slow';
    const lagTip = p.inputLag <= 25 ? 'Ótimo para games'
                 : p.inputLag <= 50 ? 'Bom para games'
                 : p.inputLag <= 90 ? 'Adequado para jogos casuais'
                 : 'Input lag alto — não recomendado para games';

    const homologado = ['Google TV', 'Android TV', 'WhaleOS'].includes(p.system);
    const sysCls = homologado ? 'tag-highlight' : 'tag-android-nh';
    const sysTip = p.system === 'Google TV' ? 'Sistema homologado pelo Google'
                 : p.system === 'Android TV' ? 'Sistema homologado pelo Google'
                 : p.system === 'WhaleOS' ? 'Sistema certificado — suporte a Widevine L1 (Netflix, Prime e outros em HD)'
                 : 'Android não homologado';

    const specs = [
      { label: p.resolution,               cls: '',           tip: 'Resolução nativa 1080p' },
      { label: `${p.lumens} ANSI`,          cls: '',           tip: `${p.lumens} ANSI Lumens medidos pelo canal` },
      { label: `Input Lag ${p.inputLag}ms`, cls: lagCls,       tip: lagTip },
      { label: p.type,                      cls: 'tag-type',   tip: p.type === 'DLP/4LED' ? 'Tecnologia DLP com 4 LEDs — cores mais precisas e contrastes maiores' : 'Tecnologia LED/LCD' },
      { label: p.system,                    cls: sysCls,       tip: sysTip },
      { label: p.audio,                     cls: 'tag-audio',  tip: `Potência sonora: ${p.audio}` },
      p.sealedOptics ? { label: 'Ótica Selada', cls: 'tag-sealed', tip: 'Ótica selada conforme o fabricante — não verificado independentemente' } : null,
      p.support4k    ? { label: 'Suporte 4K',   cls: 'tag-4k',     tip: 'Suporte a 4K 60Hz com HDR+ — resolução nativa é 1080p' } : null,
      p.battery      ? { label: `Bateria ${p.batteryMah.toLocaleString('pt-BR')}mAh`, cls: 'tag-battery', tip: `Bateria interna de ${p.batteryMah.toLocaleString('pt-BR')}mAh` } : null,
    ].filter(Boolean);

    const imageHTML = p.image
      ? `<img src="${p.image}" alt="${p.name}" loading="lazy">`
      : `<div class="card-img-placeholder">${projectorIcon()}</div>`;

    const priceHTML = p.available
      ? `<div class="card-price-row">
           <span class="card-price-currency">R$</span>
           <span class="card-price">${p.price.toLocaleString('pt-BR')}</span>
         </div>`
      : `<div class="card-price-sold">Projetor Vendido</div>`;

    const mlBtn = (p.available && p.mlLink)
      ? `<a href="${p.mlLink}" target="_blank" rel="noopener noreferrer" class="card-btn card-btn-ml">
           <img src="./logo ml2.png" alt="Mercado Livre" class="ml-logo-btn">
           Comprar
         </a>`
      : '';

    const reviewBtnClass = (p.available && p.mlLink) ? 'card-btn card-btn-review' : 'card-btn card-btn-review-full';
    const reviewBtn = `<a href="https://www.youtube.com/watch?v=${p.videoId}" target="_blank" rel="noopener noreferrer" class="${reviewBtnClass}">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 6.82v10.36c0 .79.87 1.27 1.54.84l8.14-5.18c.62-.39.62-1.29 0-1.69L9.54 5.98C8.87 5.55 8 6.03 8 6.82z"/></svg>
      Ver Review
    </a>`;

    const k4Badge = p.support4k ? `<span class="card-4k-badge">4K</span>` : '';

    return `
      <div class="projector-card fade-in" data-id="${p.id}" style="transition-delay: ${i * 60}ms">
        <div class="card-image">
          ${imageHTML}
          ${k4Badge}
          <span class="card-status-badge ${p.available ? 'badge-available' : 'badge-sold'}">
            ${p.available ? 'Disponível' : 'Vendido'}
          </span>
        </div>
        <div class="card-body">
          <h3 class="card-name">${p.name}</h3>
          <div class="card-specs">
            ${specs.map(s => `<span class="spec-tag ${s.cls}"${s.tip ? ` data-tooltip="${s.tip.replace(/"/g, '&quot;')}"` : ''}>${s.label}</span>`).join('')}
          </div>
          ${priceHTML}
          <div class="card-actions">${mlBtn}${reviewBtn}</div>
        </div>
      </div>
    `;
  }).join('');

  observeFadeIn();
}

// ============================================================
// RENDER — Cards de vídeos
// ============================================================
function renderVideos(data) {
  const grid = document.getElementById('videosGrid');
  if (!grid) return;

  grid.innerHTML = data.map((v, i) => `
    <a href="https://www.youtube.com/watch?v=${v.id}" target="_blank" rel="noopener noreferrer"
       class="video-card fade-in" style="transition-delay: ${i * 80}ms">
      <div class="video-thumb">
        <img src="https://img.youtube.com/vi/${v.id}/hqdefault.jpg" alt="${v.title}" loading="lazy">
        <div class="video-play-btn">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="white"><path d="M8 6.82v10.36c0 .79.87 1.27 1.54.84l8.14-5.18c.62-.39.62-1.29 0-1.69L9.54 5.98C8.87 5.55 8 6.03 8 6.82z"/></svg>
        </div>
      </div>
      <div class="video-meta">
        <p>${v.title}</p>
      </div>
    </a>
  `).join('');

  observeFadeIn();
}

// ============================================================
// ANIMAÇÃO — Fade-in ao scroll
// ============================================================
function observeFadeIn() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.06, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.fade-in:not(.visible)').forEach(el => observer.observe(el));
}

// ============================================================
// ANIMAÇÃO — Contador numérico na seção de autoridade
// ============================================================
function initCounters() {
  const els = document.querySelectorAll('.authority-number[data-count]');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = parseInt(el.dataset.count, 10);
      const duration = 1400;
      const start = performance.now();
      const tick = (now) => {
        const t = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = Math.round(eased * target);
        if (t < 1) requestAnimationFrame(tick);
        else el.textContent = target;
      };
      requestAnimationFrame(tick);
      observer.unobserve(el);
    });
  }, { threshold: 0.5 });
  els.forEach(el => observer.observe(el));
}

// ============================================================
// HEADER — Efeito de scroll
// ============================================================
function initHeader() {
  const header = document.getElementById('header');
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 36);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

// ============================================================
// MENU MOBILE
// ============================================================
function initMobileMenu() {
  const btn = document.getElementById('mobileMenuBtn');
  const nav = document.getElementById('mainNav');
  if (!btn || !nav) return;

  btn.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    btn.classList.toggle('active', open);
    btn.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('menu-open', open);
  });

  nav.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      nav.classList.remove('open');
      btn.classList.remove('active');
      btn.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('menu-open');
    });
  });
}

// ============================================================
// CALCULADORA ANSI LUMENS
// ============================================================
function calcAnsiLumens() {
  const vals = [];
  for (let i = 1; i <= 9; i++) {
    const v = parseFloat(document.getElementById(`p${i}`)?.value);
    if (isNaN(v) || v < 0 || v > 10000 || !isFinite(v)) { showAnsiError(`Ponto ${i}: valor deve estar entre 0 e 10000.`); return; }
    vals.push(v);
  }
  const w = parseFloat(document.getElementById('ansiW')?.value);
  const h = parseFloat(document.getElementById('ansiH')?.value);
  if (!w || w <= 0) { showAnsiError('Informe a largura da imagem.'); return; }
  if (!h || h <= 0) { showAnsiError('Informe a altura da imagem.'); return; }

  const avg = vals.reduce((a, b) => a + b, 0) / 9;
  const result = Math.round(avg * w * h);

  const el = document.getElementById('ansiResult');
  el.innerHTML = `<span class="ansi-result-value">${result.toLocaleString('pt-BR')}</span><span class="ansi-result-unit">ANSI Lumens</span>`;
}

function showAnsiError(msg) {
  const el = document.getElementById('ansiResult');
  if (el) el.innerHTML = `<span class="ansi-result-error">⚠ ${msg}</span>`;
}

function downloadAnsiGuide() {
  const svg = document.getElementById('ansiSvg');
  if (!svg) return;

  const svgData = new XMLSerializer().serializeToString(svg);
  const canvas = document.createElement('canvas');
  canvas.width = 1920;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d');
  const img = new Image();
  const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  img.onload = () => {
    ctx.drawImage(img, 0, 0, 1920, 1080);
    URL.revokeObjectURL(url);
    const a = document.createElement('a');
    a.download = 'guia-medicao-ansi-lumens-schardtech.png';
    a.href = canvas.toDataURL('image/png');
    a.click();
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    const a = document.createElement('a');
    a.download = 'guia-medicao-ansi-lumens-schardtech.svg';
    a.href = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgData);
    a.click();
  };
  img.src = url;
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  renderProjectors(projectors);
  renderVideos(featuredVideos);
  initHeader();
  initMobileMenu();
  initCounters();
  observeFadeIn();
  document.getElementById('calcAnsiBtn')?.addEventListener('click', calcAnsiLumens);
  document.getElementById('downloadAnsiBtn')?.addEventListener('click', downloadAnsiGuide);
});
