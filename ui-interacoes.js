/* ============================================================
   ui-interacoes.js — runtime compartilhado do redesign v2 (B1, 13/07/2026)

   Carregar com defer DEPOIS de projetores-data.js + prices-overlay.js:
     <script src="script.js" defer></script>
     <script src="projetores-data.js" defer></script>
     <script src="prices-overlay.js" defer></script>
     <script src="ui-interacoes.js" defer></script>

   O que faz sozinho (se o markup v2 existir na página):
     - barra de quedas (#barra-quedas, dados de data/quedas-dia.json)
     - menu mobile (#menu-btn / #menu-mobile / #menu-fechar) com aria-expanded
     - busca do header (#busca-input / #busca-drop) sobre PROJETORES_DATA
       já fundido com preços (espera PRICES_OVERLAY_READY); atalhos "/" e Ctrl+K
     - observer de .reveal (cascata + preenche .seg-fill/.r-fill/.r-dot/.badge-hist)
     - copiar cupom (delegado, .cupom-chip[data-cod]) + evento GA4 copy_coupon

   O que expõe pras páginas (window.UI2) — fonte única dos helpers que o
   raio-X 13/07 achou duplicados (norm/fmtBRL/esc/nomeLoja/ytId):
     norm, esc, fmtBRL, fmtData, chaveNome, nomeLoja, ytId,
     emMenorHistorico, posRegua, cupomVivo, hojeIso,
     ligaAgora(el), observaReveals(raiz), animaContadores(raiz),
     MOTION_OK, basePath.

   Contrato de timing: script deferido roda antes do DOMContentLoaded.
   Página que renderiza conteúdo dinâmico com .reveal/.seg-fill chama
   UI2.observaReveals(container) (1ª carga) ou UI2.ligaAgora(el)
   (re-render pós-interação) depois de mexer no DOM.

   Páginas ANTIGAS (style.css) não carregam este arquivo — o script.js
   antigo segue responsável por elas até a Etapa B2/D.
   ============================================================ */
