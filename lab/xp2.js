/* =======================================================================
   DOBÊ // OS  v4.0  —  "LUNA 2026"  (comportamento)
   =======================================================================
   ADITIVO E NÃO DESTRUTIVO. Carrega depois do script original, não altera
   uma linha dele, e onde precisa mudar comportamento ENVOLVE a função
   existente (wrapper) em vez de reescrevê-la.

   Nada aqui toca: checkout, links de compra, /plugin/, PACK_FILES, o
   player de áudio, nem qualquer id/classe que o script original use.

   Módulos:
     1. sistema de luz (o cursor é a fonte de luz do SO)
     2. ampliação dos ícones por proximidade (dock)
     3. inclinação das janelas (painel físico)
     4. atmosfera do desktop
     5. coreografia de entrada
     6. foco de janela
     7. abertura com origem (FLIP) + fechamento com física
     8. minimizar / maximizar
     9. "tocando agora" na taskbar
    10. protetor de tela (75s ocioso)
    11. propriedades (botão direito)
    12. tela azul (Konami)
   ======================================================================= */

(function(){
  'use strict';

  var $  = function(s,r){ return (r||document).querySelector(s); };
  var $$ = function(s,r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); };
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ====================================================================
     1+2+3. SISTEMA DE LUZ, DOCK E INCLINAÇÃO
     --------------------------------------------------------------------
     Um único loop em requestAnimationFrame alimenta tudo que reage ao
     mouse. O XP inteiro foi desenhado em volta de uma luz fixa no canto
     superior esquerdo; aqui essa luz passa a ser o cursor, e todo bisel
     recalcula sozinho via variáveis CSS.
     ==================================================================== */

  var mouseX = window.innerWidth * .5, mouseY = window.innerHeight * .35;
  var pending = false;

  window.addEventListener('mousemove', function(e){
    mouseX = e.clientX; mouseY = e.clientY;
    if(!pending){ pending = true; requestAnimationFrame(applyLight); }
  }, {passive:true});

  function applyLight(){
    pending = false;
    var w = window.innerWidth, h = window.innerHeight;

    /* luz global */
    root.style.setProperty('--lx', (mouseX / w).toFixed(4));
    root.style.setProperty('--ly', (mouseY / h).toFixed(4));

    /* brilho especular local — barra de título e botões */
    $$('.win.open').forEach(function(el){
      var r = el.getBoundingClientRect();
      if(r.width === 0) return;
      var px = ((mouseX - r.left) / r.width) * 100;
      el.style.setProperty('--wx', Math.max(-30, Math.min(130, px)).toFixed(1) + '%');

      /* inclinação: a janela se comporta como um painel físico na mão.
         só quando está focada, parada (sem arrastar) e sem maximizar. */
      if(reduce || el.classList.contains('dragging') ||
         el.classList.contains('xp2-max') || !el.classList.contains('xp2-focus') ||
         el.dataset.xpAnim === '1'){ return; }

      var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      var dx = Math.max(-1, Math.min(1, (mouseX - cx) / (r.width  * 1.6)));
      var dy = Math.max(-1, Math.min(1, (mouseY - cy) / (r.height * 1.6)));
      el.style.transform = 'perspective(1400px) rotateY(' + (dx * 2.4).toFixed(2) +
                           'deg) rotateX(' + (-dy * 2.0).toFixed(2) + 'deg)';
    });

    $$('.start-btn, .btn-download, .btn-xp').forEach(function(el){
      var r = el.getBoundingClientRect();
      if(r.width === 0) return;
      var px = ((mouseX - r.left) / r.width) * 100;
      el.style.setProperty('--wx', Math.max(-40, Math.min(140, px)).toFixed(1) + '%');
    });

    /* dock: as pastas crescem conforme o cursor chega perto */
    if(!reduce && w > 768){
      $$('.float-item .folder-3d').forEach(function(el){
        var r = el.getBoundingClientRect();
        if(r.width === 0) return;
        var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        var d  = Math.hypot(mouseX - cx, mouseY - cy);
        var mag = Math.max(0, 1 - d / 330);
        el.style.setProperty('--mag', (mag * mag).toFixed(3));
      });
    }
  }
  applyLight();

  /* ====================================================================
     4. ATMOSFERA — o desktop vira um lugar, não um fundo
     ==================================================================== */

  var desk = document.getElementById('desktop');
  if(desk){
    var atmos = document.createElement('div');
    atmos.className = 'xp26-atmos';
    atmos.innerHTML =
      '<div class="xp26-sky"></div>' +
      '<div class="xp26-sun"></div>' +
      '<div class="xp26-fog"><i></i><i></i><i></i></div>' +
      '<div class="xp26-bloom"></div>';
    desk.insertBefore(atmos, desk.firstChild);
  }

  /* ====================================================================
     5. COREOGRAFIA DE ENTRADA
     --------------------------------------------------------------------
     O sistema acorda em cascata em vez de aparecer inteiro de uma vez.
     ==================================================================== */

  if(typeof window.revealDesktop === 'function' && !reduce){
    var _reveal = window.revealDesktop;
    window.revealDesktop = function(){
      _reveal();
      var seq = [
        ['.float-item.f1', 1], ['.float-item.f2', 2],
        ['.float-item.f3', 3], ['.float-item.f4', 4],
        ['.sticker-stage', 2], ['.pack-feature', 5], ['.taskbar', 6]
      ];
      seq.forEach(function(pair){
        var el = $(pair[0]);
        if(!el) return;
        el.classList.add('xp26-enter', 'xp26-enter-d' + pair[1]);
        el.addEventListener('animationend', function once(){
          el.classList.remove('xp26-enter', 'xp26-enter-d' + pair[1]);
          el.removeEventListener('animationend', once);
        });
      });
    };
  }

  /* ====================================================================
     6. FOCO DE JANELA
     ==================================================================== */

  function setFocus(win){
    $$('.win').forEach(function(w){
      var on = (w === win);
      w.classList.toggle('xp2-focus', on);
      if(!on) w.style.transform = '';      /* solta a inclinação ao perder foco */
    });
    var id = win && win.id ? win.id.replace('win-','') : null;
    $$('.task-item').forEach(function(t){
      t.classList.toggle('active', !!id && t.dataset.id === id);
    });
  }

  if(typeof window.bringToFront === 'function'){
    var _btf = window.bringToFront;
    window.bringToFront = function(el){
      _btf(el);
      if(el && el.classList && el.classList.contains('win')) setFocus(el);
    };
  }

  /* ====================================================================
     7. ABERTURA COM ORIGEM (FLIP) + FECHAMENTO COM FÍSICA
     --------------------------------------------------------------------
     A janela nasce NO ÍCONE que a abriu e viaja com mola até o lugar.
     Ao fechar, ela cai para trás e desfoca em vez de sumir num quadro.
     ==================================================================== */

  var lastOrigin = null;
  document.addEventListener('click', function(e){
    var t = e.target.closest && e.target.closest('[data-section]');
    if(t) lastOrigin = t;
  }, true);

  if(typeof window.openSection === 'function'){
    var _open = window.openSection;
    window.openSection = function(id){
      var w = document.getElementById('win-' + id);
      var origin = lastOrigin;
      var wasOpen = w && w.classList.contains('open');

      if(w && !wasOpen) w.style.visibility = 'hidden';

      _open(id);                               /* comportamento original, intacto */

      if(w){
        w.classList.remove('xp2-min', 'xp26-closing');
        if(!wasOpen){
          w.style.transform = '';
          w.dataset.xpAnim = '1';              /* trava a inclinação durante a abertura */
          try{
            if(origin){
              var wr = w.getBoundingClientRect(), or = origin.getBoundingClientRect();
              var dx = (or.left + or.width/2)  - (wr.left + wr.width/2);
              var dy = (or.top  + or.height/2) - (wr.top  + wr.height/2);
              w.style.setProperty('--ox', Math.round(dx) + 'px');
              w.style.setProperty('--oy', Math.round(dy) + 'px');
              w.style.setProperty('--os', '.7');
            } else {
              w.style.setProperty('--ox','0px');
              w.style.setProperty('--oy','0px');
              w.style.setProperty('--os','.82');
            }
            w.style.animation = 'none';
            void w.offsetWidth;                /* reflow: reinicia a animação */
            w.style.animation = '';
          }catch(err){}

          var done = function(){
            w.dataset.xpAnim = '0';
            w.style.animation = 'none';        /* libera o transform para a inclinação */
            w.removeEventListener('animationend', done);
          };
          w.addEventListener('animationend', done);
          setTimeout(done, 700);               /* rede de segurança */
        }
        w.style.visibility = '';
        setFocus(w);
      }
      lastOrigin = null;
    };
  }

  /* fechamento: intercepta na CAPTURA, antes do handler original */
  document.addEventListener('click', function(e){
    var b = e.target.closest && e.target.closest('.win .cls');
    if(!b) return;
    var w = b.closest('.win');
    if(!w || !w.classList.contains('open') || reduce) return;

    w.style.transform = '';
    w.style.animation = '';
    w.classList.add('xp26-closing');
    setTimeout(function(){
      w.classList.remove('xp26-closing','xp2-min','xp2-max','xp2-focus');
      w.style.animation = '';
    }, 310);
  }, true);

  /* ====================================================================
     8. MINIMIZAR / MAXIMIZAR
     --------------------------------------------------------------------
     Os botões "_" e "□" existiam desenhados, sem função — a maior fonte
     de "fantasia de XP". O "×" continua com o handler ORIGINAL.
     ==================================================================== */

  document.addEventListener('click', function(e){
    var b = e.target.closest && e.target.closest('.title-btns button');
    if(!b || b.classList.contains('cls')) return;
    var w = b.closest('.win');
    if(!w) return;
    e.stopPropagation();

    w.style.transform = '';
    if((b.textContent || '').trim() === '_'){
      w.classList.add('xp2-min');
      $$('.win').forEach(function(x){ x.classList.remove('xp2-focus'); });
    } else {
      w.classList.toggle('xp2-max');
      setFocus(w);
    }
  });

  var bar = document.getElementById('taskItems');
  if(bar){
    bar.addEventListener('click', function(e){
      var it = e.target.closest('.task-item');
      if(!it) return;
      var w = document.getElementById('win-' + it.dataset.id);
      if(!w) return;
      if(w.classList.contains('xp2-min')){ w.classList.remove('xp2-min'); setFocus(w); }
      else if(w.classList.contains('xp2-focus')){ w.classList.add('xp2-min'); w.classList.remove('xp2-focus'); }
      else setFocus(w);
    }, true);
  }

  /* clicar no vazio tira o foco de todas */
  if(desk){
    desk.addEventListener('mousedown', function(e){
      if(e.target.closest('.win') || e.target.closest('.taskbar') ||
         e.target.closest('.start-menu') || e.target.closest('[data-section]')) return;
      $$('.win').forEach(function(w){ w.classList.remove('xp2-focus'); w.style.transform = ''; });
      $$('.task-item').forEach(function(t){ t.classList.remove('active'); });
    });
  }

  /* "↑" (subir um nível) = voltar ao desktop */
  $$('.toolbar .btn-xp').forEach(function(b){
    if((b.textContent || '').trim() !== '↑') return;
    b.addEventListener('click', function(e){
      var w = e.target.closest('.win');
      var cls = w && w.querySelector('.title-btns .cls');
      if(cls) cls.click();
    });
  });

  /* ====================================================================
     9. "TOCANDO AGORA" NA TASKBAR
     --------------------------------------------------------------------
     O desktop passa a reagir ao que você está ouvindo. Envolve togglePlay
     e stopCurrent sem alterar uma linha do player original.
     ==================================================================== */

  var np = document.createElement('div');
  np.className = 'xp26-np';
  np.innerHTML = '<span class="vu"><i></i><i></i><i></i><i></i></span><span class="nm"></span>';
  var tray = $('.taskbar .tray');
  if(tray && tray.parentNode) tray.parentNode.insertBefore(np, tray);

  var eq = $('.winamp-eq');
  function refreshNowPlaying(){
    var row = $('.file-row.playing');
    if(row){
      var spans = row.querySelectorAll('.fname > span');
      var nome = spans.length > 1 ? spans[1].textContent : 'tocando';
      np.querySelector('.nm').textContent = nome;
      np.classList.add('on');
      if(eq) eq.classList.add('hot');
    } else {
      np.classList.remove('on');
      if(eq) eq.classList.remove('hot');
    }
  }
  ['togglePlay','stopCurrent'].forEach(function(fn){
    if(typeof window[fn] !== 'function') return;
    var orig = window[fn];
    window[fn] = function(){
      var r = orig.apply(this, arguments);
      setTimeout(refreshNowPlaying, 30);
      return r;
    };
  });
  setInterval(refreshNowPlaying, 900);   /* cobre o fim natural do sample */

  /* ====================================================================
     10. PROTETOR DE TELA — 75s parado (easter egg)
     --------------------------------------------------------------------
     O "Starfield" do Windows, refeito. Qualquer input devolve o sistema.
     ==================================================================== */

  var saver = document.createElement('div');
  saver.className = 'xp26-saver';
  saver.innerHTML = '<canvas></canvas><div class="hint">MOVA O MOUSE PARA CONTINUAR</div>';
  document.body.appendChild(saver);

  var sc = saver.querySelector('canvas'), sctx = sc.getContext('2d');
  var stars = [], saverOn = false, idleT = null, rafS = null;

  function seedStars(){
    sc.width = window.innerWidth; sc.height = window.innerHeight;
    stars = [];
    for(var i = 0; i < 420; i++){
      stars.push({ x:(Math.random()-.5)*sc.width, y:(Math.random()-.5)*sc.height, z:Math.random()*sc.width });
    }
  }
  function drawStars(){
    if(!saverOn) return;
    var cx = sc.width/2, cy = sc.height/2;
    sctx.fillStyle = 'rgba(0,0,0,.34)';
    sctx.fillRect(0,0,sc.width,sc.height);
    for(var i = 0; i < stars.length; i++){
      var s = stars[i];
      s.z -= 5.2;
      if(s.z <= 1){ s.z = sc.width; s.x = (Math.random()-.5)*sc.width; s.y = (Math.random()-.5)*sc.height; }
      var k  = 128 / s.z;
      var px = cx + s.x * k, py = cy + s.y * k;
      if(px < 0 || px >= sc.width || py < 0 || py >= sc.height) continue;
      var size = (1 - s.z / sc.width) * 3.4;
      var a    = Math.min(1, (1 - s.z / sc.width) * 1.6);
      sctx.fillStyle = 'rgba(' + (170 + Math.round(a*85)) + ',' +
                                 (205 + Math.round(a*50)) + ',255,' + a.toFixed(2) + ')';
      sctx.fillRect(px, py, size, size);
    }
    rafS = requestAnimationFrame(drawStars);
  }
  function startSaver(){
    if(saverOn || reduce) return;
    if($('.xp2-bsod.on')) return;
    saverOn = true; seedStars();
    saver.classList.add('on');
    sctx.fillStyle = '#000'; sctx.fillRect(0,0,sc.width,sc.height);
    drawStars();
  }
  function stopSaver(){
    if(!saverOn) return;
    saverOn = false;
    if(rafS) cancelAnimationFrame(rafS);
    saver.classList.remove('on');
  }
  function poke(){
    if(saverOn) stopSaver();
    clearTimeout(idleT);
    idleT = setTimeout(startSaver, 75000);
  }
  ['mousemove','mousedown','keydown','touchstart','wheel'].forEach(function(ev){
    window.addEventListener(ev, poke, {passive:true});
  });
  window.addEventListener('resize', function(){ if(saverOn) seedStars(); });
  poke();

  /* ====================================================================
     11. PROPRIEDADES (botão direito)
     ==================================================================== */

  var FICHA = {
    drumkits:{ nome:'DRUM_KIT', tipo:'Pasta de sistema', itens:'161 samples + 137 presets',
               formato:'.WAV · .AIF · .MP3', estado:'Disponível', nota:'Pack completo DOBÊ' },
    presets: { nome:'PRESETS', tipo:'Pasta de sistema', itens:'—',
               formato:'Serum · Vital · Phase Plant', estado:'Em preparação', nota:'Conteúdo em produção' },
    templates:{nome:'TEMPLATES', tipo:'Pasta de sistema', itens:'—',
               formato:'FL Studio · Ableton · Logic', estado:'Em preparação', nota:'Conteúdo em produção' },
    freedl:  { nome:'DOBE_DRUMS_PLUGIN', tipo:'Aplicativo', itens:'1 produto',
               formato:'VST3 · Standalone', estado:'Disponível', nota:'Windows 64-bit' },
    pack:    { nome:'DOBÊ — Pack Completo', tipo:'Arquivo compactado', itens:'161 arquivos',
               formato:'.WAV · .AIF · .MP3', estado:'Disponível', nota:'Entrega pela Hotmart' }
  };

  var props = document.createElement('div');
  props.className = 'win xp2-props';
  props.innerHTML =
    '<div class="title"><b>Propriedades</b>' +
      '<div class="title-btns"><button class="cls" type="button" aria-label="Fechar">×</button></div></div>' +
    '<div class="tabs"><span class="on">Geral</span><span>Detalhes</span></div>' +
    '<div class="sheet"><div class="ic"></div><div class="nm"></div><hr>' +
      '<dl><dt>Tipo</dt><dd data-f="tipo"></dd>' +
      '<dt>Conteúdo</dt><dd data-f="itens"></dd>' +
      '<dt>Formato</dt><dd data-f="formato"></dd>' +
      '<dt>Estado</dt><dd data-f="estado"></dd>' +
      '<dt>Observação</dt><dd data-f="nota"></dd></dl>' +
      '<div class="acts"><button class="btn-xp" type="button">OK</button></div></div>';
  document.body.appendChild(props);

  function fecharProps(){ props.classList.remove('open'); }
  props.querySelector('.cls').addEventListener('click', fecharProps);
  props.querySelector('.acts .btn-xp').addEventListener('click', fecharProps);

  document.addEventListener('contextmenu', function(e){
    var t = e.target.closest && e.target.closest('[data-section]');
    if(!t) return;
    var d = FICHA[t.dataset.section];
    if(!d) return;
    e.preventDefault();
    props.querySelector('.nm').textContent = d.nome;
    Object.keys(d).forEach(function(k){
      var el = props.querySelector('[data-f="' + k + '"]');
      if(el) el.textContent = d[k];
    });
    props.style.left = Math.min(e.clientX, window.innerWidth  - 350) + 'px';
    props.style.top  = Math.min(e.clientY, window.innerHeight - 400) + 'px';
    props.classList.add('open');
  });

  if(typeof window.makeDraggable === 'function'){
    try{ window.makeDraggable(props); }catch(err){}
  }

  /* ====================================================================
     12. TELA AZUL — Konami (↑↑↓↓←→←→ B A)
     ==================================================================== */

  var bsod = document.createElement('div');
  bsod.className = 'xp2-bsod';
  bsod.innerHTML =
    '<h4>DOBÊ_OS</h4>' +
    '<p>Um problema foi detectado e o sistema foi encerrado para evitar danos ao groove.</p>' +
    '<p>GROOVE_TOO_HARD</p>' +
    '<p>Se esta é a primeira vez que você vê esta tela, reinicie o sistema.<br>' +
    'Se ela aparecer de novo, abaixe o kick 2 dB.</p>' +
    '<p>*** STOP: 0x000000DB (0xBEA75, 0xB1D0BE, 0x00F0FF, 0xD92525)</p>' +
    '<p style="margin-top:30px">Pressione qualquer tecla para continuar <span class="blinkc">_</span></p>';
  document.body.appendChild(bsod);

  var KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown',
                'ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
  var buf = [];
  document.addEventListener('keydown', function(e){
    if(bsod.classList.contains('on')){ bsod.classList.remove('on'); return; }
    buf.push(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    if(buf.length > KONAMI.length) buf.shift();
    if(buf.join(',') === KONAMI.join(',')){ buf = []; bsod.classList.add('on'); }
  });

  /* estado inicial */
  $$('.win.open').forEach(function(w){ w.classList.add('xp2-focus'); });

})();
