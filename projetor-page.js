/* projetor-page.js — logica compartilhada das paginas /projetor/ (extraida 10/06/2026,
   auditoria T2). Substitui os blocos inline applyHeroOverlay + applyHistoryChart que
   estavam duplicados nas 69 paginas com drift entre 8 variantes.
   Canonico: hero = template do D10S (cupom escondido quando produto sem preco vivo);
   chart = algoritmo das 66 paginas (labels de todos os dias, spanGaps:false, media dos
   minimos diarios). Mudancas vs inline: fetch do historico com cache default (era
   no-store) + nota de dados-offline no banner quando o fetch falha.
   Carregado com <script src="../projetor-page.js" defer> — depois de projetores-data.js
   e prices-overlay.js. Fica inline por pagina: gtag, PRICE_HISTORY + initPriceChart
   (exposto como window.__initStaticChart — chamado aqui quando o grafico entra na
   viewport, junto da injecao lazy do ../chart.umd.min.js local).
   Redesign 10/06/2026: facade do YouTube (player so carrega no clique) +
   Chart.js/prices-history.json lazy via IntersectionObserver. */

(function ytFacade() {
      // Player do YouTube (~1MB+ de JS) so carrega quando o visitante clica na thumb.
      document.addEventListener('click', function(e) {
        var btn = e.target && e.target.closest ? e.target.closest('.yt-facade') : null;
        if (!btn) return;
        var id = btn.getAttribute('data-ytid');
        if (!id) return;
        var iframe = document.createElement('iframe');
        var extra = btn.getAttribute('data-ytparams');  // ex: "start=49"
        iframe.src = 'https://www.youtube.com/embed/' + encodeURIComponent(id) + '?autoplay=1' + (extra ? '&' + extra : '');
        iframe.title = btn.getAttribute('data-yttitle') || 'Vídeo do canal SchardTech';
        iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
        iframe.setAttribute('allowfullscreen', '');
        // sem estilo inline: o iframe herda o CSS do contexto (.proj-video-wrap iframe / .video-card iframe)
        btn.parentNode.replaceChild(iframe, btn);
      }, false);

      // Aquece DNS+TLS do player no primeiro hover/toque na thumb
      var warmed = false;
      document.addEventListener('pointerover', function(e) {
        if (warmed || !e.target || !e.target.closest || !e.target.closest('.yt-facade')) return;
        warmed = true;
        ['https://www.youtube.com', 'https://www.google.com'].forEach(function(h) {
          var l = document.createElement('link');
          l.rel = 'preconnect';
          l.href = h;
          document.head.appendChild(l);
        });
      }, true);
    })();