(function () {
  'use strict';

  var MOTION_OK = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var bp = typeof window.SITE_BASE_PATH === 'string'
    ? window.SITE_BASE_PATH
    : (/\/(projetor|marca|acessorios)\//i.test(location.pathname) ? '../' : '');

  /* ---------- helpers (fonte única) ---------- */
  function norm(s) {
    return String(s == null ? '' : s).trim().toLowerCase();
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function fmtBRL(n) {
    if (n == null || isNaN(n)) return '';
    return Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  /* 'YYYY-MM-DD HH:MM[:SS]' -> 'DD/MM HH:MM' (fatia string, sem Date/UTC) */
  function fmtData(s) {
    var d = String(s || '').split(' ');
    var p = d[0].split('-');
    if (p.length !== 3) return String(s || '');
    return p[2] + '/' + p[1] + (d[1] ? ' ' + d[1].slice(0, 5) : '');
  }
  function chaveNome(p) {
    return norm(p.marca + ' ' + p.modelo);
  }
  function nomeLoja(m) {
    return {
      aliexpress: 'AliExpress', shopee: 'Shopee',
      mercado_livre: 'Mercado Livre', ml: 'Mercado Livre', amazon: 'Amazon'
    }[m] || (m || '');
  }
  function ytId(url) {
    if (!url) return null;
    var m = String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/);
    return m ? m[1] : null;
  }
  /* régua do site: série flat (produto novo) não ganha selo */
  function emMenorHistorico(p) {
    return p && p.preco_atual != null && p.preco_min_historico != null &&
      p.preco_atual <= p.preco_min_historico &&
      p.preco_max_historico > p.preco_min_historico + 0.5;
  }
  function posRegua(p) {
    var faixa = p.preco_max_historico - p.preco_min_historico;
    if (!(faixa > 0)) return 0.5;
    return Math.max(0, Math.min(1, (p.preco_atual - p.preco_min_historico) / faixa));
  }
  function hojeIso() {
    var hj = new Date();
    return hj.getFullYear() + '-' + ('0' + (hj.getMonth() + 1)).slice(-2) + '-' + ('0' + hj.getDate()).slice(-2);
  }
  /* cupom com validade vencida não renderiza (regra Ali-only fica na página:
     só chamar isto quando o marketplace vencedor é aliexpress) */
  function cupomVivo(cod, validade) {
    return !!cod && !(validade && validade < hojeIso());
  }

  /* ---------- reveal em cascata + barras/réguas/badges ---------- */
  function ligaAgora(el) {
    if (!el || !el.querySelectorAll) return;
    el.classList.add('on');
    var i, fills = el.querySelectorAll('.seg-fill[data-w]');
    for (i = 0; i < fills.length; i++) fills[i].style.width = fills[i].getAttribute('data-w') + '%';
    var rf = el.querySelectorAll('.r-fill[data-w]');
    for (i = 0; i < rf.length; i++) rf[i].style.width = rf[i].getAttribute('data-w') + '%';
    var rd = el.querySelectorAll('.r-dot[data-x]');
    for (i = 0; i < rd.length; i++) rd[i].style.left = rd[i].getAttribute('data-x') + '%';
    var pops = el.querySelectorAll('.badge-hist[data-pop]');
    for (i = 0; i < pops.length; i++) pops[i].classList.add('pop');
  }

  var observer = null;
  if (MOTION_OK && 'IntersectionObserver' in window) {
    observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { ligaAgora(en.target); observer.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -30px 0px' });
  }
  function observaReveals(raiz) {
    var alvos = (raiz || document).querySelectorAll('.reveal:not(.on)');
    var i;
    if (!observer) {
      for (i = 0; i < alvos.length; i++) ligaAgora(alvos[i]);
      return;
    }
    for (i = 0; i < alvos.length; i++) observer.observe(alvos[i]);
  }

  /* ---------- contadores animados ([data-alvo], sufixo em [data-sufixo]) ---------- */
  function animaContadores(raiz) {
    var nums = (raiz || document).querySelectorAll('[data-alvo]');
    function anima(el) {
      var alvo = parseInt(el.getAttribute('data-alvo'), 10) || 0;
      var suf = el.getAttribute('data-sufixo') || '';
      if (!MOTION_OK) { el.textContent = alvo + suf; return; }
      var ini = null, dur = 900;
      function passo(ts) {
        if (!ini) ini = ts;
        var t = Math.min(1, (ts - ini) / dur);
        var eased = 1 - Math.pow(1 - t, 3);
        el.textContent = Math.round(alvo * eased) + suf;
        if (t < 1) requestAnimationFrame(passo);
      }
      requestAnimationFrame(passo);
    }
    for (var i = 0; i < nums.length; i++) anima(nums[i]);
  }

  /* ---------- quedas do dia (fetch único, compartilhado com o painel) ---------- */
  var _quedas = null;
  function getQuedas() {
    if (!_quedas) {
      _quedas = fetch(bp + 'data/quedas-dia.json', { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; });
    }
    return _quedas;
  }

  /* ---------- barra de quedas (markup estático #barra-quedas) ----------
     Itens levam pra /precos.html (decisão do dono 13/07 — não linkam
     pro review). Sem quedas = barra some. */
  function initBarraQuedas() {
    var el = document.getElementById('barra-quedas');
    if (!el || !el.classList.contains('quedas')) return;
    getQuedas()
      .then(function (j) {
        if (!j || !Array.isArray(j.quedas) || !j.quedas.length) { el.style.display = 'none'; return; }
        var itens = j.quedas.map(function (q) {
          var pct = Math.abs(q.delta_pct).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
          return '<a href="' + bp + 'precos.html"><b>' + esc(q.marca + ' ' + q.modelo) +
            '</b> <span class="q-seta">&darr;</span><span class="q-pct">' + pct + '%</span></a>';
        }).join('');
        var hora = j.hora_coleta ? ' <span class="q-hora">&middot; rodada de ' + esc(j.hora_coleta) + '</span>' : '';
        el.innerHTML = '<div class="wrap"><span class="q-titulo">Quedas ' + esc(j.data_ontem || '') +
          ' &rarr; ' + esc(j.data_hoje || '') + hora + '</span>' + itens + '</div>';
      });
  }

  /* ---------- menu mobile ---------- */
  function initMenuMobile() {
    var btn = document.getElementById('menu-btn');
    var painel = document.getElementById('menu-mobile');
    if (!btn || !painel) return;
    var fechar = document.getElementById('menu-fechar');
    function seta(aberto) {
      painel.classList.toggle('aberto', aberto);
      btn.setAttribute('aria-expanded', aberto ? 'true' : 'false');
    }
    btn.setAttribute('aria-expanded', 'false');
    btn.addEventListener('click', function () { seta(true); });
    if (fechar) fechar.addEventListener('click', function () { seta(false); });
    painel.addEventListener('click', function (e) { if (e.target.closest('a')) seta(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && painel.classList.contains('aberto')) seta(false);
    });
  }

  /* ---------- busca do header ----------
     Lista PROJETORES_DATA (listar!==false) já fundido com preços.
     Com página própria (slug do overlay) vai pra ela; sem slug, /precos.html. */
  function initBusca() {
    var input = document.getElementById('busca-input');
    var drop = document.getElementById('busca-drop');
    if (!input || !drop) return;

    var ativo = -1;
    function itens() { return drop.querySelectorAll('a'); }
    function marca(idx) {
      var lis = itens();
      for (var i = 0; i < lis.length; i++) lis[i].classList.toggle('ativa', i === idx);
      if (lis[idx]) lis[idx].scrollIntoView({ block: 'nearest' });
      ativo = idx;
    }
    function fecha() { drop.classList.remove('aberta'); drop.innerHTML = ''; ativo = -1; }

    function render() {
      var q = norm(input.value);
      if (q.length < 2) { fecha(); return; }
      var data = window.PROJETORES_DATA || [];
      var res = data.filter(function (p) {
        return p.listar !== false && chaveNome(p).indexOf(q) !== -1;
      }).slice(0, 6);
      if (!res.length) {
        drop.innerHTML = '<span class="bd-vazio">nenhum projetor encontrado</span>';
      } else {
        drop.innerHTML = res.map(function (p) {
          var href = p.slug ? bp + 'projetor/' + p.slug + '.html' : bp + 'precos.html';
          var sub = p.preco_atual != null
            ? nomeLoja(p.marketplace_vencedor) + (emMenorHistorico(p) ? ' &middot; menor hist&oacute;rico' : '')
            : 'sem estoque no momento';
          var preco = p.preco_atual != null ? fmtBRL(p.preco_atual) : '&mdash;';
          return '<a href="' + esc(href) + '">' +
            '<span class="bd-nome"><b>' + esc(p.marca + ' ' + p.modelo) + '</b><span>' + sub + '</span></span>' +
            '<span class="bd-preco">' + preco + '</span></a>';
        }).join('');
      }
      drop.classList.add('aberta');
      ativo = -1;
    }

    var pronto = window.PRICES_OVERLAY_READY && typeof window.PRICES_OVERLAY_READY.then === 'function'
      ? window.PRICES_OVERLAY_READY : Promise.resolve();
    pronto.then(function () {
      input.addEventListener('input', render);
      input.addEventListener('keydown', function (e) {
        if (!drop.classList.contains('aberta')) return;
        var n = itens().length;
        if (e.key === 'ArrowDown') { e.preventDefault(); marca(Math.min(ativo + 1, n - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); marca(Math.max(ativo - 1, 0)); }
        else if (e.key === 'Enter') {
          var lis = itens();
          if (ativo >= 0 && lis[ativo]) { e.preventDefault(); location.href = lis[ativo].getAttribute('href'); }
        }
        else if (e.key === 'Escape') { fecha(); input.blur(); }
      });
    });
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.busca')) fecha();
    });
    /* atalhos: "/" ou Ctrl/Cmd+K focam a busca (paridade com o search antigo) */
    document.addEventListener('keydown', function (e) {
      var tag = (e.target && e.target.tagName) || '';
      var digitando = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable);
      if (digitando) return;
      if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') || e.key === '/') {
        e.preventDefault();
        input.focus();
      }
    });
  }

  /* ---------- copiar cupom (delegado — cards re-renderizam) ----------
     GA4: mesmo evento copy_coupon do resto do site (prices-overlay não
     conhece .cupom-chip, então não tem contagem dupla). */
  function initCupons() {
    document.addEventListener('click', function (ev) {
      var b = ev.target.closest ? ev.target.closest('.cupom-chip[data-cod]') : null;
      if (!b || !navigator.clipboard) return;
      var cod = b.getAttribute('data-cod');
      navigator.clipboard.writeText(cod).then(function () {
        var orig = b.textContent;
        b.textContent = 'copiado!';
        setTimeout(function () { b.textContent = orig; }, 1500);
        try {
          if (typeof gtag === 'function') {
            gtag('event', 'copy_coupon', {
              cupom: cod,
              product_slug: b.getAttribute('data-slug') || location.pathname,
              source: b.getAttribute('data-source') || 'v2_card'
            });
          }
        } catch (e) { /* tracking nunca quebra a cópia */ }
      }).catch(function () {});
    });
  }

  /* ---------- init ---------- */
  function init() {
    initBarraQuedas();
    initMenuMobile();
    initBusca();
    initCupons();
    observaReveals(document);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.UI2 = {
    norm: norm, esc: esc, fmtBRL: fmtBRL, fmtData: fmtData,
    chaveNome: chaveNome, nomeLoja: nomeLoja, ytId: ytId,
    emMenorHistorico: emMenorHistorico, posRegua: posRegua,
    cupomVivo: cupomVivo, hojeIso: hojeIso, getQuedas: getQuedas,
    ligaAgora: ligaAgora, observaReveals: observaReveals, animaContadores: animaContadores,
    MOTION_OK: MOTION_OK, basePath: bp
  };
})();
