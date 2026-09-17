/* =======================================================================
   DOBÊ LIFE — v2 (comportamento)
   =======================================================================
   O player de preview é PORTE FIEL da lógica do site original: mesmo
   audioCache sob demanda, mesmo toggle, mesmos 350ms mínimos de feedback,
   mesmo tratamento de falha (limpa o cache para a próxima tentativa).
   Nenhuma regra de reprodução foi alterada.

   PACK_FILES vem de v2/packfiles.js (161 entradas extraídas byte a byte
   do index.html original).
   ======================================================================= */

(function(){
  'use strict';

  var $  = function(s,r){ return (r||document).querySelector(s); };
  var $$ = function(s,r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ====================================================================
     HERÓI — blur-up
     --------------------------------------------------------------------
     O placeholder de 781 bytes já está pintado em CSS. Quando a foto real
     termina de decodificar, ela entra por cima e a névoa se dissolve.
     ==================================================================== */

  var hero = $('.hero');
  var heroImg = $('.hero-media img');
  if(hero && heroImg){
    var mark = function(){ hero.classList.add('loaded'); };
    if(heroImg.complete && heroImg.naturalWidth){ mark(); }
    else { heroImg.addEventListener('load', mark); heroImg.addEventListener('error', mark); }
  }

  /* ====================================================================
     PARALAXE DO HERÓI + BARRA DE PROGRESSO + NAVEGAÇÃO FLUTUANTE
     --------------------------------------------------------------------
     Um único laço em requestAnimationFrame para tudo que depende da
     rolagem — evita vários listeners disputando o mesmo quadro.
     ==================================================================== */

  var media    = $('.hero-media');
  var progress = $('.progress');
  var nav      = $('.nav');
  var ticking  = false;

  function onFrame(){
    ticking = false;
    var y = window.scrollY || window.pageYOffset;

    if(progress){
      var max = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, y/max) : 0) + ')';
    }

    if(nav){
      var h = hero ? hero.offsetHeight : window.innerHeight;
      nav.classList.toggle('show', y > h * 0.72);
    }

    if(media && !reduce && hero && y < hero.offsetHeight){
      media.style.transform = 'translate3d(0,' + (y * 0.32).toFixed(1) + 'px,0)';
    }

    spyNav(y);
  }
  function onScroll(){ if(!ticking){ ticking = true; requestAnimationFrame(onFrame); } }
  window.addEventListener('scroll', onScroll, {passive:true});
  window.addEventListener('resize', onScroll, {passive:true});

  /* seção ativa no menu */
  var links = $$('.nav-links a');
  var secs  = $$('section[id], header[id]');
  function spyNav(y){
    var probe = y + window.innerHeight * 0.34, cur = null;
    secs.forEach(function(s){ if(s.offsetTop <= probe) cur = s.id; });
    links.forEach(function(a){ a.classList.toggle('active', a.getAttribute('href') === '#' + cur); });
  }
  onFrame();

  /* ====================================================================
     MENU DO CELULAR
     ==================================================================== */

  var toggle = $('.nav-toggle'), menu = $('.nav-links');
  if(toggle && menu){
    toggle.addEventListener('click', function(){
      var open = menu.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    menu.addEventListener('click', function(e){
      if(e.target.tagName === 'A'){
        menu.classList.remove('open');
        toggle.setAttribute('aria-expanded','false');
      }
    });
  }

  /* ====================================================================
     REVELAÇÃO EM CASCATA
     ==================================================================== */

  if('IntersectionObserver' in window && !reduce){
    var io = new IntersectionObserver(function(en){
      en.forEach(function(e){
        if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, {threshold:.14, rootMargin:'0px 0px -70px 0px'});
    $$('.reveal, .mask-line').forEach(function(el){ io.observe(el); });
  } else {
    $$('.reveal, .mask-line').forEach(function(el){ el.classList.add('in'); });
  }

  /* ====================================================================
     CONTAGEM DOS NÚMEROS
     ==================================================================== */

  function countUp(el){
    var alvo = parseFloat(el.dataset.count);
    var suf  = el.dataset.suffix || '';
    if(isNaN(alvo)){ return; }
    if(reduce){ el.textContent = alvo + suf; return; }
    var t0 = null, dur = 1500;
    function step(t){
      if(!t0) t0 = t;
      var p = Math.min(1, (t - t0) / dur);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(alvo * eased) + suf;
      if(p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  if('IntersectionObserver' in window){
    var io2 = new IntersectionObserver(function(en){
      en.forEach(function(e){
        if(e.isIntersecting){ countUp(e.target); io2.unobserve(e.target); }
      });
    }, {threshold:.6});
    $$('[data-count]').forEach(function(el){ io2.observe(el); });
  } else {
    $$('[data-count]').forEach(countUp);
  }

  /* ====================================================================
     BOTÕES MAGNÉTICOS + INCLINAÇÃO DA IMAGEM DO PLUGIN
     ==================================================================== */

  if(!reduce && window.matchMedia('(pointer:fine)').matches){
    $$('.pill').forEach(function(b){
      b.addEventListener('mousemove', function(e){
        var r = b.getBoundingClientRect();
        var dx = (e.clientX - (r.left + r.width/2)) / r.width;
        var dy = (e.clientY - (r.top + r.height/2)) / r.height;
        b.style.transform = 'translate(' + (dx*9).toFixed(1) + 'px,' + (dy*7).toFixed(1) + 'px)';
      });
      b.addEventListener('mouseleave', function(){ b.style.transform = ''; });
    });

    $$('.shot').forEach(function(s){
      s.addEventListener('mousemove', function(e){
        var r = s.getBoundingClientRect();
        var dx = (e.clientX - (r.left + r.width/2)) / r.width;
        var dy = (e.clientY - (r.top + r.height/2)) / r.height;
        s.style.transform = 'perspective(1200px) rotateY(' + (dx*6).toFixed(2) +
                            'deg) rotateX(' + (-dy*6).toFixed(2) + 'deg)';
      });
      s.addEventListener('mouseleave', function(){ s.style.transform = 'perspective(1200px)'; });
    });
  }

  /* ====================================================================
     NAVEGADOR DOS 161 SAMPLES
     ==================================================================== */

  if(typeof PACK_FILES === 'undefined'){
    console.warn('PACK_FILES ausente: v2/packfiles.js nao carregou.');
    return;
  }

  var tracksEl = $('#tracks'), countEl = $('#trackCount'), chipsEl = $('#chips');
  if(!tracksEl) return;

  function fmtDur(s){
    if(!s) return '--';
    if(s < 1) return Math.round(s*1000) + 'ms';
    if(s < 60) return s.toFixed(2) + 's';
    var m = Math.floor(s/60), ss = Math.round(s%60);
    return m + ':' + String(ss).padStart(2,'0');
  }

  var cats = [];
  PACK_FILES.forEach(function(it){ if(cats.indexOf(it.cat) === -1) cats.push(it.cat); });

  if(chipsEl){
    var todos = document.createElement('button');
    todos.className = 'chip on'; todos.type = 'button';
    todos.dataset.cat = '*'; todos.textContent = 'Tudo';
    chipsEl.appendChild(todos);
    cats.forEach(function(c){
      var b = document.createElement('button');
      b.className = 'chip'; b.type = 'button';
      b.dataset.cat = c; b.textContent = c;
      chipsEl.appendChild(b);
    });
    chipsEl.addEventListener('click', function(e){
      var b = e.target.closest('.chip');
      if(!b) return;
      $$('.chip', chipsEl).forEach(function(x){ x.classList.remove('on'); });
      b.classList.add('on');
      render(b.dataset.cat);
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

  window.addEventListener('keydown', function(e){
    if(e.key === 'Escape') stopCurrent();
  });

  render('*');

})();