(function applyHeroOverlay() {
      function fmtBRL(v) {
        if (v == null) return null;
        return Number(v).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
      }
      function mkLabel(mk) {
        return ({aliexpress: 'AliExpress', shopee: 'Shopee', ml: 'Mercado Livre', amazon: 'Amazon'})[mk] || mk;
      }
      function fmtData(s) {
        if (!s) return null;
        var m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
        return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
      }
      function norm(s) { return String(s||'').trim().toLowerCase(); }

      function run() {
        var card = document.querySelector('.proj-price-card');
        if (!card) return;
        var marca = card.dataset.marca, modelo = card.dataset.modelo;
        if (!marca || !modelo) return;
        var data = window.PROJETORES_DATA;
        if (!Array.isArray(data)) return;
        var key = norm(marca) + '|' + norm(modelo);
        var p = data.find(function(x) { return norm(x.marca)+'|'+norm(x.modelo) === key; });
        if (!p || !p.preco_atual) return;

        // Atualiza preço principal
        var brl = fmtBRL(p.preco_atual);
        if (brl) {
          var parts = brl.split(',');
          var valEl = document.getElementById('projPriceValue');
          if (valEl) valEl.innerHTML = 'R$ ' + parts[0] + '<span class="proj-price-cents">,' + parts[1] + '</span>';
        }

        // Meta: data + marketplace vencedor
        var metaEl = document.getElementById('projPriceMeta');
        if (metaEl) {
          var partsMeta = [];
          var d = fmtData(p.data_verificacao);
          if (d) partsMeta.push('Verificado em ' + d);
          if (p.marketplace_vencedor) partsMeta.push(mkLabel(p.marketplace_vencedor));
          if (partsMeta.length) metaEl.textContent = partsMeta.join(' · ');
        }

        // Botões de loja: ordena por preço
        var mkts = p.marketplaces || {};
        var btns = [];
        function btn(href, klass, inner, preco) {
          var precoStr = preco ? 'R$ ' + Math.round(preco).toLocaleString('pt-BR') : 'Ver preço';
          return '<a href="' + href + '" target="_blank" rel="noopener nofollow sponsored" class="proj-store-btn ' + klass + '">' +
                 '<span class="store-name">' + inner + '</span>' +
                 '<span class="store-price">' + precoStr + '</span></a>';
        }
        if (p.ali_url)    btns.push({preco: (mkts.aliexpress && mkts.aliexpress.preco) || Infinity, html: btn(p.ali_url,    'store-ali',    '<img src="../logo ali.svg" alt="AliExpress" class="store-logo">', mkts.aliexpress && mkts.aliexpress.preco)});
        if (p.shopee_url) btns.push({preco: (mkts.shopee     && mkts.shopee.preco)     || Infinity, html: btn(p.shopee_url, 'store-shopee', '<img src="../logo shopee.png" alt="Shopee" class="store-logo">', mkts.shopee     && mkts.shopee.preco)});
        if (p.ml_url)     btns.push({preco: (mkts.ml         && mkts.ml.preco)         || Infinity, html: btn(p.ml_url,     'store-ml',     '<img src="../logo ml2.png" alt="" class="store-logo">Mercado Livre', mkts.ml         && mkts.ml.preco)});
        if (btns.length) {
          btns.sort(function(a,b) { return a.preco - b.preco; });
          if (btns.length > 1 && btns[0] && isFinite(btns[0].preco)) {
            btns[0].html = btns[0].html
              .replace('class="proj-store-btn ', 'class="proj-store-btn store-winner ')
              .replace('<span class="store-name">', '<span class="winner-badge">Melhor preço</span><span class="store-name">');
          }
          var slot = document.getElementById('projStoreBtns');
          if (slot) slot.innerHTML = btns.map(function(b){return b.html;}).join('');
        }

        // Cupons: loja + plataforma (os dois que aparecem no anúncio)
        var venc = mkts[p.marketplace_vencedor] || {};
        var cupons = [];
        var cupomLoja = venc.cupom || p.ali_cupom_loja;
        if (cupomLoja) cupons.push({rotulo: 'Cupom da loja', cod: cupomLoja});
        if (venc.cupom_plataforma) cupons.push({rotulo: 'Cupom AliExpress', cod: venc.cupom_plataforma});
        if (cupons.length) {
          var slot = document.getElementById('projCupomSlot');
          if (slot) {
            slot.innerHTML = cupons.map(function(cp, i) {
              return '<div class="proj-coupon"' + (i ? ' style="margin-top:8px;"' : '') + '>' +
                '<span>' + cp.rotulo + ': <code>' + cp.cod + '</code></span>' +
                '<button class="copy-btn" type="button" data-cod="' + cp.cod + '">Copiar</button>' +
                '</div>';
            }).join('');
            slot.querySelectorAll('.copy-btn').forEach(function(b) {
              b.addEventListener('click', function() {
                navigator.clipboard.writeText(b.getAttribute('data-cod'));
                b.textContent = 'Copiado!';
                setTimeout(function() { b.textContent = 'Copiar'; }, 1800);
              });
            });
          }
        }
      }

      function waitAndRun() {
        if (window.PRICES_OVERLAY_READY && typeof window.PRICES_OVERLAY_READY.then === 'function') {
          window.PRICES_OVERLAY_READY.then(run).catch(function(){ run(); });
        } else {
          setTimeout(waitAndRun, 50);
        }
      }
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', waitAndRun);
      else waitAndRun();
    })();

