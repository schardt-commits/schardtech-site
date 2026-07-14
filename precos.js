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
       20d virou 30d em 14/07/2026 (Fase E) — o histórico passou de
       30 dias completos. Espelhar mudança no prerender_precos.py.

   Fase E (14/07/2026, junto com o chrome v2 do precos.html):
     - sparkline novo: menor preço POR DIA (sem o zigue-zague das
       4 checagens/dia), janela 30d, curva suave, gradiente, cores
       v2; série estável centralizada (antes colava no rodapé)
     - FLIP no re-sort: trocar janela DESLIZA as linhas (data-k)
     - cascata de entrada (body.pt-anim + .pt-in; busca digitada
       não re-anima; prefers-reduced-motion respeitado)
     - estado vazio da busca
   ============================================================ */
(function () {
  'use strict';

  // ⚙️ ÚNICO lugar pra mexer nas janelas (em dias). A 1ª é o sort padrão.
  var WINDOWS = [1, 7, 30];
  var WIN_LABEL = { 1: '24h', 7: '7d', 20: '20d', 30: '30d' };

  var MOTION_OK = !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

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
  // Soma/subtrai dias de uma data 'YYYY-MM-DD' e devolve string ISO.
  function addDaysStr(dateStr, delta) {
    var p = String(dateStr).split('-');
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    d.setDate(d.getDate() + delta);
    var y = d.getFullYear(), mo = ('0' + (d.getMonth() + 1)).slice(-2), da = ('0' + d.getDate()).slice(-2);
    return y + '-' + mo + '-' + da;
  }

  // Variação = (menor preço do dia mais recente − MÉDIA dos menores preços
  // diários dos N dias ANTERIORES) ÷ essa média × 100.
  // Cada "menor do dia" (porDia) já é o mais barato entre TODAS as plataformas
  // (Ali/Shopee/ML) naquele dia. Pra N=1 a média de 1 dia = ontem → "hoje vs ontem".
  // Sem nenhum dia na janela (produto novo demais) → null → célula "—".
  function varNd(porDia, datasAsc, n) {
    if (!datasAsc.length) return null;
    var latest = datasAsc[datasAsc.length - 1];
    var hoje = porDia[latest];
    if (hoje == null) return null;
    var lo = addDaysStr(latest, -n);
    var soma = 0, cont = 0;
    for (var i = 0; i < datasAsc.length; i++) {
      var d = datasAsc[i];
      if (d >= lo && d < latest) { soma += porDia[d]; cont++; }  // dias anteriores na janela
    }
    if (!cont) return null;
    var media = soma / cont;
    if (media === 0) return null;
    return ((hoje - media) / media) * 100;
  }

  // ---------- sparkline v2 (Fase E; espelhado no prerender_precos.py) ----------
  // Menor preço POR DIA nos últimos 30 dias, curva Catmull-Rom suavizada,
  // gradiente sob a linha, cores do v2. Série estável fica no MEIO do svg.
  var sparkSeq = 0;
  function smoothPath(pts, h) {
    if (pts.length < 3) {
      var out = 'M' + pts[0][0] + ' ' + pts[0][1];
      for (var j = 1; j < pts.length; j++) out += 'L' + pts[j][0] + ' ' + pts[j][1];
      return out;
    }
    function cl(y) { return Math.max(1, Math.min(h - 1, y)); }
    var d = 'M' + pts[0][0] + ' ' + pts[0][1];
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = i > 0 ? pts[i - 1] : pts[i];
      var p1 = pts[i], p2 = pts[i + 1];
      var p3 = (i + 2 < pts.length) ? pts[i + 2] : p2;
      var c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = cl(p1[1] + (p2[1] - p0[1]) / 6);
      var c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = cl(p2[1] - (p3[1] - p1[1]) / 6);
      d += 'C' + c1x.toFixed(1) + ' ' + c1y.toFixed(1) + ',' + c2x.toFixed(1) + ' ' + c2y.toFixed(1) + ',' + p2[0] + ' ' + p2[1];
    }
    return d;
  }
  function sparkSvg(pontos) {
    if (!pontos || !pontos.length) return '';
    var porDia = porDiaMins(pontos);
    var dias = Object.keys(porDia).sort();
    var lim = dateMinusDays(30);
    var janela = dias.filter(function (d) { return d >= lim; });
    if (janela.length < 2) janela = dias;
    if (janela.length < 2) return '';
    var precos = janela.map(function (d) { return porDia[d]; });
    var min = Math.min.apply(null, precos), max = Math.max.apply(null, precos);
    var w = 100, h = 28, pad = 3, range = max - min;
    var pts = janela.map(function (d, i) {
      var x = (i / (janela.length - 1)) * (w - pad * 2) + pad;
      var y = range ? (h - pad - ((porDia[d] - min) / range) * (h - pad * 2)) : h / 2;
      return [Number(x.toFixed(1)), Number(y.toFixed(1))];
    });
    var queda = precos[precos.length - 1] <= precos[0];
    var cor = queda ? '#2FE08A' : '#FF9B7A';
    var gid = 'ptg' + (++sparkSeq);
    var line = smoothPath(pts, h);
    var first = pts[0], last = pts[pts.length - 1];
    var fill = line + 'L' + last[0] + ' ' + (h - 1) + 'L' + first[0] + ' ' + (h - 1) + 'Z';
    return '<svg class="pt-spark" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true">' +
      '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="' + cor + '" stop-opacity="0.28"/>' +
      '<stop offset="1" stop-color="' + cor + '" stop-opacity="0"/></linearGradient></defs>' +
      '<path class="sp-fill" d="' + fill + '" fill="url(#' + gid + ')"/>' +
      '<path class="sp-line" d="' + line + '" fill="none" stroke="' + cor + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" pathLength="1"/>' +
      '<circle class="sp-dot" cx="' + last[0] + '" cy="' + last[1] + '" r="2.5" fill="' + cor + '"/></svg>';
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
        WINDOWS.forEach(function (n) { v[n] = varNd(porDia, datasAsc, n); });
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
        cupomLoja: cupomLoja, cupomPlat: cupomPlat,
        cupomLojaVal: venc === 'aliexpress' ? (mk.cupom_validade || null) : null,
        cupomLojaMin: venc === 'aliexpress' ? (mk.cupom_minimo || null) : null,
        cupomPlatVal: venc === 'aliexpress' ? (mk.cupom_plataforma_validade || null) : null,
        cupomPlatMin: venc === 'aliexpress' ? (mk.cupom_plataforma_minimo || null) : null
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
  // Validade/mínimo do cupom (etapa 2.1) — espelhado em prerender_precos.py (cupom_meta_txt)
  function cupomMetaTxt(validade, minimo) {
    var partes = [];
    var hoje = false;
    if (validade && /^\d{4}-\d{2}-\d{2}$/.test(String(validade))) {
      var d = new Date();
      var hojeIso = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
      if (validade === hojeIso) { partes.push('expira hoje'); hoje = true; }
      else if (validade > hojeIso) partes.push('válido até ' + validade.slice(8, 10) + '/' + validade.slice(5, 7));
      // vencida: não mostra nada (próxima rodada limpa o cupom)
    }
    if (minimo && Number(minimo) > 0) partes.push('pedido mínimo R$ ' + Math.round(Number(minimo)).toLocaleString('pt-BR'));
    return { txt: partes.join(' · '), hoje: hoje };
  }

  // data-cod: clique copia o código (listener no boot) e o prices-overlay manda
  // gtag copy_coupon. Espelhado em prerender_precos.py (cupom_span).
  function cupomSpan(cod, plat, validade, minimo) {
    var meta = cupomMetaTxt(validade, minimo);
    var base = plat ? 'Cupom da plataforma AliExpress' : 'Cupom da loja';
    var title = base + (meta.txt ? ' · ' + meta.txt : '') + ' · clique para copiar';
    var cls = plat ? 'pt-coupon pt-coupon-plat' : 'pt-coupon';
    var pre = plat ? '+ ' : '🎟 ';
    var inline = meta.hoje ? ' <span class="pt-coupon-hoje">· expira hoje</span>' : '';
    return '<span class="' + cls + '" title="' + escHtml(title) + '" data-cod="' + escHtml(cod) + '"' +
      ' role="button" tabindex="0">' + pre + escHtml(cod) + inline + '</span>';
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
      if (r.cupomLoja) html += cupomSpan(r.cupomLoja, false, r.cupomLojaVal, r.cupomLojaMin);
      if (r.cupomPlat) html += cupomSpan(r.cupomPlat, true, r.cupomPlatVal, r.cupomPlatMin);
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
        '<tr data-k="' + escHtml(r.buscaKey) + '">' +
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
        '<div class="pt-card" data-k="' + escHtml(r.buscaKey) + '">' +
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
        '<th>Últimos 30 dias</th>' +
        '<th class="pt-th-var">Oferta</th>' +
        '</tr>';
    }
  }

  // ---------- estado + ordenação ----------
  var ALL = [];
  var state = { win: WINDOWS[0], dir: 'queda', q: '' }; // dir: 'queda' = maior queda primeiro

  // Cascata de entrada (Fase E): --i vira delay no CSS; body.pt-anim liga o
  // conjunto (linhas + traço do sparkline). Busca digitada passa anim=false
  // pra não re-animar a cada tecla.
  function cascade(raiz, sel) {
    var els = raiz.querySelectorAll(sel);
    for (var i = 0; i < els.length; i++) {
      els[i].style.setProperty('--i', Math.min(i, 22));
      els[i].classList.add('pt-in');
    }
  }

  // FLIP (Fase E): posição antiga − nova = translateY inicial; soltando o
  // transform, a linha DESLIZA pro novo lugar. Linha sem posição antiga
  // (voltou do filtro / 1ª carga) entra por fade (.pt-in).
  function capturaPos(raiz, sel) {
    var m = {}, els = raiz.querySelectorAll(sel), n = 0;
    for (var i = 0; i < els.length; i++) {
      var k = els[i].getAttribute('data-k');
      if (k) { m[k] = els[i].getBoundingClientRect().top; n++; }
    }
    return n ? m : null;
  }
  function flipOuCascata(raiz, sel, oldPos) {
    var els = raiz.querySelectorAll(sel);
    if (!oldPos) { cascade(raiz, sel); return; }
    var moves = [];
    for (var i = 0; i < els.length; i++) {
      var el = els[i], k = el.getAttribute('data-k');
      if (k && oldPos[k] != null) {
        var delta = oldPos[k] - el.getBoundingClientRect().top;
        if (delta) { el.style.transform = 'translateY(' + delta + 'px)'; moves.push(el); }
      } else {
        el.style.setProperty('--i', 0);
        el.classList.add('pt-in');
      }
    }
    if (!moves.length) return;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        for (var j = 0; j < moves.length; j++) {
          moves[j].style.transition = 'transform 550ms cubic-bezier(0.22, 1, 0.36, 1)';
          moves[j].style.transform = '';
        }
        setTimeout(function () {
          for (var j = 0; j < moves.length; j++) { moves[j].style.transition = ''; }
        }, 620);
      });
    });
  }

  function applyView(anim) {
    var animar = MOTION_OK && anim !== false;
    document.body.classList.toggle('pt-anim', animar);

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

    if (!rows.length) {
      var msg = 'Nenhum projetor bate com essa busca — tenta só a marca (ex.: "wanbo").';
      if (tbody) tbody.innerHTML = '<tr><td class="pt-vazio" colspan="' + (5 + WINDOWS.length) + '">' + msg + '</td></tr>';
      if (cards) cards.innerHTML = '<div class="pt-vazio">' + msg + '</div>';
    } else {
      var posT = animar && tbody ? capturaPos(tbody, 'tr[data-k]') : null;
      var posC = animar && cards ? capturaPos(cards, '.pt-card[data-k]') : null;
      if (tbody) { tbody.innerHTML = renderTable(rows, win); if (animar) flipOuCascata(tbody, 'tr', posT); }
      if (cards) { cards.innerHTML = renderCards(rows, win); if (animar) flipOuCascata(cards, '.pt-card', posC); }
    }

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
      // coluna inativa ganha "↕" apagado — sem isso ninguém descobre que ordena
      if (ind) ind.textContent = active ? (' ' + arrow) : ' ↕';
    });
  }

  // Estilo do indicador de sort injetado via JS — mantido aqui (e não só no
  // template) pra cobrir o período em que o precos.html publicado ainda é o
  // chrome antigo; duplicar com o CSS do template é inofensivo.
  (function injectSortCss() {
    var st = document.createElement('style');
    st.textContent = '[data-win] .pt-sort-ind{font-size:0.85em}' +
      '[data-win]:not(.pt-active) .pt-sort-ind{opacity:0.45}' +
      '.pt-coupon[data-cod]{cursor:pointer}' +
      '.pt-coupon-hoje{color:rgba(255,155,122,0.95);font-weight:600}';
    document.head.appendChild(st);
  })();

  // Cupom copiável (etapa 2.1): clique/Enter copia o código. Delegado no document
  // — cobre tanto as linhas re-renderizadas pelo JS quanto as assadas no HTML
  // estático pelo prerender. O gtag copy_coupon vem do prices-overlay.js.
  (function bindCouponCopy() {
    function copiar(el) {
      var cod = el.getAttribute('data-cod');
      if (!cod || !navigator.clipboard) return;
      // feedback só DEPOIS da cópia confirmada (writeText pode rejeitar em
      // webview/documento sem foco — "✓ copiado" com clipboard vazio é mentira)
      navigator.clipboard.writeText(cod).then(function () {
        if (el.getAttribute('data-copiando')) return; // 2º clique no feedback não vira texto preso
        el.setAttribute('data-copiando', '1');
        var antes = el.innerHTML;
        el.innerHTML = '✓ copiado';
        setTimeout(function () { el.innerHTML = antes; el.removeAttribute('data-copiando'); }, 1200);
      }).catch(function () {});
    }
    document.addEventListener('click', function (e) {
      var el = e.target && e.target.closest ? e.target.closest('.pt-coupon[data-cod]') : null;
      if (el) copiar(el);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var el = e.target && e.target.closest ? e.target.closest('.pt-coupon[data-cod]') : null;
      // el.click() em vez de copiar(el): unifica com o fluxo de clique, onde o
      // prices-overlay.js também emite o gtag copy_coupon (span role=button não
      // sintetiza click no Enter sozinho)
      if (el) { e.preventDefault(); el.click(); }
    });
  })();

  function onWinClick(w) {
    if (w === state.win) {
      state.dir = (state.dir === 'queda') ? 'alta' : 'queda'; // 2º clique inverte
    } else {
      state.win = w;
      state.dir = 'queda'; // nova janela começa por maior queda
    }
    applyView(true);
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
      search.addEventListener('input', function () { state.q = norm(this.value); applyView(false); });
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
      applyView(true);
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
