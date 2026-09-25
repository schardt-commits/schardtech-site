/* ============================================================
   SCHARDTECH SITE — script.js
   v0.1
============================================================ */

// ============================================================
// DATA — Projetores (fonte: Planilha SchardTechOriginal.xlsx)
// ============================================================
const projectors = [];

// ============================================================
// DATA — Vídeos em destaque (fonte: YouTube API — canal SchardTech)
// ============================================================
const featuredVideos = [
  { id: "MSZw6b0yzww", title: "Menos de 1 Kg e 3 Horas de Bateria! Testei o novo Byintek MAGIC 1" },
  { id: "QnA2wgo5RBE", title: "3 PROJETORES POTENTES! TD98 Pro vs Q13W vs D10S — QUAL O MELHOR?" },
  { id: "5GGUt_qzUes", title: "QUAL O MELHOR? 10 PROJETORES EM UM COMPARATIVO! HY300, HY320 Mini, HY350, HY450 Max, HY450GT e X7" },
  { id: "T9210odfrlY", title: "TUDO que Você Precisa Saber Antes de Comprar o MAGCUBIC HY450GT!" },
  { id: "h_g2V0d6bn8", title: "Projetor Por Menos de 500 reais Análise Completa do Progaga PG370 MAX" },
  { id: "1Bw2KdmgWGM", title: "XGODY GIMBAL 7: Vale a Pena? Análise Completa Com Varios Testes!" },
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
  if (!header) return;
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
// NÚMERO DIGITADO EM PT-BR (quiz, calculadora ANSI, comparar)
// ============================================================
/* Texto -> Number, ou null quando não dá pra ler (vazio também volta null:
   quem chama separa "vazio" de "inválido" olhando o texto).
   Mesma regra do parseAlvoCentavos do prices-overlay.js (alerta de preço):
   - tira "R$" e espaços;
   - separador ÚNICO seguido de exatamente 3 dígitos é MILHAR: "1.500" e
     "1,500" = 1500, que é como se escreve mil e quinhentos em português;
   - ponto e vírgula juntos: o ÚLTIMO é o decimal ("1.299,90", "1,299.90");
   - fora isso, vírgula ou ponto é decimal ("2,5", "2.5", "129,78").
   Esses campos eram type=number + parseFloat: "1.500" virava 1,5 (o quiz
   dizia "Nenhum projetor") e o Firefox esvaziava "1.299,90", sumindo com o
   filtro sem aviso. opts.maxDecimais limita as casas (2 pra dinheiro). */
function parseNumeroBR(txt, opts) {
  const s = String(txt == null ? '' : txt).replace(/^\s*R\$?/i, '').replace(/[\s ]/g, '');
  if (!s || !/^[0-9.,]+$/.test(s)) return null;
  // milhar bem formado: 1 a 3 dígitos e depois grupos de exatamente 3
  const milharOk = (str, sep) => str.split(sep).every((g, i) => i === 0 ? /^[0-9]{1,3}$/.test(g) : /^[0-9]{3}$/.test(g));
  const p = s.lastIndexOf('.');
  const v = s.lastIndexOf(',');
  let inteiro = s;
  let frac = '';
  if (p !== -1 && v !== -1) {
    const d = Math.max(p, v);
    const mil = s.charAt(d) === ',' ? '.' : ',';
    inteiro = s.slice(0, d);
    frac = s.slice(d + 1);
    if (inteiro.indexOf(s.charAt(d)) !== -1 || !milharOk(inteiro, mil)) return null;
    inteiro = inteiro.split(mil).join('');
  } else if (p !== -1 || v !== -1) {
    const sep = p !== -1 ? '.' : ',';
    const partes = s.split(sep);
    if (partes.length > 2 || (partes[0] && partes[1].length === 3)) {
      if (!milharOk(s, sep)) return null;             // "1.500.000" sim, "1.50.0" não
      inteiro = partes.join('');
    } else {
      inteiro = partes[0];
      frac = partes[1];
    }
  }
  if (!inteiro && !frac) return null;
  if (opts && opts.maxDecimais != null && frac.length > opts.maxDecimais) return null;
  const n = Number((inteiro || '0') + (frac ? '.' + frac : ''));
  return isFinite(n) ? n : null;
}

// ============================================================
// CALCULADORA ANSI LUMENS
// ============================================================
/* Campos type=text + parseNumeroBR: "129,78" e "1.234,5" valem em qualquer
   navegador. Texto que não vira número avisa no resultado e marca o campo. */
function calcAnsiLumens() {
  const ids = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'ansiW', 'ansiH'];
  ids.forEach(id => document.getElementById(id)?.removeAttribute('aria-invalid'));
  const ler = (id) => {
    const el = document.getElementById(id);
    const txt = el ? el.value.trim() : '';
    return { el, txt, v: parseNumeroBR(txt) };
  };
  const erro = (c, msg) => { c.el?.setAttribute('aria-invalid', 'true'); showAnsiError(msg); };

  const vals = [];
  for (let i = 1; i <= 9; i++) {
    const c = ler(`p${i}`);
    if (c.txt && c.v === null) { erro(c, `Ponto ${i}: digite só o número, tipo 129,78.`); return; }
    const v = c.v;
    if (v === null || v < 0 || v > 10000 || !isFinite(v)) { erro(c, `Ponto ${i}: valor deve estar entre 0 e 10000.`); return; }
    vals.push(v);
  }
  const cw = ler('ansiW');
  const ch = ler('ansiH');
  if (cw.txt && cw.v === null) { erro(cw, 'Largura: digite só o número, tipo 2,50.'); return; }
  if (ch.txt && ch.v === null) { erro(ch, 'Altura: digite só o número, tipo 1,40.'); return; }
  const w = cw.v;
  const h = ch.v;
  if (!w || w <= 0) { erro(cw, 'Informe a largura da imagem.'); return; }
  if (!h || h <= 0) { erro(ch, 'Informe a altura da imagem.'); return; }

  const avg = vals.reduce((a, b) => a + b, 0) / 9;
  const result = Math.round(avg * w * h);

  const el = document.getElementById('ansiResult');
  el.innerHTML = `<span class="ansi-result-value">${result.toLocaleString('pt-BR')}</span><span class="ansi-result-unit">ANSI Lumens</span>`;
}