(function applyHistoryChart() {
      function norm(s) { return String(s || '').trim().toLowerCase(); }
      function fmtBRL(v) { return 'R$ ' + Number(v).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2}); }
      function fmtDataChart(s) {
        // "2026-05-14 09:00" → "14/05"
        var m = String(s||'').match(/^\d{4}-(\d{2})-(\d{2})/);
        return m ? (m[2] + '/' + m[1]) : s;
      }

      function run() {
        var card = document.querySelector('.proj-price-card');
        if (!card) return;
        var marca = card.dataset.marca, modelo = card.dataset.modelo;
        if (!marca || !modelo) return;

        var bp = (window.SITE_BASE_PATH || '../');
        fetch(bp + 'data/prices-history.json')  // cache default: max-age=600 do Pages cobre as 4 rodadas/dia
          .then(function(r) { return r.ok ? r.json() : null; })
          .then(function(j) {
            if (!j || !j.modelos) return;
            // Match case-insensitive nas chaves Marca|Modelo
            var key = norm(marca) + '|' + norm(modelo);
            var found = null;
            for (var k in j.modelos) {
              if (norm(k) === key) { found = j.modelos[k]; break; }
            }
            if (!found || !found.pontos || !found.pontos.length) return;

            renderChart(found);
          })
          .catch(function() {
            // Fetch falhou: banner/grafico exibem o snapshot assado na geracao da pagina.
            var st = document.getElementById('priceStatus');
            if (st && !st.querySelector('.ps-stale')) {
              var sub = st.querySelector('.ps-sub');
              var sp = document.createElement('span');
              sp.className = 'ps-stale';
              sp.textContent = ' (sem conexao com os precos ao vivo — dados de quando a pagina foi gerada)';
              (sub || st).appendChild(sp);
            }
          });
      }

      function renderChart(historico) {
        if (typeof Chart === 'undefined') { setTimeout(function(){ renderChart(historico); }, 100); return; }

        // Agrupa pontos por loja, mantendo ordem temporal
        var pontos = historico.pontos.slice().sort(function(a, b) {
          return (a.data || '').localeCompare(b.data || '');
        });

        var lojasDisponiveis = {};
        pontos.forEach(function(p) { lojasDisponiveis[p.loja] = true; });

        // Labels cobrem TODOS os dias do primeiro ponto ate hoje (inclusive os sem
        // dado). Dias sem ponto viram null na serie -> spanGaps:false quebra a linha
        // visualmente, em vez de ligar dois dias separados por uma semana de OOS.
        var firstDate = new Date(pontos[0].data.substr(0,10) + 'T00:00:00');
        var today = new Date(); today.setHours(0,0,0,0);
        var labels = [];
        for (var d = new Date(firstDate); d <= today; d.setDate(d.getDate() + 1)) {
          labels.push(('0'+d.getDate()).slice(-2) + '/' + ('0'+(d.getMonth()+1)).slice(-2));
        }

        // Pra cada label, pega o ÚLTIMO preço de cada loja naquele dia
        function serieDeLoja(loja) {
          var serie = [];
          labels.forEach(function(lbl) {
            var ponto = null;
            pontos.forEach(function(p) {
              if (p.loja === loja && fmtDataChart(p.data) === lbl) ponto = p;
            });
            serie.push(ponto ? ponto.preco : null);
          });
          return serie;
        }

        var lojasMeta = {
          aliexpress: { label: 'AliExpress', color: '#8FD3FF' },
          shopee:     { label: 'Shopee',     color: '#FF7A45' },
          ml:         { label: 'Mercado Livre', color: '#FFD93D' }
        };

        // Redesign 10/06/2026: com 120 dias de janela, bolinha em todo ponto
        // virava "lagarta" — pontos somem em série longa (hover continua via
        // pointHitRadius). Buraco de coleta vira trecho TRACEJADO em vez de
        // linha quebrada (tracejado = sem dado naquele dia, honesto e legível).
        var muitosPontos = labels.length > 35;
        var datasets = [];
        Object.keys(lojasMeta).forEach(function(loja) {
          if (!lojasDisponiveis[loja]) return;
          var meta = lojasMeta[loja];
          datasets.push({
            label: meta.label,
            data: serieDeLoja(loja),
            borderColor: meta.color,
            backgroundColor: meta.color + '22',
            pointBackgroundColor: meta.color,
            pointBorderColor: 'rgba(11,11,11,0.6)',
            pointBorderWidth: 2,
            pointRadius: muitosPontos ? 0 : 4,
            pointHoverRadius: 7,
            pointHitRadius: 16,
            borderWidth: 2.5,
            tension: 0.25,
            spanGaps: true,
            segment: {
              borderDash: function(s) { return (s.p0.skip || s.p1.skip) ? [5, 5] : undefined; }
            }
          });
        });

        // Loja única: degradê sob a linha (estilo CoinGecko). Com 2+ lojas os
        // preenchimentos se sobrepõem e viram lama — fica só a linha.
        if (datasets.length === 1) {
          var corFill = datasets[0].borderColor;
          datasets[0].fill = 'origin';
          datasets[0].backgroundColor = function(c) {
            var area = c.chart.chartArea;
            if (!area) return corFill + '14';
            var g = c.chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
            g.addColorStop(0, corFill + '30');
            g.addColorStop(1, corFill + '00');
            return g;
          };
        }

        var menor = historico.min;
        var maior = historico.max;
        // média dos mínimos diários — MESMA régua do banner (media-minimos-diarios-2026-05-31)
        var media = (function(){ var d={}; pontos.forEach(function(p){var k=p.data.slice(0,10); if(d[k]==null||p.preco<d[k])d[k]=p.preco;}); var a=Object.keys(d).map(function(k){return d[k];}); return a.reduce(function(x,y){return x+y;},0)/a.length; })();

        // Destrói chart antigo (Chart.js v4)
        var canvas = document.getElementById('priceChart');
        if (!canvas) return;
        var existing = Chart.getChart(canvas);
        if (existing) existing.destroy();

        var minLinePlugin = {
          id: 'minLine',
          afterDatasetsDraw: function(chart) {
            var ctx = chart.ctx, area = chart.chartArea, scales = chart.scales;
            var y = scales.y.getPixelForValue(menor);
            if (y < area.top || y > area.bottom) return;
            ctx.save();
            ctx.setLineDash([4, 4]);
            ctx.strokeStyle = 'rgba(91,217,160,0.55)';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(area.left, y);
            ctx.lineTo(area.right, y);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = 'rgba(91,217,160,0.95)';
            ctx.font = '600 10px Inter, sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText('▼ menor já visto', area.right - 6, y - 6);
            ctx.restore();
          }
        };

        // Linha da MÉDIA histórica — o banner fala "X% abaixo da média";
        // agora a referência aparece no gráfico em vez de só no texto.
        var mediaLinePlugin = {
          id: 'mediaLine',
          afterDatasetsDraw: function(chart) {
            var ctx = chart.ctx, area = chart.chartArea, scales = chart.scales;
            var y = scales.y.getPixelForValue(media);
            if (y < area.top || y > area.bottom) return;
            ctx.save();
            ctx.setLineDash([2, 5]);
            ctx.strokeStyle = 'rgba(234,234,234,0.30)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(area.left, y);
            ctx.lineTo(area.right, y);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = 'rgba(234,234,234,0.55)';
            ctx.font = '600 10px Inter, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText('média', area.left + 6, y - 5);
            ctx.restore();
          }
        };

        var chart = new Chart(canvas.getContext('2d'), {
          type: 'line',
          data: { labels: labels, datasets: datasets },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            // 'index': hover num dia mostra TODAS as lojas daquele dia juntas
            interaction: { mode: 'index', intersect: false },
            animation: { duration: 700, easing: 'easeOutCubic' },
            layout: { padding: { top: 20, right: 10, left: 0, bottom: 0 } },
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: 'rgba(20,24,43,0.95)',
                titleColor: '#EAEAEA',
                titleFont: { weight: '600', size: 12 },
                bodyColor: '#EAEAEA',
                bodyFont: { size: 12 },
                padding: 12,
                borderColor: 'rgba(79,163,199,0.42)',
                borderWidth: 1,
                displayColors: true,
                boxPadding: 4,
                callbacks: {
                  title: function(items) { return items.length ? 'Dia ' + items[0].label : ''; },
                  label: function(item) {
                    if (item.parsed.y == null) return null;
                    var loja = item.dataset.label;
                    var valor = fmtBRL(item.parsed.y);
                    var diff = item.parsed.y - menor;
                    if (diff <= 0.5) return loja + ': ' + valor + '  · 🟢 menor preço';
                    return loja + ': ' + valor + '  · ' + fmtBRL(diff) + ' acima do menor';
                  }
                }
              }
            },
            scales: {
              x: { grid: { color: 'rgba(234,234,234,0.04)' }, ticks: { color: 'rgba(234,234,234,0.55)', maxTicksLimit: 8, maxRotation: 0 } },
              y: {
                grid: { color: 'rgba(234,234,234,0.05)' },
                ticks: { color: 'rgba(234,234,234,0.55)', callback: function(v) { return 'R$ ' + v.toLocaleString('pt-BR'); } },
                suggestedMin: menor * 0.92,
                suggestedMax: maior * 1.08
              }
            }
          },
          plugins: [minLinePlugin, mediaLinePlugin]
        });

        // Atualiza chips de filtro: cria um chip por loja disponível
        var filtersWrap = document.querySelector('.price-filters');
        if (filtersWrap) {
          // Limpa todos exceto o "Todos"
          var todos = filtersWrap.querySelector('[data-filter="todos"]');
          filtersWrap.innerHTML = '';
          if (todos) filtersWrap.appendChild(todos);
          else {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'filter-chip active';
            btn.dataset.filter = 'todos';
            btn.setAttribute('aria-pressed', 'true');
            btn.textContent = 'Todos';
            filtersWrap.appendChild(btn);
          }
          datasets.forEach(function(ds, idx) {
            var chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'filter-chip active';
            chip.dataset.filter = ds.label.toLowerCase().replace(/\s+/g, '-');
            chip.setAttribute('aria-pressed', 'true');
            chip.textContent = ds.label;
            chip.style.color = ds.borderColor;
            chip.addEventListener('click', function() {
              chip.classList.toggle('active');
              chart.setDatasetVisibility(idx, chip.classList.contains('active'));
              chart.update();
            });
            filtersWrap.appendChild(chip);
          });
          var todosChip = filtersWrap.querySelector('[data-filter="todos"]');
          if (todosChip) {
            todosChip.onclick = function() {
              var allActive = todosChip.classList.toggle('active');
              filtersWrap.querySelectorAll('.filter-chip').forEach(function(c) {
                c.classList.toggle('active', allActive);
              });
              datasets.forEach(function(_, i) { chart.setDatasetVisibility(i, allActive); });
              chart.update();
            };
          }
        }

        // Atualiza stats grid (media já calculada antes do chart — mesma régua)
        var statsWrap = document.querySelector('.price-stats-grid');
        if (statsWrap) {
          statsWrap.innerHTML =
            '<div class="price-stat min"><div class="label">Mínimo histórico</div><div class="val">' + fmtBRL(menor) + '</div></div>' +
            '<div class="price-stat"><div class="label">Preço médio</div><div class="val">' + fmtBRL(media) + '</div></div>' +
            '<div class="price-stat max"><div class="label">Máximo histórico</div><div class="val">' + fmtBRL(maior) + '</div></div>';
        }

        // Atualiza banner status — compara com PREÇO MÉDIO (estatisticamente neutro)
        var statusEl = document.getElementById('priceStatus');
        if (statusEl) {
          var dataMaisRecente = '';
          pontos.forEach(function(p) { if (p.data > dataMaisRecente) dataMaisRecente = p.data.slice(0, 10); });
          var precosHoje = pontos.filter(function(p) { return p.data.slice(0, 10) === dataMaisRecente; }).map(function(p) { return p.preco; });
          var atual = precosHoje.length ? Math.min.apply(null, precosHoje) : pontos[pontos.length - 1].preco;
          var distMedia = ((atual - media) / media) * 100;
          var icon, classe, titulo, sub;
          if (distMedia <= -3) {
            icon = '🟢'; classe = 'good';
            titulo = Math.abs(Math.round(distMedia)) + '% abaixo da média histórica';
            sub = 'Atualmente em ' + fmtBRL(atual) + '. Média histórica: ' + fmtBRL(media) + '.';
          } else if (distMedia < 3) {
            icon = '🔵'; classe = 'neutral';
            titulo = 'Preço no patamar médio';
            sub = 'Atualmente em ' + fmtBRL(atual) + '. Média histórica: ' + fmtBRL(media) + '.';
          } else {
            icon = '🔴'; classe = 'bad';
            titulo = '+' + Math.round(distMedia) + '% acima da média histórica';
            sub = 'Atualmente em ' + fmtBRL(atual) + '. Média histórica: ' + fmtBRL(media) + '.';
          }
          statusEl.className = 'price-status ' + classe;
          statusEl.innerHTML = '<span class="ps-icon">' + icon + '</span><div><strong>' + titulo + '</strong><span class="ps-sub">' + sub + '</span></div>';
        }
        // <!-- banner-vs-media-fix-2026-05-14 -->
      }

      // Espera o overlay de prices.json terminar (carrega na mesma rodada) ou roda direto
      function start() {
        if (window.PRICES_OVERLAY_READY && typeof window.PRICES_OVERLAY_READY.then === 'function') {
          window.PRICES_OVERLAY_READY.then(run).catch(function() { run(); });
        } else {
          run();
        }
      }

      // Lazy (10/06/2026): Chart.js (~70KB) + prices-history.json (~45KB) so
      // baixam quando a secao do grafico se aproxima da viewport (600px antes).
      // O snapshot estatico da pagina (window.__initStaticChart) renderiza
      // primeiro; o run() substitui com o historico vivo.
      function fire() {
        if (fire.done) return;
        fire.done = true;
        if (typeof Chart === 'undefined' && !document.querySelector('script[src*="chart.umd.min.js"]')) {
          var s = document.createElement('script');
          s.src = (window.SITE_BASE_PATH || '../') + 'chart.umd.min.js';
          document.head.appendChild(s);
        }
        if (typeof window.__initStaticChart === 'function') {
          try { window.__initStaticChart(); } catch (e) {}
        }
        start();
      }
      function boot() {
        var wrap = document.querySelector('.price-chart-wrap');
        if (!wrap) return;
        if ('IntersectionObserver' in window) {
          var io = new IntersectionObserver(function(entries) {
            for (var i = 0; i < entries.length; i++) {
              if (entries[i].isIntersecting) { io.disconnect(); fire(); break; }
            }
          }, { rootMargin: '600px 0px' });
          io.observe(wrap);
        } else {
          fire();
        }
      }
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
      else boot();
    })();
