/* ============================================================
   search-global.js — Busca global de projetores (13/05/2026)

   Plug-and-play: basta incluir <script src="search-global.js" defer></script>
   em qualquer página. Detecta sozinho a profundidade (raiz vs /projetor/).

   - Injeta um botão "Buscar projetor" dentro do #header
     (full em desktop, ícone-only em mobile).
   - Atalho de teclado: "/" ou Ctrl/Cmd+K → abre overlay full-screen.
   - Lista apenas projetores com slug (têm página individual).
   - Lê window.PROJETORES_DATA + window.SLUGS_MAP (popoulado por prices-overlay.js).
   ============================================================ */
(function () {
  'use strict';

  // basePath: se já foi calculado por prices-overlay.js usa, senão calcula
  function getBase() {
    if (typeof window.SITE_BASE_PATH === 'string') return window.SITE_BASE_PATH;
    return /\/projetor\//i.test(location.pathname) ? '../' : '';
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function ytId(url) {
    if (!url) return null;
    var m = String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/);
    return m ? m[1] : null;
  }

  // ─── CSS ───────────────────────────────────────────────────
  var CSS = '' +
    /* Trigger no header */
    '.sg-trigger{display:inline-flex;align-items:center;gap:10px;padding:8px 14px 8px 12px;background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:999px;color:var(--text-muted);font:inherit;font-size:0.85rem;font-weight:500;cursor:pointer;transition:all var(--transition,0.2s ease);margin-left:auto;margin-right:18px;min-width:220px}' +
    '.sg-trigger:hover{background:rgba(79,163,199,0.08);border-color:var(--border-hover);color:var(--text)}' +
    '.sg-trigger svg{flex-shrink:0;opacity:.75}' +
    '.sg-trigger-label{flex:1;text-align:left}' +
    '.sg-trigger-kbd{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:0.72rem;padding:2px 6px;border:1px solid var(--border);border-radius:5px;background:rgba(0,0,0,0.25);color:var(--text-dim);line-height:1}' +
    /* Modal overlay */
    '.sg-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.72);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);z-index:2000;display:none;align-items:flex-start;justify-content:center;padding:80px 20px 20px;overflow-y:auto}' +
    '.sg-overlay.open{display:flex}' +
    '.sg-modal{width:100%;max-width:640px;background:var(--bg-secondary,#111);border:1px solid var(--border);border-radius:16px;box-shadow:0 30px 80px rgba(0,0,0,0.6);overflow:hidden;display:flex;flex-direction:column;max-height:min(560px, calc(100dvh - 100px))}' +
    '.sg-input-wrap{display:flex;align-items:center;gap:12px;padding:16px 20px;border-bottom:1px solid var(--border)}' +
    '.sg-input-wrap svg{flex-shrink:0;color:var(--text-muted)}' +
    '.sg-input{flex:1;background:none;border:0;outline:none;color:var(--text);font:inherit;font-size:1rem;padding:6px 0}' +
    '.sg-input::placeholder{color:var(--text-dim)}' +
    '.sg-close{background:none;border:1px solid var(--border);border-radius:6px;color:var(--text-muted);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:0.72rem;padding:4px 8px;cursor:pointer;line-height:1}' +
    '.sg-close:hover{color:var(--text);border-color:var(--border-hover)}' +
    '.sg-results{flex:1;overflow-y:auto;padding:8px 0;-webkit-overflow-scrolling:touch}' +
    '.sg-item{display:flex;align-items:center;gap:14px;padding:12px 20px;cursor:pointer;border-left:3px solid transparent;text-decoration:none;color:inherit;transition:background 0.12s ease}' +
    '.sg-item:hover,.sg-item.active{background:rgba(79,163,199,0.08);border-left-color:var(--primary)}' +
    '.sg-thumb{width:56px;height:38px;flex-shrink:0;border-radius:6px;background:#000 center/cover no-repeat;border:1px solid var(--border)}' +
    '.sg-thumb.placeholder{display:flex;align-items:center;justify-content:center;color:var(--text-dim);font-size:1.1rem;font-weight:600;background:rgba(79,163,199,0.06)}' +
    '.sg-item-body{flex:1;min-width:0}' +
    '.sg-item-name{font-size:0.95rem;font-weight:600;color:var(--text);line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.sg-item-name .sg-marca{color:var(--text-muted);font-weight:500}' +
    '.sg-item-sub{font-size:0.78rem;color:var(--text-dim);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.sg-item-arrow{color:var(--text-dim);opacity:0;transition:opacity 0.15s ease;flex-shrink:0}' +
    '.sg-item:hover .sg-item-arrow,.sg-item.active .sg-item-arrow{opacity:1;color:var(--primary)}' +
    '.sg-empty{padding:36px 20px;text-align:center;color:var(--text-dim);font-size:0.9rem;line-height:1.6}' +
    '.sg-empty strong{color:var(--text);display:block;margin-bottom:6px}' +
    '.sg-empty a{color:var(--primary);text-decoration:underline}' +
    '.sg-footer{padding:10px 20px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;gap:12px;font-size:0.72rem;color:var(--text-dim);background:rgba(0,0,0,0.2)}' +
    '.sg-footer-keys{display:flex;gap:14px;align-items:center}' +
    '.sg-footer-keys span{display:inline-flex;align-items:center;gap:4px}' +
    '.sg-footer-keys kbd{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:0.7rem;padding:1px 5px;border:1px solid var(--border);border-radius:4px;background:rgba(0,0,0,0.3);color:var(--text-muted)}' +
    /* Responsive */
    '@media (max-width: 768px){' +
      '.sg-trigger{min-width:0;padding:8px;margin-right:10px;border-radius:50%;width:36px;height:36px;justify-content:center;gap:0}' +
      '.sg-trigger-label,.sg-trigger-kbd{display:none}' +
      '.sg-overlay{padding:0;align-items:stretch}' +
      '.sg-modal{max-width:100%;height:100dvh;max-height:100dvh;border-radius:0;border:0}' +
      '.sg-input-wrap{padding:14px 16px}' +
      '.sg-item{padding:14px 16px}' +
      '.sg-footer-keys span:not(.sg-fk-esc){display:none}' +
    '}';

  function injectCSS() {
    var s = document.createElement('style');
    s.id = 'sg-styles';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // ─── DOM ───────────────────────────────────────────────────
  var overlay, input, results, trigger;
  var listed = [];          // projetores com slug, ordenados
  var visible = [];         // resultado filtrado atual
  var activeIdx = -1;

  function injectTrigger() {
    var header = document.querySelector('#header .header-inner');
    if (!header) return false;
    // Já tem trigger?
    if (header.querySelector('.sg-trigger')) return true;
    var nav = header.querySelector('#mainNav');
    var menuBtn = header.querySelector('.mobile-menu-btn');

    trigger = document.createElement('button');
    trigger.className = 'sg-trigger';
    trigger.type = 'button';
    trigger.setAttribute('aria-label', 'Buscar projetor');
    trigger.innerHTML =
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><path d="m21 21-4.3-4.3"></path></svg>' +
      '<span class="sg-trigger-label">Buscar projetor…</span>' +
      '<span class="sg-trigger-kbd">/</span>';

    // Insere antes do nav (em desktop fica entre logo e nav; em mobile aparece antes do hamburguer)
    if (nav && nav.parentNode === header) {
      header.insertBefore(trigger, nav);
    } else if (menuBtn) {
      header.insertBefore(trigger, menuBtn);
    } else {
      header.appendChild(trigger);
    }
    trigger.addEventListener('click', openModal);
    return true;
  }

  function injectOverlay() {
    overlay = document.createElement('div');
    overlay.className = 'sg-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Buscar projetor');
    overlay.innerHTML =
      '<div class="sg-modal">' +
        '<div class="sg-input-wrap">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><path d="m21 21-4.3-4.3"></path></svg>' +
          '<input type="text" class="sg-input" placeholder="Digite o nome do projetor (ex: U90, HY450, AC1080)…" autocomplete="off" spellcheck="false" />' +
          '<button class="sg-close" type="button" aria-label="Fechar">esc</button>' +
        '</div>' +
        '<div class="sg-results" role="listbox"></div>' +
        '<div class="sg-footer">' +
          '<span>Mostra projetores com página dedicada</span>' +
          '<div class="sg-footer-keys">' +
            '<span><kbd>↑</kbd><kbd>↓</kbd> navegar</span>' +
            '<span><kbd>↵</kbd> abrir</span>' +
            '<span class="sg-fk-esc"><kbd>esc</kbd> fechar</span>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    input = overlay.querySelector('.sg-input');
    results = overlay.querySelector('.sg-results');

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal();
    });
    overlay.querySelector('.sg-close').addEventListener('click', closeModal);
    input.addEventListener('input', function () { activeIdx = 0; render(); });
    input.addEventListener('keydown', onKeyNav);

    // Delegação: clica item
    results.addEventListener('click', function (e) {
      var item = e.target.closest('.sg-item');
      if (item) {
        // Browser segue o href naturalmente; só fecha o modal
        closeModal();
      }
    });
  }

  function buildList() {
    listed = [];
    var data = window.PROJETORES_DATA || [];
    for (var i = 0; i < data.length; i++) {
      var p = data[i];
      if (p.listar === false) continue; // produto banido — fora da busca
      if (!p.slug) continue;
      // monta string-índice de busca uma vez
      var hay = (String(p.marca || '') + ' ' + String(p.modelo || '')).toLowerCase();
      var vid = ytId(p.video_url);
      listed.push({
        marca: p.marca || '',
        modelo: p.modelo || '',
        slug: p.slug,
        tec: p.tecnologia || '',
        res: p.resolucao_nativa || '',
        ansi: p.brilho_ansi || null,
        preco: p.preco_atual || p.preco_min || null,
        thumb: vid ? ('https://img.youtube.com/vi/' + vid + '/mqdefault.jpg') : null,
        hay: hay
      });
    }
    // ordena alfabético por marca + modelo
    listed.sort(function (a, b) {
      var aa = (a.marca + ' ' + a.modelo).toLowerCase();
      var bb = (b.marca + ' ' + b.modelo).toLowerCase();
      return aa < bb ? -1 : aa > bb ? 1 : 0;
    });
  }

  function filter(q) {
    q = q.trim().toLowerCase();
    if (!q) return listed.slice(0, 50);
    var terms = q.split(/\s+/);
    return listed.filter(function (p) {
      for (var i = 0; i < terms.length; i++) {
        if (p.hay.indexOf(terms[i]) === -1) return false;
      }
      return true;
    });
  }

  function fmtPrice(n) {
    if (!n) return '';
    return 'R$ ' + Math.round(Number(n)).toLocaleString('pt-BR');
  }

  function render() {
    var q = input.value;
    visible = filter(q);
    if (activeIdx >= visible.length) activeIdx = visible.length - 1;
    if (activeIdx < 0 && visible.length) activeIdx = 0;

    if (!visible.length) {
      var bp = getBase();
      results.innerHTML =
        '<div class="sg-empty">' +
          '<strong>Nenhum projetor encontrado com página dedicada</strong>' +
          'Estou criando as páginas aos poucos. Enquanto isso, você pode comparar todos no ' +
          '<a href="' + bp + 'comparar.html">comparador</a> ' +
          'ou usar o <a href="' + bp + 'qual-projetor.html">guia interativo</a>.' +
        '</div>';
      return;
    }

    var bp = getBase();
    var html = '';
    for (var i = 0; i < visible.length; i++) {
      var p = visible[i];
      var subParts = [];
      if (p.tec) subParts.push(p.tec);
      if (p.res) subParts.push(p.res);
      if (p.ansi) subParts.push(p.ansi + ' ANSI');
      if (p.preco) subParts.push(fmtPrice(p.preco));
      var sub = subParts.join(' · ');
      var thumbHtml = p.thumb
        ? '<div class="sg-thumb" style="background-image:url(' + esc(p.thumb) + ')"></div>'
        : '<div class="sg-thumb placeholder">' + esc((p.marca || '?').charAt(0).toUpperCase()) + '</div>';
      html +=
        '<a class="sg-item' + (i === activeIdx ? ' active' : '') + '" href="' + bp + 'projetor/' + esc(p.slug) + '.html" data-idx="' + i + '">' +
          thumbHtml +
          '<div class="sg-item-body">' +
            '<div class="sg-item-name"><span class="sg-marca">' + esc(p.marca) + '</span> ' + esc(p.modelo) + '</div>' +
            (sub ? '<div class="sg-item-sub">' + esc(sub) + '</div>' : '') +
          '</div>' +
          '<svg class="sg-item-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>' +
        '</a>';
    }
    results.innerHTML = html;
  }

  function onKeyNav(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!visible.length) return;
      activeIdx = (activeIdx + 1) % visible.length;
      updateActive(true);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!visible.length) return;
      activeIdx = (activeIdx - 1 + visible.length) % visible.length;
      updateActive(true);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIdx >= 0 && visible.length) {
        var item = results.querySelector('.sg-item[data-idx="' + activeIdx + '"]');
        if (item) {
          closeModal();
          // navegar de forma natural
          location.href = item.getAttribute('href');
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeModal();
    }
  }

  function updateActive(scrollIntoView) {
    var items = results.querySelectorAll('.sg-item');
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle('active', i === activeIdx);
    }
    if (scrollIntoView && items[activeIdx]) {
      items[activeIdx].scrollIntoView({ block: 'nearest' });
    }
  }

  function openModal() {
    if (!overlay) return;
    if (!listed.length) buildList();
    activeIdx = 0;
    render();
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    setTimeout(function () { input.focus(); }, 30);
  }

  function closeModal() {
    if (!overlay) return;
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    input.value = '';
  }

  function onKeyGlobal(e) {
    // Não interfere se já tá digitando em outro input
    var tag = (e.target && e.target.tagName) || '';
    var typing = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable);
    if (overlay && overlay.classList.contains('open')) return;
    if (typing) return;
    // Ctrl/Cmd + K
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openModal();
      return;
    }
    // "/" só
    if (e.key === '/') {
      e.preventDefault();
      openModal();
    }
  }

  function init() {
    if (!injectTrigger()) return; // sem #header não faz sentido
    injectCSS();
    injectOverlay();
    document.addEventListener('keydown', onKeyGlobal);

    // Quando dados+slugs estiverem prontos, reconstrói lista
    if (window.PRICES_OVERLAY_READY && typeof window.PRICES_OVERLAY_READY.then === 'function') {
      window.PRICES_OVERLAY_READY.then(function () { buildList(); });
    } else {
      buildList();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