function showAnsiError(msg) {
  const el = document.getElementById('ansiResult');
  if (el) el.innerHTML = `<span class="ansi-result-error">${msg}</span>`;
}

function downloadAnsiGuide() {
  const svg = document.getElementById('ansiSvg');
  if (!svg) return;

  /* CSP não libera img-src blob:, então o SVG vai pro canvas como data: URI;
     o watermark externo precisa virar data: URI também, senão some do PNG
     (SVG carregado como imagem não busca recurso externo) */
  const clone = svg.cloneNode(true);
  const wm = clone.querySelector('image');

  const render = () => {
    const svgData = new XMLSerializer().serializeToString(clone);
    const svgUri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgData);
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      ctx.drawImage(img, 0, 0, 1920, 1080);
      const a = document.createElement('a');
      a.download = 'guia-medicao-ansi-lumens-schardtech.png';
      a.href = canvas.toDataURL('image/png');
      a.click();
    };
    img.onerror = () => {
      const a = document.createElement('a');
      a.download = 'guia-medicao-ansi-lumens-schardtech.svg';
      a.href = svgUri;
      a.click();
    };
    img.src = svgUri;
  };

  if (!wm) { render(); return; }
  fetch(wm.getAttribute('href'))
    .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.blob(); })
    .then(b => new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = reject;
      fr.readAsDataURL(b);
    }))
    .then(dataUrl => { wm.setAttribute('href', dataUrl); render(); })
    .catch(() => { wm.remove(); render(); });
}

