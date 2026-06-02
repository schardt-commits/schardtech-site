/* ============================================================
   precos.js — "Preços ao Vivo" (tabela estilo CoinGecko)
   ------------------------------------------------------------
   Lista todos os projetores disponíveis numa tabela ordenável.
   Colunas de variação clicáveis → reordenam por quem caiu mais
   (ou subiu mais) na janela. Link afiliado + cupom na lateral.

   100% front-end. Consome dados que o pipeline diário JÁ gera:
     - PROJETORES_DATA + prices.json  (via prices-overlay.js)
     - data/prices-history.json       (histórico p/ variação+sparkline)

   ⚙️  JANELAS: editar APENAS o array WINDOWS abaixo controla TUDO
       (botões, cabeçalhos da tabela, chips do mobile e o cálculo).
       Hoje a 3ª janela é 20 dias porque o histórico ainda não tem
       30 dias completos. Quando passar de 30 dias (a partir de
       ~06/06/2026), troque 20 por 30 e adicione '30d' em WIN_LABEL.
   ============================================================ */
(function () {
  'use strict';

  // ⚙️ ÚNICO lugar pra mexer nas janelas (em dias). A 1ª é o sort padrão.
  var WINDOWS = [1, 7, 20];
  var WIN_LABEL = { 1: '24h', 7: '7d', 20: '20d', 30: '30d' };

  // ---------- helpers de escape/format ----------
  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function safeUrl(u) {
    if (!u) return '';
    var t = String(u).trim();
    return /^https?:\/\//i.test(t) ? t : '';
  }
  function norm(s) { return String(s || '').trim().toLowerCase(); }
  function winLabel(n) { return WIN_LABEL[n] || (n + 'd'); }
  function fmtBRL(v) {
    if (v == null || isNaN(v)) return '—';
    return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmtPct(p) {
    return Math.abs(p).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
  }

  // Thumb do projetor = capa do vídeo do YouTube (não há foto local).
  function ytId(url) {
    if (!url) return '';
    var m = String(url).match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : '';
  }
  function thumbUrl(url) {
    var id = ytId(url);
    return id ? 'https://img.youtube.com/vi/' + id + '/mqdefault.jpg' : '';
  }

  var MK_LABEL = {
    aliexpress: 'AliExpress',
    shopee: 'Shopee',
    mercado_livre: 'Mercado Livre',
    ml: 'Mercado Livre',
    amazon: 'Amazon'
  };

  // ---------- variação a partir do histórico ----------
  // Mínimo de preço por dia: 'YYYY-MM-DD' -> menor preco do dia.
  function porDiaMins(pontos) {
    var m = {};
    for (var i = 0; i < pontos.length; i++) {
      var d = String(pontos[i].data).slice(0, 10);
      var p = pontos[i].preco;
      if (p == null) continue;
      if (m[d] == null || p < m[d]) m[d] = p;
    }
    return m;
  }
  function dateMinusDays(n) {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - n);
    var y = d.getFullYear();
    var mo = ('0' + (d.getMonth() + 1)).slice(-2);
    var da = ('0' + d.getDate()).slice(-2);
    return y + '-' + mo + '-' + da;
  }
  // pct = (atual − preço de N dias atrás) / preço de N dias atrás * 100.
  // "preço de N dias atrás" = mínimo diário mais recente com data <= hoje−N.
  // Sem nenhum ponto nessa janela (histórico não cobre) → null → célula "—".
  function varNd(porDia, datasAsc, atual, n) {
    if (atual == null) return null;
    var target = dateMinusDays(n);
    var ref = null;
    for (var i = datasAsc.length - 1; i >= 0; i--) {
      if (datasAsc[i] <= target) { ref = porDia[datasAsc[i]]; break; }
    }
    if (ref == null || ref === 0) return null;
    return ((atual - ref) / ref) * 100;
  }

  // ---------- sparkline (SVG inline, mesmo estilo de qual-projetor) ----------
  function sparkSvg(pontos) {
    if (!pontos || pontos.length < 2) return '';
    var lim = dateMinusDays(7);
    var janela = pontos.filter(function (p) { return String(p.data).slice(0, 10) >= lim; });
    if (janela.length < 2) janela = pontos;
    var precos = janela.map(function (p) { return p.preco; });
    var min = Math.min.apply(null, precos), max = Math.max.apply(null, precos);
    var w = 88, h = 24, pad = 2, range = (max - min) || 1;
    var coords = janela.map(function (p, i) {
      var x = (i / (janela.length - 1 || 1)) * (w - pad * 2) + pad;
      var y = h - pad - ((p.preco - min) / range) * (h - pad * 2);
      return x.toFixed(1) + ',' + y.toFixed(1);
    });
    var last = coords[coords.length - 1].split(',');
    var stroke = precos[precos.length - 1] <= precos[0] ? 'rgba(91,217,160,0.75)' : 'rgba(255,155,122,0.75)';
    return '<svg class="pt-spark" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true">' +
      '<polyline points="' + coords.join(' ') + '" fill="none" stroke="' + stroke + '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<circle cx="' + last[0] + '" cy="' + last[1] + '" r="2.4" fill="' + stroke + '"/></svg>';
  }

  // ---------- montagem das linhas ----------
  function buildRows() {
    var data = window.PROJETORES_DATA || [];
    var hist = (window.PRICES_HISTORY && window.PRICES_HISTORY.modelos) || {};
    var histIdx = {};
    for (var k in hist) { if (hist.hasOwnProperty(k)) histIdx[norm(k)] = hist[k]; }

    var rows = [];
    for (var i = 0; i < data.length; i++) {
      var proj = data[i];
      if (proj.preco_atual == null) continue; // indisponível / zerado pelo overlay
      var key = norm(proj.marca) + '|' + norm(proj.modelo);
      var h = histIdx[key] || null;

      var v = {}, spark = '';
      WINDOWS.forEach(function (n) { v[n] = null; });
      if (h && h.pontos && h.pontos.length) {
        var porDia = porDiaMins(h.pontos);
        var datasAsc = Object.keys(porDia).sort();
        // Base = menor preço do dia mais recente (mesma fonte dos dois lados →
        // apples-to-apples, igual à barra de quedas). Fallback se faltar dia.
        var atual = datasAsc.length ? porDia[datasAsc[datasAsc.length - 1]]
                  : ((h.atual != null) ? h.atual : proj.preco_atual);
        WINDOWS.forEach(function (n) { v[n] = varNd(porDia, datasAsc, atual, n); });
        spark = sparkSvg(h.pontos);
      }

      var venc = proj.marketplace_vencedor || '';
      var mk = (proj.marketplaces || {})[venc] || {};
      var offerLink = safeUrl(mk.link);
      var offerLabel = MK_LABEL[venc] || 'loja';
      var cupomLoja = (venc === 'aliexpress' && mk.cupom) ? String(mk.cupom).trim() : '';
      var cupomPlat = (venc === 'aliexpress' && mk.cupom_plataforma) ? String(mk.cupom_plataforma).trim() : '';

      rows.push({
        nome: (proj.marca + ' ' + proj.modelo).trim(),
        marca: proj.marca,
        buscaKey: norm(proj.marca + ' ' + proj.modelo),
        slug: proj.slug || '',
        thumb: thumbUrl(proj.video_url),
        preco: proj.preco_atual,
        v: v, spark: spark,
        offerLink: offerLink, offerLabel: offerLabel,
        cupomLoja: cupomLoja, cupomPlat: cupomPlat
      });
    }
    return rows;
  }

  // ---------- render de pedaços ----------
  function varCell(p) {
    if (p == null) return '<span class="pt-var pt-na">—</span>';
    if (p > -0.05 && p < 0.05) return '<span class="pt-var pt-flat">0,0%</span>';
    var cls = p < 0 ? 'pt-down' : 'pt-up';
    var arrow = p < 0 ? '▼' : '▲';
    return '<span class="pt-var ' + cls + '">' + arrow + ' ' + fmtPct(p) + '</span>';
  }
  function nameCell(r) {
    var img = r.thumb
      ? '<img class="pt-thumb" src="' + escHtml(r.thumb) + '" alt="" loading="lazy" width="64" height="36">'
      : '<span class="pt-thumb pt-thumb-ph">' + escHtml((r.marca || '?').slice(0, 1)) + '</span>';
    var inner = img + '<span class="pt-name-txt">' + escHtml(r.nome) + '</span>';
    if (r.slug) return '<a class="pt-name" href="projetor/' + escHtml(r.slug) + '.html">' + inner + '</a>';
    return '<span class="pt-name">' + inner + '</span>';
  }
  function offerCell(r) {
    var html = '';
    if (r.offerLink) {
      html += '<a class="pt-offer-btn" href="' + escHtml(r.offerLink) + '" target="_blank" rel="noopener sponsored">Ver no ' + escHtml(r.offerLabel) + ' ↗</a>';
    } else {
      html += '<span class="pt-offer-btn pt-offer-off">Ver na loja</span>';
    }
    if (r.cupomLoja || r.cupomPlat) {
      html += '<div class="pt-coupons">';
      if (r.cupomLoja) html += '<span class="pt-coupon" title="Cupom da loja">🎟 ' + escHtml(r.cupomLoja) + '</span>';
      if (r.cupomPlat) html += '<span class="pt-coupon pt-coupon-plat" title="Cupom da plataforma AliExpress">+ ' + escHtml(r.cupomPlat) + '</span>';
      html += '</div>';
    }
    return html;
  }

  function renderTable(rows, win) {
    var out = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var vcols = WINDOWS.map(function (n) {
        return '<td class="pt-c-var' + (win === n ? ' pt-active' : '') + '">' + varCell(r.v[n]) + '</td>';
      }).join('');
      out.push(
        '<tr>' +
        '<td class="pt-rank">' + (i + 1) + '</td>' +
        '<td class="pt-c-name">' + nameCell(r) + '</td>' +
        '<td class="pt-c-price">' + fmtBRL(r.preco) + '</td>' +
        vcols +
        '<td class="pt-c-spark">' + (r.spark || '<span class="pt-na">—</span>') + '</td>' +
        '<td class="pt-c-offer">' + offerCell(r) + '</td>' +
        '</tr>'
      );
    }
    return out.join('');
  }

  function renderCards(rows, win) {
    var out = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var chips = WINDOWS.map(function (n) {
        return '<div class="pt-chip' + (win === n ? ' pt-active' : '') + '">' +
          '<span class="pt-chip-lbl">' + winLabel(n) + '</span>' + varCell(r.v[n]) + '</div>';
      }).join('');
      out.push(
        '<div class="pt-card">' +
        '<div class="pt-card-top">' +
        '<div class="pt-card-rank">' + (i + 1) + '</div>' +
        nameCell(r) +
        '</div>' +
        '<div class="pt-card-mid">' +
        '<div class="pt-card-price">' + fmtBRL(r.preco) + '</div>' +
        (r.spark || '') +
        '</div>' +
        '<div class="pt-chips">' + chips + '</div>' +
        '<div class="pt-card-offer">' + offerCell(r) + '</div>' +
        '</div>'
      );
    }
    return out.join('');
  }

  // ---------- cabeçalhos gerados a partir de WINDOWS ----------
  function buildHeader() {
    // Segmented control
    var seg = document.getElementById('ptSeg');
    if (seg) {
      seg.innerHTML = WINDOWS.map(function (n, i) {
        return '<button type="button" data-win="' + n + '" aria-pressed="' + (i === 0 ? 'true' : 'false') + '">' +
          winLabel(n) + '<span class="pt-sort-ind"></span></button>';
      }).join('');
    }
    // Cabeçalho da tabela (desktop)
    var head = document.getElementById('ptHead');
    if (head) {
      var vth = WINDOWS.map(function (n, i) {
        return '<th class="pt-th-var" data-win="' + n + '" tabindex="0" role="button" aria-pressed="' + (i === 0 ? 'true' : 'false') + '">' +
          winLabel(n) + '<span class="pt-sort-ind"></span></th>';
      }).join('');
      head.innerHTML = '<tr>' +
        '<th class="pt-th-num">#</th>' +
        '<th>Projetor</th>' +
        '<th>Preço</th>' +
        vth +
        '<th>Últimos 7 dias</th>' +
        '<th class="pt-th-var">Oferta</th>' +
        '</tr>';
    }
  }

  // ---------- estado + ordenação ----------
  var ALL = [];
  var state = { win: WINDOWS[0], dir: 'queda', q: '' }; // dir: 'queda' = maior queda primeiro

  function applyView() {
    var rows = state.q ? ALL.filter(function (r) { return r.buscaKey.indexOf(state.q) !== -1; }) : ALL.slice();
    var win = state.win, dir = state.dir;
    rows.sort(function (a, b) {
      var pa = a.v[win], pb = b.v[win];
      var na = (pa == null), nb = (pb == null);
      if (na && nb) return a.buscaKey < b.buscaKey ? -1 : 1;
      if (na) return 1;   // "—" sempre no fim
      if (nb) return -1;
      if (pa === pb) return a.buscaKey < b.buscaKey ? -1 : 1;
      return dir === 'queda' ? (pa - pb) : (pb - pa);
    });

    var tbody = document.getElementById('ptBody');
    var cards = document.getElementById('ptCards');
    if (tbody) tbody.innerHTML = renderTable(rows, win);
    if (cards) cards.innerHTML = renderCards(rows, win);

    var count = document.getElementById('ptCount');
    if (count) count.textContent = rows.length + ' projetores';

    syncControls();
  }

  function syncControls() {
    var arrow = state.dir === 'queda' ? '▼' : '▲';
    document.querySelectorAll('[data-win]').forEach(function (el) {
      var w = parseInt(el.getAttribute('data-win'), 10);
      var active = (w === state.win);
      el.classList.toggle('pt-active', active);
      el.setAttribute('aria-pressed', active ? 'true' : 'false');
      var ind = el.querySelector('.pt-sort-ind');
      if (ind) ind.textContent = active ? (' ' + arrow) : '';
    });
  }

  function onWinClick(w) {
    if (w === state.win) {
      state.dir = (state.dir === 'queda') ? 'alta' : 'queda'; // 2º clique inverte
    } else {
      state.win = w;
      state.dir = 'queda'; // nova janela começa por maior queda
    }
    applyView();
  }

  function bindControls() {
    document.querySelectorAll('[data-win]').forEach(function (el) {
      var w = parseInt(el.getAttribute('data-win'), 10);
      el.addEventListener('click', function () { onWinClick(w); });
      // <button> nativo já dispara click no Enter/Espaço; só os <th> (role=button)
      // precisam do handler de teclado — senão o botão do segmented dispara 2x.
      if (el.tagName !== 'BUTTON') {
        el.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onWinClick(w); }
        });
      }
    });
    var search = document.getElementById('ptSearch');
    if (search) {
      search.addEventListener('input', function () { state.q = norm(this.value); applyView(); });
    }
  }

  // ---------- boot ----------
  function setMeta() {
    var el = document.getElementById('ptUpdated');
    if (!el) return;
    var m = window.PRICES_METADATA || {};
    if (m.atualizado_em) {
      var dt = String(m.atualizado_em);
      el.textContent = 'Atualizado em ' + dt.slice(8, 10) + '/' + dt.slice(5, 7) + ' às ' + dt.slice(11, 16);
    }
  }

  function boot() {
    buildHeader();
    bindControls();
    var overlay = window.PRICES_OVERLAY_READY || Promise.resolve();
    var bp = (window.SITE_BASE_PATH || '');
    var histFetch = fetch(bp + 'data/prices-history.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { window.PRICES_HISTORY = j; })
      .catch(function () { window.PRICES_HISTORY = null; });

    Promise.all([overlay, histFetch]).then(function () {
      ALL = buildRows();
      setMeta();
      applyView();
      var loading = document.getElementById('ptLoading');
      if (loading) loading.style.display = 'none';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
