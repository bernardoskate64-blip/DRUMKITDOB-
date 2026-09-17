/* =======================================================================
   DOBÊ LIFE — v2 (comportamento)
   =======================================================================
   1. capa: arquivo original no desktop + entrada
   2. camadas Plugins / Drum Kit sobre a Home  (#plugins, #drumkit)
   3. menu pintado: indicador deslizante e "em breve"
   4. cursor: profundidade das borboletas, vidro que acompanha o mouse,
      botões magnéticos, cartões com profundidade  (só desktop com mouse)
   5. revelação ao rolar dentro da camada + parallax das imagens
   6. borboletas
   7. navegador dos 161 samples — PORTE FIEL do site original: mesmo
      audioCache sob demanda, mesmo toggle, mesmos 350ms mínimos de
      feedback, mesmo tratamento de falha.

   Tudo que anima escreve só transform/opacity. Cada requestAnimationFrame
   para sozinho quando não há mais nada a mover.
   ======================================================================= */

(function(){
  'use strict';

  var $  = function(s,r){ return (r||document).querySelector(s); };
  var $$ = function(s,r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); };

  /* mesma regra de index.html (<source media>) e v2/style.css */
  var compact  = window.matchMedia('(max-width:760px), (max-aspect-ratio:3/5), (max-height:500px)');
  var finePtr  = window.matchMedia('(hover:hover) and (pointer:fine)');
  var reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)');

  var home   = $('#home');
  var stage  = $('.stage');
  var scene  = $('.scene');
  var layer  = $('#layer');

  /* ====================================================================
     1. CAPA
     --------------------------------------------------------------------
     A <picture> pinta rápido (WebP leve). No desktop, o ARQUIVO ORIGINAL
     6000x3750 é baixado e decodificado fora da thread principal e entra
     por cima em fade — é ele que fica na tela. No celular ele não é
     baixado (11 MB); lá vale o recorte do próprio master.
     ==================================================================== */

  var baseImg = $('.hero-base img');
  var readyDone = false;
  function ready(){
    if(readyDone) return;
    readyDone = true;
    /* dois quadros: o estado inicial (névoa, faixas, menu apagado) precisa ser
       pintado antes; senão, com a imagem em cache, a entrada pula direto pro fim */
    requestAnimationFrame(function(){ requestAnimationFrame(function(){
      home.classList.add('ready');
      setTimeout(function(){ home.classList.add('settled'); }, 3400);   // névoa sai do DOM
    }); });
  }
  if(baseImg){
    if(baseImg.complete && baseImg.naturalWidth){ ready(); }
    else { baseImg.addEventListener('load', ready); baseImg.addEventListener('error', ready); }
  }
  setTimeout(ready, 4000);   // nunca deixa a Home esperando indefinidamente

  var masterState = 0;       // 0 nada, 1 carregando, 2 na tela
  function loadMaster(){
    if(masterState || compact.matches || !scene.dataset.master) return;
    masterState = 1;
    var im = new Image();
    im.className = 'hero-master';
    im.alt = '';
    im.setAttribute('aria-hidden','true');
    im.decoding = 'async';
    im.src = scene.dataset.master;
    var shown = function(){
      scene.insertBefore(im, $('.fx', scene));
      requestAnimationFrame(function(){ requestAnimationFrame(function(){ im.classList.add('in'); }); });
      masterState = 2;
    };
    (im.decode ? im.decode() : new Promise(function(ok, no){ im.onload = ok; im.onerror = no; }))
      .then(shown)
      .catch(function(){ masterState = 0; });
  }
  loadMaster();
  compact.addEventListener('change', loadMaster);

  /* ====================================================================
     2. CAMADAS
     --------------------------------------------------------------------
     O estado mora na URL (#plugins / #drumkit): o botão voltar do celular
     fecha a camada e o link pode ser compartilhado direto.
     ==================================================================== */

  var VIEWS = ['plugins','drumkit'];
  var scroller = $('.layer-scroll', layer);
  var bar      = $('.layer-bar', layer);
  var closeBtn = $('.close', layer);
  var current = null, lastFocus = null, hideTimer = null;
  var cameFromHome = false;   // true quando a camada foi aberta por um clique aqui dentro

  function viewFromHash(){
    var h = location.hash.slice(1);
    return VIEWS.indexOf(h) > -1 ? h : null;
  }

  function openView(name){
    clearTimeout(hideTimer);
    var wasOpen = !!current;
    current = name;

    $$('.view', layer).forEach(function(v){ v.hidden = v.dataset.view !== name; });
    $$('.layer-tabs a', layer).forEach(function(a){
      if(a.getAttribute('href') === '#' + name) a.setAttribute('aria-current','page');
      else a.removeAttribute('aria-current');
    });
    layer.setAttribute('aria-labelledby', 'title-' + name);

    if(!wasOpen){
      lastFocus = document.activeElement;
      layer.hidden = false;
      void layer.offsetWidth;                 // garante a transição de entrada
      layer.classList.add('is-open');
      document.documentElement.classList.add('layer-open');
      home.setAttribute('inert','');
      home.setAttribute('aria-hidden','true');
      butterflies.pause();
      parallax.pause();
    }
    scroller.scrollTop = 0;
    bar.classList.remove('scrolled');
    placeTabInd();
    reveal.prepare(name);
    navInd.rest(name);
    stopCurrent();
    /* foco no conteúdo da camada: no celular o anel de foco no botão Fechar
       aparecia sempre que abria */
    var view = $('.view[data-view="' + name + '"]', layer);
    (view || closeBtn).focus({preventScroll:true});
  }

  function closeView(){
    if(!current) return;
    current = null;
    stopCurrent();
    layer.classList.remove('is-open');
    document.documentElement.classList.remove('layer-open');
    home.removeAttribute('inert');
    home.removeAttribute('aria-hidden');
    hideTimer = setTimeout(function(){ layer.hidden = true; }, 700);
    butterflies.resume();
    parallax.resume();
    navInd.rest(null);
    if(lastFocus && lastFocus.focus && document.contains(lastFocus)){
      lastFocus.focus({preventScroll:true});
    }
  }

  function sync(){
    var next = viewFromHash();
    if(next) openView(next); else closeView();
  }

  function requestClose(){
    if(cameFromHome){
      cameFromHome = false;
      history.back();                          // hashchange -> sync -> fecha
    } else {
      history.replaceState(null, '', location.pathname + location.search);
      sync();
    }
  }

  window.addEventListener('hashchange', function(){
    var next = viewFromHash();
    if(next && !current) cameFromHome = true;
    if(!next) cameFromHome = false;
    sync();
  });

  /* trocar de produto dentro da camada não empilha histórico */
  $$('.layer-tabs a', layer).forEach(function(a){
    a.addEventListener('click', function(e){
      e.preventDefault();
      var name = a.getAttribute('href').slice(1);
      if(name !== current) location.replace('#' + name);
    });
  });
  $('.layer-brand', layer).addEventListener('click', function(e){
    e.preventDefault(); requestClose();
  });
  $$('[data-close]', layer).forEach(function(b){ b.addEventListener('click', requestClose); });

  window.addEventListener('keydown', function(e){
    if(e.key === 'Escape'){
      stopCurrent();
      if(current){ e.preventDefault(); requestClose(); }
    }
  });

  /* indicador das abas: um traço só, que desliza até a aba ativa */
  var tabInd = $('.tab-ind', layer);
  function placeTabInd(){
    var a = $('.layer-tabs a[aria-current="page"]', layer);
    if(!a || !tabInd) return;
    tabInd.style.setProperty('--tl', a.offsetLeft + 'px');
    tabInd.style.setProperty('--tw', a.offsetWidth + 'px');
  }
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(placeTabInd);

  /* barra vira vidro quando o conteúdo começa a rolar + linha de progresso */
  var progress = $('.layer-progress', layer);
  var barTick = false;
  scroller.addEventListener('scroll', function(){
    if(barTick) return;
    barTick = true;
    requestAnimationFrame(function(){
      barTick = false;
      bar.classList.toggle('scrolled', scroller.scrollTop > 8);
      if(progress){
        var max = scroller.scrollHeight - scroller.clientHeight;
        progress.style.setProperty('--p', max > 8 ? (scroller.scrollTop / max).toFixed(3) : 0);
      }
      mediaParallax();
    });
  }, {passive:true});

  /* ====================================================================
     3. MENU PINTADO
     ==================================================================== */

  var navInd = (function(){
    var nav = $('.hotspots'), ind = $('.nav-ind');
    var items = $$('.hs-nav');
    var noop = {rest:function(){}};
    if(!nav || !ind) return noop;

    var restOn = $('.hs-home');
    function to(el){
      ind.style.setProperty('--il', (el.offsetLeft / scene.offsetWidth * 100).toFixed(3) + '%');
    }
    items.forEach(function(el){
      el.addEventListener('pointerenter', function(){ nav.classList.add('hovering'); to(el); });
      el.addEventListener('focus', function(){ nav.classList.add('hovering'); to(el); });
      el.addEventListener('blur', function(){ nav.classList.remove('hovering'); to(restOn); });
      el.addEventListener('pointerdown', function(){ nav.classList.add('pressing'); });
    });
    nav.addEventListener('pointerleave', function(){
      nav.classList.remove('hovering'); to(restOn);
    });
    window.addEventListener('pointerup', function(){ nav.classList.remove('pressing'); });

    return {
      /* com uma camada aberta o traço repousa no item dela; ao fechar, volta a Home */
      rest:function(name){
        restOn = name === 'plugins' ? $('.hs-plugins') : name === 'drumkit' ? $('.hs-kit') : $('.hs-home');
        nav.classList.remove('hovering');
        to(restOn);
      }
    };
  })();

  var whisper = $('#whisper'), whisperTimer = null;
  $$('[data-soon]').forEach(function(btn){
    btn.addEventListener('click', function(){
      var r = btn.getBoundingClientRect();
      whisper.textContent = btn.dataset.soon;
      whisper.style.left = (r.right + 10) + 'px';
      whisper.style.top  = (r.top + r.height/2) + 'px';
      whisper.classList.add('show');
      clearTimeout(whisperTimer);
      whisperTimer = setTimeout(function(){ whisper.classList.remove('show'); }, 1900);
    });
  });

  /* ====================================================================
     4. CURSOR (desktop com mouse)
     --------------------------------------------------------------------
     Um único pointermove, resolvido uma vez por quadro:
       - profundidade: a CAPA NÃO SE MOVE (deslocar a foto por frações de
         pixel suaviza a nitidez e exigiria ampliá-la). Quem reage ao mouse
         são as camadas independentes: borboletas perto da lente deslizam
         mais, as distantes quase nada.
       - vidro: --mx/--my no elemento [data-glow] sob o cursor
       - magnético: .magnetic puxa até 5px na direção do cursor
       - cartão [data-tilt]: inclina até 3,5° e a sombra acompanha
     ==================================================================== */

  var par = {x:0, y:0};      // deslocamento de referência em px; cada borboleta multiplica pela profundidade

  var parallax = (function(){
    var tx = 0, ty = 0, raf = 0, paused = false;
    function amp(){ return reduceMq.matches ? .002 : .006; }
    function enabled(){ return finePtr.matches && !compact.matches; }

    function frame(){
      raf = 0;
      var w = scene.offsetWidth, h = scene.offsetHeight, a = amp();
      var gx = tx * w * a, gy = ty * h * a * .7;
      par.x += (gx - par.x) * .075;
      par.y += (gy - par.y) * .075;
      if(Math.abs(gx - par.x) > .05 || Math.abs(gy - par.y) > .05){ raf = requestAnimationFrame(frame); }
    }
    function kick(){ if(!raf && !paused) raf = requestAnimationFrame(frame); }

    return {
      target:function(nx, ny){
        if(!enabled()){ return; }
        tx = -nx; ty = -ny;          // o que está perto corre ao contrário do mouse
        kick();
      },
      center:function(){ tx = 0; ty = 0; kick(); },
      pause:function(){ paused = true; },
      resume:function(){ paused = false; kick(); },
      reset:function(){ tx = ty = par.x = par.y = 0; }
    };
  })();
  compact.addEventListener('change', parallax.reset);

  var ptr = null, ptrTick = false, magnet = null, tilt = null;

  function onPointerFrame(){
    ptrTick = false;
    var e = ptr;
    if(!e) return;

    if(!current){
      parallax.target(e.clientX / window.innerWidth * 2 - 1, e.clientY / window.innerHeight * 2 - 1);
    }

    var t = e.target && e.target.closest ? e.target : null;
    if(!t) return;

    var glow = t.closest('[data-glow]');
    if(glow){
      var r = glow.getBoundingClientRect();
      glow.style.setProperty('--mx', (e.clientX - r.left).toFixed(0) + 'px');
      glow.style.setProperty('--my', (e.clientY - r.top).toFixed(0) + 'px');
    }

    var navHs = t.closest('.hs-nav');
    if(navHs){
      var ind = $('.nav-ind'), ir = navHs.getBoundingClientRect();
      ind.style.setProperty('--mx', (e.clientX - ir.left).toFixed(0) + 'px');
      ind.style.setProperty('--my', (e.clientY - ir.top).toFixed(0) + 'px');
    }

    var reduce = reduceMq.matches;

    var m = reduce ? null : t.closest('.magnetic');
    if(magnet && magnet !== m){ magnet.style.removeProperty('--tx'); magnet.style.removeProperty('--ty'); }
    magnet = m;
    if(m){
      var mr = m.getBoundingClientRect();
      m.style.setProperty('--tx', (((e.clientX - mr.left) / mr.width - .5) * 10).toFixed(1) + 'px');
      m.style.setProperty('--ty', (((e.clientY - mr.top) / mr.height - .5) * 6).toFixed(1) + 'px');
    }

    var c = reduce ? null : t.closest('[data-tilt]');
    if(tilt && tilt !== c){
      tilt.classList.remove('tilting');
      ['--rx','--ry','--sx','--sy'].forEach(function(p){ tilt.style.removeProperty(p); });
    }
    tilt = c;
    if(c){
      var cr = c.getBoundingClientRect();
      var nx = (e.clientX - cr.left) / cr.width - .5, ny = (e.clientY - cr.top) / cr.height - .5;
      c.classList.add('tilting');
      c.style.setProperty('--ry', (nx * 7).toFixed(2) + 'deg');
      c.style.setProperty('--rx', (-ny * 5).toFixed(2) + 'deg');
      c.style.setProperty('--sx', (nx * 2).toFixed(2));
      c.style.setProperty('--sy', (ny * 2).toFixed(2));
    }
  }

  if(finePtr.matches || 'onpointermove' in window){
    window.addEventListener('pointermove', function(e){
      if(e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
      ptr = e;
      if(!ptrTick){ ptrTick = true; requestAnimationFrame(onPointerFrame); }
    }, {passive:true});
    document.documentElement.addEventListener('pointerleave', function(){
      parallax.center();
      if(magnet){ magnet.style.removeProperty('--tx'); magnet.style.removeProperty('--ty'); magnet = null; }
    });
  }

  /* ====================================================================
     4b. CELULAR: revelação ao rolar e faixa com parallax
     --------------------------------------------------------------------
     A cena fica na faixa do topo e sobe mais devagar que o conteúdo; marca,
     texto, linhas do menu e ícones entram conforme aparecem na tela. Tudo em
     transform/opacity, com um único listener de scroll por quadro.
     ==================================================================== */

  (function(){
    if(!compact.matches && !window.matchMedia('(max-width:760px)').matches) return;
    var items = [$('.brand-mark'), $('.home-intro')]
      .concat($$('.home-menu a, .home-soon'))
      .concat([$('.home-social')])
      .filter(Boolean);
    items.forEach(function(el, i){
      el.setAttribute('data-hr', '');
      el.style.setProperty('--i', Math.min(i, 8));
    });
    if('IntersectionObserver' in window){
      var io = new IntersectionObserver(function(en){
        en.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
      }, {rootMargin:'0px 0px -4% 0px', threshold:.01});
      requestAnimationFrame(function(){ requestAnimationFrame(function(){
        items.forEach(function(el){ io.observe(el); });
        /* em tela alta a página não rola: o que já está visível entra em cascata na hora */
        setTimeout(function(){
          items.forEach(function(el){
            var r = el.getBoundingClientRect();
            if(r.top < window.innerHeight + 40) el.classList.add('in');
          });
        }, 260);
      }); });
    } else {
      items.forEach(function(el){ el.classList.add('in'); });
    }

    var tick = false, top = $('.home-top');
    function frame(){
      tick = false;
      var y = window.scrollY || window.pageYOffset;
      var band = stage.offsetHeight || 1;
      var shift = Math.min(y * .32, band * .4);
      scene.style.transform = 'translate3d(0,' + shift.toFixed(1) + 'px,0)';
      if(top) top.style.opacity = Math.max(0, 1 - y / 90);
    }
    window.addEventListener('scroll', function(){
      if(!tick){ tick = true; requestAnimationFrame(frame); }
    }, {passive:true});
    window.addEventListener('resize', function(){
      if(!compact.matches){ scene.style.transform = ''; if(top) top.style.opacity = ''; }
    }, {passive:true});
  })();

  /* ====================================================================
     5. REVELAÇÃO AO ROLAR (dentro da camada)
     ==================================================================== */

  var reveal = (function(){
    var targets = '.view-head > *, .product-media, .product-tag, .product-name, .product-desc, .product-note, .specs > div, .buy, .pay-note';
    var io = null;
    if('IntersectionObserver' in window){
      io = new IntersectionObserver(function(entries){
        entries.forEach(function(en){
          if(en.isIntersecting){ en.target.classList.add('in'); io.unobserve(en.target); }
        });
      }, {root:scroller, rootMargin:'0px 0px -6% 0px', threshold:.08});
    }
    return {
      prepare:function(name){
        var view = $('.view[data-view="' + name + '"]', layer);
        var els = $$(targets, view);
        els.forEach(function(el, i){
          el.setAttribute('data-rv','');
          el.classList.remove('in');
          el.style.setProperty('--i', Math.min(i, 10));
        });
        if(!io){ els.forEach(function(el){ el.classList.add('in'); }); return; }
        /* dois quadros: o estado inicial precisa ser pintado antes de revelar */
        requestAnimationFrame(function(){ requestAnimationFrame(function(){
          els.forEach(function(el){ io.observe(el); });
          mediaParallax();
        }); });
      }
    };
  })();

  /* imagens dos cartões deslizam levemente dentro da moldura ao rolar */
  function mediaParallax(){
    if(!current || reduceMq.matches) return;
    var vh = window.innerHeight;
    var amp = compact.matches ? -9 : -14;                   // no celular, mais discreto
    $$('.view:not([hidden]) .card img', layer).forEach(function(img){
      var r = img.parentNode.getBoundingClientRect();
      var off = ((r.top + r.height/2) - vh/2) / vh;          // -1..1 aprox.
      img.style.setProperty('--iy', (off * amp).toFixed(1) + 'px');
    });
  }

  /* ====================================================================
     6. BORBOLETAS
     --------------------------------------------------------------------
     Poucas, pequenas, cada uma presa a uma região da cena (vegetação,
     flores, janela). O rumo vem de senoides com frequências sorteadas,
     então o caminho nunca se repete; uma força suave traz de volta quem
     se afasta demais. Coordenadas em % da capa inteira (6000x3750).
     "depth" multiplica o parallax: grande perto da lente, pequeno lá longe.
     De tempos em tempos uma pousa na própria região e abre/fecha as asas
     devagar antes de voltar a voar.
     ==================================================================== */

  var butterflies = (function(){
    var flight = $('.flight');
    var noop = {pause:function(){}, resume:function(){}};
    /* sem checagem de "reduzir movimento": o Windows liga essa preferência
       só por ter as animações do sistema desligadas, e as borboletas são
       pequenas e lentas. */
    if(!flight) return noop;

    /* cores de espécies comuns na serra: enxofre, Dryas, branca, azul-morfo */
    var PALETTE = {
      sulphur:{c1:'#eedf9c', c2:'#8f7b35'},
      dryas:  {c1:'#e38a3c', c2:'#3b2616'},
      white:  {c1:'#f3efe4', c2:'#6d6b62'},
      morpho: {c1:'#78b6e6', c2:'#1d2b3b'}
    };

    /* x/y = centro da região, rx/ry = raio, size = envergadura em px da capa a 1920.
       "alt" = outras regiões por onde ela passeia de vez em quando: o voo de
       uma região até a outra atravessa a cena devagar, e isso dá vida sem
       aumentar o número de borboletas. Nunca sobre o título e o subtítulo. */
    var SCENES = {
      wide: {
        crop:{x:0, y:0, w:100, h:100},
        list:[
          {x:21, y:45, rx:5,   ry:7, size:14, speed:4.4, color:'sulphur', depth:1.35,
           alt:[{x:13, y:62, rx:5, ry:6}]},                                                    // hera e margarida, à esquerda
          {x:9,  y:80, rx:7,   ry:6, size:21, speed:5.6, color:'white',   depth:2.2, near:true}, // flores do primeiro plano
          {x:90, y:76, rx:5.5, ry:8, size:16, speed:4.6, color:'dryas',   depth:1.6,
           alt:[{x:95, y:55, rx:3, ry:8}]},                                                    // plantas e flores amarelas, à direita
          {x:67, y:52, rx:5,   ry:4, size:10, speed:3.4, color:'morpho',  depth:.55, far:true,
           alt:[{x:80, y:47, rx:6, ry:4}]},                                                    // diante da serra, pela janela
          {x:12, y:30, rx:4,   ry:9, size:12, speed:3.8, color:'sulphur', depth:1.25},          // hera pendurada no alto, à esquerda
          {x:84, y:82, rx:6,   ry:3, size:15, speed:4.2, color:'white',   depth:1.7,
           alt:[{x:73, y:81, rx:4, ry:2.5}]},                                                    // livros e plantas da mesa, à direita
          {x:28, y:60, rx:3,   ry:5, size:11, speed:3.6, color:'dryas',   depth:1.2},           // luminária e hera junto à caixa esquerda
          {x:50, y:47, rx:9,   ry:3, size:7,  speed:2.8, color:'white',   depth:.45, far:true}  // bem longe, sobre o vale
        ]
      },
      compact: {
        crop:{x:12, y:40, w:76, h:60},        // a faixa hero-mb-*.webp
        list:[
          {x:44, y:50, rx:3.5, ry:4, size:12, speed:3,   color:'sulphur', depth:1, far:true},   // diante da serra
          {x:58, y:56, rx:3,   ry:4, size:14, speed:3.2, color:'dryas',   depth:1},             // junto ao monitor
          {x:77, y:54, rx:3.5, ry:4, size:13, speed:3.4, color:'white',   depth:1},             // plantas à direita
          {x:28, y:52, rx:3,   ry:4, size:12, speed:3,   color:'morpho',  depth:1}              // luminária, à esquerda
        ]
      }
    };

    var SVG = '<svg viewBox="-12 -10 24 20" aria-hidden="true">' +
      wing('') + wing(' transform="scale(-1,1)"') +
      '<ellipse class="body" cx="0" cy=".6" rx=".75" ry="4.4"/>' +
      '<path class="ant" d="M-.3-3.6Q-1.4-7-2.8-8.4M.3-3.6Q1.4-7 2.8-8.4"/>' +
      '</svg>';
    function wing(mirror){
      return '<g' + mirror + '><g class="w">' +
        '<path class="wing" d="M.4-.6C2.5-6.5 8.5-9.6 11-7.8 12.6-6.5 10.6-2.2 6.5-.4 4.4.5 2 .2.4-.6Z"/>' +
        '<path class="tip" d="M8.4-8.9C10-9.3 12.3-8.2 11.7-6.3 11.2-5 9.9-5.3 9.4-6.3Z"/>' +
        '<path class="wing" d="M.4.2C3.6.3 7.8 1.8 7.6 5.2 7.4 7.8 4.4 8.4 2.7 6.3 1.5 4.8.8 2.4.4.2Z"/>' +
        '</g></g>';
    }

    var bugs = [], mode = null, W = 0, H = 0, raf = 0, last = 0, running = false;
    var rnd = function(a,b){ return a + Math.random()*(b-a); };

    function build(){
      mode = compact.matches ? SCENES.compact : SCENES.wide;
      flight.innerHTML = '';
      bugs = mode.list.map(function(z){
        var el = document.createElement('div');
        el.className = 'bf' + (z.near ? ' near' : '');
        el.innerHTML = SVG;
        var c = PALETTE[z.color];
        el.style.setProperty('--c1', c.c1);
        el.style.setProperty('--c2', c.c2);
        el.style.setProperty('--o', z.far ? .82 : .95);
        el.style.setProperty('--flap', rnd(1.05, 1.6).toFixed(2) + 's');
        el.style.setProperty('--fd', (-rnd(0, 1.6)).toFixed(2) + 's');
        flight.appendChild(el);
        setTimeout(function(){ el.classList.add('on'); }, rnd(1400, 5200));   // chegam aos poucos
        return {
          el:el, z:z, zone:z, zones:[z].concat(z.alt || []),
          x:z.x + rnd(-.5,.5)*z.rx, y:z.y + rnd(-.5,.5)*z.ry,
          head:rnd(0, Math.PI*2), face:1, t:rnd(0, 100),
          sf:1, resting:false, timer:rnd(7, 16),
          f:[rnd(.23,.41), rnd(.61,.97), rnd(1.3,1.9), rnd(.09,.17)],
          p:[rnd(0,6.3), rnd(0,6.3), rnd(0,6.3), rnd(0,6.3)]
        };
      });
      measure();
    }

    function measure(){
      W = flight.offsetWidth; H = flight.offsetHeight;
      var scale = W / (1920 * mode.crop.w / 100);
      bugs.forEach(function(b){ b.el.style.setProperty('--s', (b.z.size * scale).toFixed(1) + 'px'); });
    }

    function step(now){
      raf = requestAnimationFrame(step);
      var dt = Math.min(.05, (now - last) / 1000 || 0);
      last = now;
      var cx = mode.crop, sx = W / cx.w, sy = H / cx.h;

      bugs.forEach(function(b){
        var z = b.z, zn = b.zone, f = b.f, p = b.p;
        b.t += dt;

        /* curvas irregulares: soma de senoides que nunca se alinham */
        var turn = Math.sin(b.t*f[0] + p[0])*1.1 + Math.sin(b.t*f[1] + p[1])*.7 + Math.sin(b.t*f[2] + p[2])*.35;

        /* volta suave para a própria região */
        var dx = (zn.x - b.x) / zn.rx, dy = (zn.y - b.y) / zn.ry;
        var d = Math.sqrt(dx*dx + dy*dy);
        if(d > .55){
          var want = Math.atan2((zn.y - b.y) / 1.6, zn.x - b.x);
          var diff = Math.atan2(Math.sin(want - b.head), Math.cos(want - b.head));
          turn += diff * (d - .55) * 3;
        }
        b.head += turn * dt;

        /* pouso: só dentro da própria região, por alguns segundos */
        b.timer -= dt;
        if(b.timer <= 0){
          if(b.resting){
            b.resting = false; b.timer = rnd(8, 18); b.el.classList.remove('rest');
            /* às vezes, ao levantar voo, vai para outra região da cena */
            if(b.zones.length > 1 && Math.random() < .45){
              var others = b.zones.filter(function(q){ return q !== b.zone; });
              b.zone = others[Math.floor(Math.random() * others.length)];
            }
          }
          else if(d < .6){ b.resting = true; b.timer = rnd(2.6, 5.2); b.el.classList.add('rest'); }
          else { b.timer = 2; }
        }
        b.sf += ((b.resting ? 0 : 1) - b.sf) * Math.min(1, dt * 2.2);

        /* ritmo: acelera, hesita, quase para */
        var speed = z.speed * (.55 + .45*Math.sin(b.t*f[3] + p[3])) * b.sf;
        var vx = Math.cos(b.head), vy = Math.sin(b.head);
        b.x += vx * speed * dt;
        b.y += vy * speed * dt * 1.6;

        /* virar de lado passa pelo perfil, como em 3D */
        var faceTo = vx >= 0 ? 1 : -1;
        b.face += (faceTo - b.face) * Math.min(1, dt*5);
        var fx = Math.abs(b.face) < .14 ? (b.face < 0 ? -.14 : .14) : b.face;

        var depth = z.depth || 1;
        var px = (b.x - cx.x) * sx + par.x * depth;
        var py = (b.y - cx.y) * sy + par.y * depth + Math.sin(b.t*8.5 + p[1]) * 1.4 * b.sf;
        var tilt = vy * 22 * faceTo * b.sf;
        b.el.style.transform = 'translate3d(' + px.toFixed(1) + 'px,' + py.toFixed(1) + 'px,0) rotate(' +
                               tilt.toFixed(1) + 'deg) scaleX(' + fx.toFixed(3) + ')';
      });
    }

    function start(){
      if(running || document.hidden) return;
      running = true; last = performance.now();
      raf = requestAnimationFrame(step);
    }
    function stop(){ running = false; cancelAnimationFrame(raf); }

    build();
    start();

    var rz = null;
    window.addEventListener('resize', function(){
      clearTimeout(rz);
      rz = setTimeout(function(){
        var want = compact.matches ? SCENES.compact : SCENES.wide;
        if(want !== mode) build(); else measure();
        navInd.rest(current);
        placeTabInd();
      }, 120);
    }, {passive:true});
    document.addEventListener('visibilitychange', function(){
      if(document.hidden) stop(); else if(!current) start();
    });

    return {
      pause:function(){ stop(); home.classList.add('paused'); },
      resume:function(){ home.classList.remove('paused'); start(); }
    };
  })();

  /* ====================================================================
     7. NAVEGADOR DOS 161 SAMPLES
     ==================================================================== */

  var audioCache = {};
  var currentAudio = null, currentRow = null, minTimer = null;

  function stopCurrent(){
    if(currentAudio){
      try{ currentAudio.pause(); }catch(e){}
      try{ currentAudio.currentTime = 0; }catch(e){}
    }
    if(currentRow) currentRow.classList.remove('playing');
    if(minTimer){ clearTimeout(minTimer); minTimer = null; }
    currentAudio = null; currentRow = null;
  }

  sync();   // abre direto se a URL já chegar com #plugins ou #drumkit

  if(typeof PACK_FILES === 'undefined'){
    console.warn('PACK_FILES ausente: v2/packfiles.js nao carregou.');
    return;
  }

  var tracksEl = $('#tracks'), countEl = $('#trackCount'), chipsEl = $('#chips');
  if(!tracksEl) return;

  function fmtDur(s){
    if(!s) return '';
    if(s < 1) return Math.round(s*1000) + 'ms';
    if(s < 60) return s.toFixed(2) + 's';
    var m = Math.floor(s/60), ss = Math.round(s%60);
    return m + ':' + String(ss).padStart(2,'0');
  }

  var cats = [], perCat = {};
  PACK_FILES.forEach(function(it){
    if(cats.indexOf(it.cat) === -1){ cats.push(it.cat); perCat[it.cat] = 0; }
    perCat[it.cat]++;
  });

  function chip(cat, label, n, on){
    var b = document.createElement('button');
    b.className = 'chip' + (on ? ' on' : ''); b.type = 'button';
    b.dataset.cat = cat;
    b.textContent = label;
    var small = document.createElement('small');
    small.textContent = n;
    b.appendChild(small);
    return b;
  }

  if(chipsEl){
    chipsEl.appendChild(chip('*', 'Tudo', PACK_FILES.length, true));
    cats.forEach(function(c){ chipsEl.appendChild(chip(c, c, perCat[c], false)); });
    chipsEl.addEventListener('click', function(e){
      var b = e.target.closest('.chip');
      if(!b) return;
      $$('.chip', chipsEl).forEach(function(x){ x.classList.remove('on'); });
      b.classList.add('on');
      render(b.dataset.cat);
      tracksEl.scrollTop = 0;
    });
  }

  function render(filtro){
    stopCurrent();
    tracksEl.innerHTML = '';
    var ultima = null, n = 0;

    PACK_FILES.forEach(function(it, idx){
      if(filtro && filtro !== '*' && it.cat !== filtro) return;
      n++;

      if(it.cat !== ultima){
        ultima = it.cat;
        var h = document.createElement('div');
        h.className = 'cat-sep';
        h.textContent = it.cat;
        tracksEl.appendChild(h);
      }

      var nome = it.f.split('/').pop();
      var row = document.createElement('div');
      row.className = 'track';
      row.tabIndex = 0;
      row.setAttribute('role','button');
      row.setAttribute('aria-label','Ouvir ' + nome);
      row.innerHTML = '<span class="play-dot" aria-hidden="true"></span>' +
                      '<span class="tname"></span>' +
                      '<span class="ttag"></span>' +
                      '<span class="tdur"></span>';
      row.querySelector('.tname').textContent = nome;
      row.querySelector('.ttag').textContent  = it.ptype;
      row.querySelector('.tdur').textContent  = fmtDur(it.dur);

      row.addEventListener('click', function(){ togglePlay(idx, row); });
      row.addEventListener('keydown', function(e){
        if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); togglePlay(idx, row); }
      });
      tracksEl.appendChild(row);
    });

    if(countEl) countEl.textContent = n + ' de ' + PACK_FILES.length + ' arquivos';
  }

  /* ---- reprodução (porte fiel) ---- */

  function togglePlay(idx, row){
    var file = PACK_FILES[idx].f;

    if(!audioCache[file]){
      var novo = new Audio('audio/' + file);
      novo.volume = 1.0;
      audioCache[file] = novo;
    }
    var a = audioCache[file];

    if(currentAudio === a && !a.paused){ stopCurrent(); return; }
    stopCurrent();

    row.classList.add('playing');
    currentAudio = a; currentRow = row;
    try{ a.currentTime = 0; }catch(e){}

    var iniciou = Date.now();
    a.onended = function(){
      var resta = Math.max(0, 350 - (Date.now() - iniciou));
      minTimer = setTimeout(function(){
        if(currentAudio === a){
          row.classList.remove('playing');
          currentAudio = null; currentRow = null;
        }
      }, resta);
    };

    var p = a.play();
    if(p && typeof p.then === 'function'){
      p.catch(function(err){
        console.warn('audio play failed:', file, err);
        row.classList.remove('playing');
        row.style.background = 'rgba(217,37,37,.14)';
        setTimeout(function(){ row.style.background = ''; }, 900);
        if(currentAudio === a){ currentAudio = null; currentRow = null; }
        delete audioCache[file];
      });
    }
  }

  render('*');

})();