// ============================================================
// BARRA DE QUEDAS (D-1 vs D) — topo do body, estilo CoinGecko
// ============================================================
function initBarraQuedas() {
  if (document.getElementById('barra-quedas')) return;
  const bp = window.SITE_BASE_PATH || (/\/(projetor|acessorios)\//i.test(location.pathname) ? '../' : '');
  fetch(bp + 'data/quedas-dia.json', { cache: 'no-store' })
    .then(r => r.ok ? r.json() : null)
    .then(j => {
      if (!j || !Array.isArray(j.quedas) || !j.quedas.length) return;
      _bqInjectStyles();
      _bqInjectBar(j, bp);
    })
    .catch(() => {});
}
function _bqInjectStyles() {
  if (document.getElementById('barra-quedas-css')) return;
  const s = document.createElement('style');
  s.id = 'barra-quedas-css';
  s.textContent = `
    #header .barra-quedas{margin:-18px 0 10px;background:rgba(11,11,11,0.92);backdrop-filter:blur(20px) saturate(1.5);color:#e6e6e6;font-size:12.5px;line-height:1;border-bottom:1px solid var(--border,#1f2937);font-family:inherit;display:flex;justify-content:center}
    #header.scrolled .barra-quedas{margin-top:-12px}
    .barra-quedas__inner{display:flex;align-items:center;gap:14px;padding:8px 20px;overflow-x:auto;white-space:nowrap;scrollbar-width:none;-webkit-overflow-scrolling:touch;max-width:100%}
    .barra-quedas__inner::-webkit-scrollbar{display:none;height:0}
    .barra-quedas__label{font-weight:600;color:#94a3b8;flex-shrink:0;letter-spacing:.01em}
    .barra-quedas__label--link{text-decoration:none;cursor:pointer;transition:color .15s}
    .barra-quedas__label--link:hover{color:var(--primary,#7dd3fc);text-decoration:underline}
    .barra-quedas__item{color:#e6e6e6;text-decoration:none;transition:color .15s;flex-shrink:0;display:inline-flex;align-items:center;gap:8px;cursor:pointer}
    .barra-quedas__item:hover{color:#fff}
    .barra-quedas__item:hover .barra-quedas__modelo{color:var(--primary,#7dd3fc)}
    .barra-quedas__modelo{font-weight:600;transition:color .15s}
    .barra-quedas__pct{color:#22c55e;font-weight:600}
    .barra-quedas__sep{color:#334155;flex-shrink:0;user-select:none}
    @media (max-width:600px){
      #header .barra-quedas{margin:-18px 0 8px}
      .barra-quedas__inner{padding:7px 14px;gap:10px;font-size:12px;justify-content:flex-start}
      .barra-quedas__label{font-size:11.5px}
    }
  `;
  document.head.appendChild(s);
}
function _bqInjectBar(j, bp) {
  const wrap = document.createElement('div');
  wrap.id = 'barra-quedas';
  wrap.className = 'barra-quedas';
  const inner = document.createElement('div');
  inner.className = 'barra-quedas__inner';
  const labelData = (j.data_ontem && j.data_hoje)
    ? j.data_ontem + ' → ' + j.data_hoje + (j.hora_coleta ? ' ' + j.hora_coleta : '')
    : j.data_coleta + (j.hora_coleta ? ' ' + j.hora_coleta : '');
  const label = document.createElement('a');
  label.className = 'barra-quedas__label barra-quedas__label--link';
  label.href = bp + 'precos.html';
  label.title = 'Ver preços ao vivo de todos os projetores';
  label.textContent = '📉 Quedas ' + labelData + ':';
  inner.appendChild(label);
  j.quedas.forEach((q, i) => {
    if (i > 0) {
      const sep = document.createElement('span');
      sep.className = 'barra-quedas__sep';
      sep.textContent = '·';
      inner.appendChild(sep);
    }
    const a = document.createElement('a');
    a.className = 'barra-quedas__item';
    a.href = bp + 'projetor/' + q.slug + '.html';
    const modelo = document.createElement('span');
    modelo.className = 'barra-quedas__modelo';
    modelo.textContent = q.marca + ' ' + q.modelo;
    const pct = document.createElement('span');
    pct.className = 'barra-quedas__pct';
    pct.textContent = '▼ ' + Math.abs(q.delta_pct).toFixed(1) + '%';
    a.appendChild(modelo);
    a.appendChild(pct);
    inner.appendChild(a);
  });
  wrap.appendChild(inner);
  const header = document.getElementById('header');
  if (header) {
    header.insertBefore(wrap, header.firstChild);
  } else {
    document.body.insertBefore(wrap, document.body.firstChild);
  }
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
  initBarraQuedas();
  document.getElementById('calcAnsiBtn')?.addEventListener('click', calcAnsiLumens);
  document.getElementById('downloadAnsiBtn')?.addEventListener('click', downloadAnsiGuide);
});
