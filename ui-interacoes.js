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
     - novidades do site (data/novidades.json): linha "Novidades" no
       footer .foot-bottom, etiqueta "novo" no botão de alerta de preço e a
       chegada por #alerta em /projetor/ (11/09/2026)

   O que expõe pras páginas (window.UI2) — fonte única dos helpers que o
   raio-X 13/07 achou duplicados (norm/fmtBRL/esc/nomeLoja/ytId):
     norm, esc, fmtBRL, fmtData, chaveNome, nomeLoja, ytId,
     emMenorHistorico, posRegua, cupomVivo, hojeIso,
     getNovidades, novidadeAtiva, aterrissarAlerta,
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
  /* Regex própria, sem herdar window.SITE_BASE_PATH: o basePath() do overlay
     não conhece /acessorios/ e devolve '' lá, o que mandava a barra de quedas
     (e agora as novidades) buscar acessorios/data/*.json = 404 silencioso nas
     23 páginas de acessório. Achado da revisão de 11/09/2026. */
  var bp = /\/(projetor|marca|acessorios)\//i.test(location.pathname) ? '../' : '';

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
          // Sem preço publicado nem sempre é falta de estoque: 'coletando' (projetor
          // que ainda não estreou) e diagnóstico do checker também zeram o preço.
          // O prices-overlay marca sem_estoque_real só nos motivos de esgotamento.
          var sub = p.preco_atual != null
            ? nomeLoja(p.marketplace_vencedor) + (emMenorHistorico(p) ? ' &middot; menor hist&oacute;rico' : '')
            : (p.sem_estoque_real ? 'sem estoque no momento' : 'verificando pre&ccedil;o');
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

  /* ---------- novidades do site (data/novidades.json, editado no PC) ----------
     Uma fonte, três saídas: a linha "Novidades" no .foot-bottom de toda página,
     a etiqueta "novo" no botão de alerta de preço (/projetor/ com preço) e a tag
     "Novo" do painel da home (o inline do index.html lê UI2.getNovidades).
     Arquivo ausente, 404 ou quebrado = site idêntico ao de antes. A copy passa
     pelo test_novidades_json.py antes do push. Cache padrão do GH Pages
     (max-age 600): novidade nova leva até 10 min pra aparecer, aceitável. */
  var _novidades = null;
  function getNovidades() {
    if (!_novidades) {
      _novidades = fetch(bp + 'data/novidades.json')
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          var itens = j && Array.isArray(j.itens) ? j.itens : [];
          return itens
            .filter(function (n) { return n && n.id && n.titulo && n.data; })
            .sort(function (a, b) { return a.data < b.data ? 1 : (a.data > b.data ? -1 : 0); });
        })
        .catch(function () { return []; });
    }
    return _novidades;
  }
  /* destaque vivo = data <= hoje <= ate (strings ISO, sem Date/UTC) */
  function novidadeAtiva(n) {
    if (!n || !n.destaque || !n.ate) return false;
    var hj = hojeIso();
    return n.data <= hj && hj <= n.ate;
  }
  function slugDaPagina() {
    return (String(location.pathname).match(/\/projetor\/([^\/]+)\.html/i) || [])[1] || '';
  }
  function ga(nome, params) {
    try {
      if (typeof gtag === 'function') gtag('event', nome, params);
    } catch (e) { /* tracking nunca quebra a navegação */ }
  }
  function overlayPronto() {
    return window.PRICES_OVERLAY_READY && typeof window.PRICES_OVERLAY_READY.then === 'function'
      ? window.PRICES_OVERLAY_READY : Promise.resolve();
  }
  /* querySelector que não lança: o seletor vem do JSON (dado, não código), e um
     seletor inválido derrubaria o .then inteiro, inclusive o que vem depois. */
  function q(sel) {
    if (!sel || typeof sel !== 'string') return null;
    try { return document.querySelector(sel); } catch (e) { return null; }
  }
  /* chama cb quando o seletor existir (agora, ou quando aparecer no DOM). Usado
     pro texto "criar aqui" do rodapé na home, onde o painel é pintado depois
     de prices.json + quedas-dia.json e a ordem com novidades.json é corrida. */
  function quandoExistir(sel, cb) {
    if (q(sel)) { cb(); return; }
    if (!('MutationObserver' in window)) return;
    var mo = new MutationObserver(function () {
      if (q(sel)) { mo.disconnect(); cb(); }
    });
    mo.observe(document.body, { childList: true, subtree: true });
    setTimeout(function () { mo.disconnect(); }, 20000);
  }

  /* Chegada no botão de alerta de preço (vindo da home por #alerta ou do link
     do rodapé na própria página). Tudo é decidido NA HORA, nunca no init: o
     botão só existe depois do prices.json. O escopo .alerta-preco é obrigatório
     porque o botão de ESTOQUE das páginas esgotadas também é .ae-abrir.
     - O halo vai no WRAPPER, não no botão: o handler do overlay esconde o botão
       no clique (btn.hidden = true) e o halo sumiria junto.
     - Só clica no computador (pointer fino). No celular o handler do overlay
       foca o campo sem guarda e o teclado sobe antes de a pessoa ler; ali só
       destaca, e o toque dela abre.
     - Guard de reentrância: form já aberto = só rola e destaca, sem segundo
       alerta_preco_abrir. */
  function aterrissarAlerta(source) {
    var wrap = document.querySelector('.proj-price-card .alerta-preco');
    var btn = wrap && wrap.querySelector('.ae-abrir');
    if (!wrap || !btn) return false;
    window.ALERTA_ORIGEM = source;   // o overlay carimba origem nos eventos dele
    var jaAberto = btn.hidden || btn.getAttribute('aria-expanded') === 'true';
    var fino = !window.matchMedia('(pointer: coarse)').matches;
    var abriu = false;
    if (!jaAberto && fino) { btn.click(); abriu = true; }
    var foco = (jaAberto || abriu) ? (wrap.querySelector('.ae-form') || wrap) : wrap;
    foco.scrollIntoView({ block: 'center' });
    wrap.classList.add('ap-destaque');
    setTimeout(function () { wrap.classList.remove('ap-destaque'); }, 1600);
    ga('anuncio_alerta_aterrissar', { source: source, product_slug: slugDaPagina(), abriu: abriu });
    return true;
  }
  /* elemento local de uma novidade: dentro do bloco de alerta usa a chegada
     completa; fora dele (ex.: o select do painel da home) só rola e foca */
  function irAte(el, source) {
    if (el.closest && el.closest('.alerta-preco')) return aterrissarAlerta(source);
    el.scrollIntoView({ block: 'center' });
    try { el.focus({ preventScroll: true }); } catch (e) { /* elemento sem foco */ }
    return true;
  }

  function initNovidadesRodape(itens) {
    var alvo = document.querySelector('footer .foot-bottom');
    if (!alvo || !itens.length || document.querySelector('.foot-novidades')) return;
    var p = document.createElement('p');
    p.className = 'foot-novidades';   // sem .reveal: o observer já rodou no init
    var rot = document.createElement('span');
    rot.className = 'fn-label';
    rot.textContent = 'Novidades';
    p.appendChild(rot);
    itens.slice(0, 3).forEach(function (n, i) {
      if (i) {
        var sep = document.createElement('span');
        sep.className = 'fn-sep';
        sep.setAttribute('aria-hidden', 'true');
        sep.textContent = '·';
        p.appendChild(sep);
      }
      var a = document.createElement('a');
      a.href = bp + String(n.link || '');
      a.setAttribute('data-novidade', n.id);
      var data = document.createElement('span');
      data.className = 'fn-data';
      data.textContent = fmtData(n.data);
      var txt = document.createTextNode(n.titulo);
      a.appendChild(data);
      a.appendChild(txt);
      if (novidadeAtiva(n)) {
        var tag = document.createElement('span');
        tag.className = 'fn-novo';
        tag.textContent = n.tag || 'Novo';
        a.appendChild(tag);
      }
      a.appendChild(document.createTextNode(' →'));
      // O texto "criar nesta página" só depois do overlay: é ele que injeta o botão.
      if (n.local_seletor && n.link_local_txt) {
        overlayPronto().then(function () {
          if (q(n.local_seletor)) txt.textContent = n.link_local_txt;
        });
      }
      // só na home: fora dela o seletor nunca aparece e o observer vigiaria à toa
      if (n.home_seletor && n.home_txt && /\/(index\.html)?$/.test(location.pathname)) {
        quandoExistir(n.home_seletor, function () { txt.textContent = n.home_txt; });
      }
      a.addEventListener('click', function (ev) {
        var destino = 'link';
        var local = q(n.local_seletor);
        var home = !local ? q(n.home_seletor) : null;
        if (local) { ev.preventDefault(); destino = 'form'; irAte(local, 'rodape_local'); }
        else if (home) { ev.preventDefault(); destino = 'painel'; irAte(home, 'rodape_home'); }
        ga('anuncio_alerta_click', {
          source: 'rodape', novidade_id: n.id, product_slug: slugDaPagina(),
          destino: destino, transport_type: 'beacon'
        });
      });
      p.appendChild(a);
    });
    alvo.insertBefore(p, alvo.firstChild);
  }

  /* etiqueta "novo" no botão de PREÇO enquanto o item estiver ativo */
  function initNovidadesAlerta(itens) {
    var n = itens.filter(function (x) { return x.id === 'alerta-preco'; })[0];
    if (!novidadeAtiva(n)) return;
    overlayPronto().then(function () {
      var btn = document.querySelector('.proj-price-card .alerta-preco .ae-abrir');
      if (btn) btn.classList.add('ae-novo');
    });
  }
  /* chegada por #alerta: NÃO depende do novidades.json (sem JSON o link da
     home continua funcionando; só a etiqueta some) */
  function initChegadaAlerta() {
    if (location.hash !== '#alerta') return;
    overlayPronto().then(function () { aterrissarAlerta('hash'); });
  }

  function initNovidades() {
    initChegadaAlerta();
    getNovidades().then(function (itens) {
      initNovidadesRodape(itens);
      initNovidadesAlerta(itens);
    });
  }

  /* ---------- init ---------- */
  function init() {
    initBarraQuedas();
    initMenuMobile();
    initBusca();
    initCupons();
    initNovidades();
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
    getNovidades: getNovidades, novidadeAtiva: novidadeAtiva, aterrissarAlerta: aterrissarAlerta,
    ligaAgora: ligaAgora, observaReveals: observaReveals, animaContadores: animaContadores,
    MOTION_OK: MOTION_OK, basePath: bp
  };
})();
