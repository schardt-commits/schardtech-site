/* ============================================================
   prices-overlay.js — Fase 4b (10/05/2026) + slugs (13/05/2026)
   Aplica camada de preços/links/cupons do data/prices.json
   sobre window.PROJETORES_DATA carregado de projetores-data.js.
   Também carrega data/slugs.json e injeta proj.slug → usado pelo
   componente de busca e cards clicáveis (qual-projetor / comparar).

   Backward-compat: se o fetch falhar (404, JSON quebrado, offline),
   o site continua renderizando com os dados estáticos antigos.

   Como usar nos HTMLs:
     <script src="projetores-data.js"></script>
     <script src="prices-overlay.js"></script>
     ...
     // antes do primeiro render:
     window.PRICES_OVERLAY_READY.then(() => { renderTudo(); });
   ============================================================ */
(function () {
  function norm(s) {
    return String(s || '').trim().toLowerCase();
  }

  // Detecta o caminho-base para acessar /data/ — funciona em qualquer profundidade
  // (raiz, /projetor/{slug}.html, etc.)
  function basePath() {
    var p = location.pathname;
    // Se está em /projetor/algo.html, sobe uma pasta
    if (/\/projetor\//i.test(p)) return '../';
    return '';
  }

  function mergeOverlay(produtos, indisponiveis, slugMap) {
    const data = window.PROJETORES_DATA;
    if (!Array.isArray(data)) return { merged: 0, zerados: 0, slugged: 0 };

    const indexOverlay = new Map();
    for (const p of produtos) {
      indexOverlay.set(norm(p.marca) + '|' + norm(p.modelo), p);
    }
    const indexIndisp = new Set();
    for (const x of indisponiveis || []) {
      indexIndisp.add(norm(x.marca) + '|' + norm(x.modelo));
    }
    // Index dos slugs também por chave normalizada (case-insensitive)
    const indexSlug = new Map();
    if (slugMap && typeof slugMap === 'object') {
      for (const k of Object.keys(slugMap)) {
        if (k.startsWith('_')) continue;
        const parts = k.split('|');
        if (parts.length === 2) {
          indexSlug.set(norm(parts[0]) + '|' + norm(parts[1]), slugMap[k]);
        }
      }
    }

    let merged = 0;
    let zerados = 0;
    let slugged = 0;
    for (const proj of data) {
      const k = norm(proj.marca) + '|' + norm(proj.modelo);
      const overlay = indexOverlay.get(k);

      if (overlay) {
        // Sobrescreve preco_min/max para filtro+scoring existentes continuarem funcionando
        proj.preco_min = overlay.preco_atual;
        proj.preco_max = overlay.preco_max_historico || overlay.preco_atual;

        // Campos novos consumidos pelo render expandido
        proj.preco_atual          = overlay.preco_atual;
        proj.preco_min_historico  = overlay.preco_min_historico;
        proj.preco_max_historico  = overlay.preco_max_historico;
        proj.marketplace_vencedor = overlay.marketplace_vencedor;
        proj.data_verificacao     = overlay.data_verificacao;
        proj.marketplaces         = overlay.marketplaces;  // pra o render acessar cupom/preço/link por marketplace

        const mk = overlay.marketplaces || {};
        // Normaliza 'mercado_livre' (chave do prices.json) -> 'ml' (o que o resto do site espera).
        // Sem isso a pagina ML le mkts.ml / marketplace_vencedor==='ml' e quebra (botao sem preco, label cru).
        if (mk.mercado_livre && !mk.ml) mk.ml = mk.mercado_livre;
        if (proj.marketplace_vencedor === 'mercado_livre') proj.marketplace_vencedor = 'ml';
        if (mk.aliexpress && mk.aliexpress.link) proj.ali_url    = mk.aliexpress.link;
        if (mk.shopee     && mk.shopee.link)     proj.shopee_url = mk.shopee.link;
        if (mk.ml         && mk.ml.link)         proj.ml_url     = mk.ml.link;

        // Cupom Ali só quando o vencedor É AliExpress — senão levaria o usuário ao
        // caminho MAIS CARO (a Shopee/ML está mais barata). Mesma regra do /precos
        // (precos.js:165-166). Limpa o valor heurístico estático de projetores-data.js
        // quando o vencedor é Shopee/ML. (cupom_plataforma vem do checker via precos.db.)
        if (proj.marketplace_vencedor === 'aliexpress') {
          if (mk.aliexpress && mk.aliexpress.cupom)            proj.ali_cupom_loja  = mk.aliexpress.cupom;
          if (mk.aliexpress && mk.aliexpress.cupom_plataforma) proj.ali_cupom_promo = mk.aliexpress.cupom_plataforma;
        } else {
          proj.ali_cupom_loja  = '';
          proj.ali_cupom_promo = '';
        }

        merged++;
      } else if (indexIndisp.has(k)) {
        // Indisponível conhecido: zera preço para a regra existente filtrar
        proj.preco_min   = null;
        proj.preco_max   = null;
        proj.preco_atual = null;
        zerados++;
      }

      // Slug é independente do overlay de preço — uma página individual existe
      // mesmo que o produto esteja indisponível.
      const slug = indexSlug.get(k);
      if (slug) {
        proj.slug = slug;
        slugged++;
      }
    }

    return { merged, zerados, slugged };
  }

  /* Patch DOM em páginas individuais quando o produto está indisponível.
     Reescreve o card de preço com estado "Sem estoque" + subtítulo por motivo.
     Mantém link da loja (cookie de afiliado) exceto quando o anúncio foi retirado.
     Roda só em /projetor/{slug}.html — em outras páginas não tem .proj-price-card. */
  function patchIndisponiveisDOM(indisponiveis) {
    if (!indisponiveis || !indisponiveis.length) return;
    const card = document.querySelector('.proj-price-card[data-marca][data-modelo]');
    if (!card) return;

    const cardKey = norm(card.dataset.marca) + '|' + norm(card.dataset.modelo);
    let motivo = null;
    for (const x of indisponiveis) {
      if (norm(x.marca) + '|' + norm(x.modelo) === cardKey) {
        motivo = x.motivo;
        break;
      }
    }
    if (!motivo) return;

    // ─── 1. Badge no topo (.proj-badges) — sempre reescrito ─────────────────────
    const badgesContainer = document.querySelector('.proj-badges');
    if (badgesContainer) {
      const STATUS_RE = /^(Estoque nacional|Importado|Sem estoque|Esgotado|Anúncio retirado|Indispon[ií]vel)\b/i;
      badgesContainer.querySelectorAll('.proj-badge').forEach(function(b) {
        if (STATUS_RE.test(b.textContent.trim())) b.remove();
      });
      const labelBadgePorMotivo = {
        'sem_estoque_br':         'Sem estoque',
        'sem_estoque_importado':  'Importado',
        'indisponivel':           'Anúncio retirado'
      };
      const newBadge = document.createElement('span');
      newBadge.className = 'proj-badge proj-status-badge';
      newBadge.textContent = labelBadgePorMotivo[motivo] || 'Indisponível';
      badgesContainer.appendChild(newBadge);
    }

    // ─── 2. Aviso ao final do card (último <p style> dentro do .proj-price-card) ─
    // Substitui o texto hardcoded de cada página por um aviso padronizado por motivo.
    // Assim qualquer produto que entrar em sem_estoque_importado ganha automaticamente
    // o alerta de taxa de importação, sem precisar editar HTML.
    const avisos = card.querySelectorAll('p');
    const avisoEl = avisos[avisos.length - 1] || null;
    const avisoPorMotivo = {
      'sem_estoque_br':         'Anúncio está sem estoque agora. Acompanhe — costuma voltar.',
      'sem_estoque_importado':  '<strong>Produto importado</strong> — sujeito a taxa de importação cobrada pela Receita Federal. Prazo de entrega 15-30 dias e o preço pode variar com promoções e impostos.',
      'indisponivel':           'A loja retirou esse anúncio. Veja modelos parecidos em <a href="../comparar.html">/comparar</a>.'
    };
    if (avisoEl && avisoPorMotivo[motivo]) avisoEl.innerHTML = avisoPorMotivo[motivo];

    // ─── 3. sem_estoque_importado: NÃO reescrever preço/botões ──────────────────
    // Produto está vendendo (importado), o JS da página já renderizou preço Ali.
    // Só o badge e o aviso de taxa precisam ser reescritos (feito acima).
    if (motivo === 'sem_estoque_importado') return;

    // ─── 4. Demais motivos: card de preço vira "Sem estoque" ────────────────────
    const subtituloPorMotivo = {
      'sem_estoque_br': 'Anúncio sem estoque agora — costuma voltar',
      'indisponivel':   'Anúncio foi retirado pela loja'
    };
    const subtitulo = subtituloPorMotivo[motivo] || 'Sem disponibilidade no momento';

    const labelEl = card.querySelector('.proj-price-label');
    if (labelEl) labelEl.textContent = 'Status';

    const valueEl = card.querySelector('#projPriceValue, .proj-price-value');
    if (valueEl) valueEl.innerHTML = 'Sem estoque';

    const metaEl = card.querySelector('#projPriceMeta, .proj-price-meta');
    if (metaEl) metaEl.textContent = subtitulo;

    const btnsEl = card.querySelector('#projStoreBtns, .proj-store-btns');
    if (btnsEl) {
      if (motivo === 'indisponivel') {
        // Anúncio retirado — link morto, esconde botões
        btnsEl.style.display = 'none';
      } else {
        // Mantém botões pra gerar cookie de afiliado, mas troca preço por "Ver na loja"
        btnsEl.querySelectorAll('.store-price').forEach(function(el) {
          el.textContent = 'Ver na loja';
        });
        btnsEl.querySelectorAll('.winner-badge').forEach(function(el) { el.remove(); });
        btnsEl.querySelectorAll('.store-winner').forEach(function(el) {
          el.classList.remove('store-winner');
        });
      }
    }

    const cupomSlot = card.querySelector('#projCupomSlot');
    if (cupomSlot) cupomSlot.innerHTML = '';
  }

  /* Atualiza o JSON-LD (Product>offers) da página individual com o preço/disponibilidade
     AO VIVO do prices.json. As páginas são geradas só na entrada do produto, então sem isso
     o offers.price fica congelado na data de geração (Googlebot renderiza JS e lê este valor).
     Roda só em /projetor/{slug}.html (precisa do .proj-price-card com marca/modelo). */
  function patchJsonLdDOM(produtos, indisponiveis) {
    const card = document.querySelector('.proj-price-card[data-marca][data-modelo]');
    if (!card) return;
    const key = norm(card.dataset.marca) + '|' + norm(card.dataset.modelo);

    let live = null;
    for (const p of produtos || []) {
      if (norm(p.marca) + '|' + norm(p.modelo) === key) { live = p; break; }
    }
    let isOut = false;
    for (const x of indisponiveis || []) {
      if (norm(x.marca) + '|' + norm(x.modelo) === key) { isOut = true; break; }
    }
    if (!live && !isOut) return; // sem dado vivo e não listado: não mexe no estático

    const sellerMap = { aliexpress: 'AliExpress', shopee: 'Shopee', mercado_livre: 'Mercado Livre', ml: 'Mercado Livre' };
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const sc of scripts) {
      let obj;
      try { obj = JSON.parse(sc.textContent); } catch (e) { continue; }
      if (!obj || !obj.offers) continue;
      const off = obj.offers;
      const out = isOut || !live || !live.preco_atual;
      if (live && live.preco_atual) {
        off.price = (Math.round(live.preco_atual * 100) / 100).toFixed(2);
        const d = new Date(); d.setDate(d.getDate() + 7);
        off.priceValidUntil = d.toISOString().slice(0, 10);
      }
      off.availability = 'https://schema.org/' + (out ? 'OutOfStock' : 'InStock');
      if (live && live.marketplace_vencedor && off.seller && sellerMap[live.marketplace_vencedor]) {
        off.seller.name = sellerMap[live.marketplace_vencedor];
      }
      sc.textContent = JSON.stringify(obj, null, 2);
      break;
    }

    // Cupom: em pagina de vencedor != Ali e SEM cupom proprio, limpa o slot pra nao exibir
    // o cupom Ali estatico/legado (levaria ao caminho mais caro). mergeOverlay ja zerou os
    // cupons Ali injetados via JS; isto mata so o fallback SSR baked na pagina.
    if (live && live.marketplace_vencedor && live.marketplace_vencedor !== 'aliexpress') {
      const wmk = (live.marketplaces || {})[live.marketplace_vencedor] || {};
      if (!wmk.cupom) {
        const cslot = document.getElementById('projCupomSlot');
        if (cslot) cslot.innerHTML = '';
      }
    }
  }

  function applyOverlay() {
    const bp = basePath();
    const fetchPrices = fetch(bp + 'data/prices.json', { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      });
    // slugs.json é opcional — se falhar, site funciona sem links clicáveis nas ferramentas
    const fetchSlugs = fetch(bp + 'data/slugs.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });

    return Promise.all([fetchPrices, fetchSlugs])
      .then(function (results) {
        const j = results[0];
        const slugMap = results[1] || {};
        const meta = j.metadata || {};
        const result = mergeOverlay(j.produtos || [], meta.indisponiveis || [], slugMap);
        window.PRICES_METADATA = meta;
        window.SLUGS_MAP = slugMap;

        // Em /projetor/{slug}.html quando o produto está indisponivel, reescreve o card
        // de preço (o JS da própria página bate "return" se preco_atual é null, deixando
        // o texto hardcoded antigo).
        const indispList = meta.indisponiveis || [];
        const prodList = j.produtos || [];
        function runDomPatches() {
          patchIndisponiveisDOM(indispList);
          patchJsonLdDOM(prodList, indispList);
        }
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', runDomPatches);
        } else {
          runDomPatches();
        }

        if (location.search.indexOf('debug=1') !== -1) {
          console.log('[prices-overlay] ok — merged=' + result.merged + ' zerados=' + result.zerados + ' slugged=' + result.slugged + ' de ' + (window.PROJETORES_DATA || []).length + ' (atualizado_em=' + meta.atualizado_em + ')');
        }
        return result;
      })
      .catch(function (err) {
        console.warn('[prices-overlay] falhou, site usa dados estaticos:', err && err.message);
        return null;
      });
  }

  // Exporto basePath pra outros scripts (busca global usa pra montar URLs)
  window.SITE_BASE_PATH = basePath();
  window.PRICES_OVERLAY_READY = applyOverlay();
})();
