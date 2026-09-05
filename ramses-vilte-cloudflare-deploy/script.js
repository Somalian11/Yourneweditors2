(function(){

  /* ---------- force page to open at the very top ---------- */
  /* Mobile browsers sometimes restore the last scroll position when a
     link is reopened (especially after backgrounding the tab or coming
     back via history), which makes the page look like it "starts" a bit
     lower than the top. Unless the URL is deliberately pointing at a
     section (a #hash), always land at the top. */
  if('scrollRestoration' in history){ history.scrollRestoration = 'manual'; }
  if(!window.location.hash){
    window.scrollTo(0, 0);
    window.addEventListener('load', function(){ window.scrollTo(0, 0); });
  }

  /* ---------- pricing tabs / swipeable carousel ---------- */
  var carousel = document.querySelector('.pricing-carousel');
  var tabs = document.querySelectorAll('.pricing-tab');
  if(carousel && tabs.length){
    var cards = carousel.querySelectorAll('.plan');
    tabs.forEach(function(tab){
      tab.addEventListener('click', function(){
        var idx = parseInt(tab.getAttribute('data-target'), 10);
        var card = cards[idx];
        if(card){
          carousel.scrollTo({ left: card.offsetLeft - carousel.offsetLeft, behavior: 'smooth' });
        }
      });
    });
    var syncActiveTab = function(){
      var scrollLeft = carousel.scrollLeft;
      var closest = 0, closestDist = Infinity;
      cards.forEach(function(card, i){
        var dist = Math.abs((card.offsetLeft - carousel.offsetLeft) - scrollLeft);
        if(dist < closestDist){ closestDist = dist; closest = i; }
      });
      tabs.forEach(function(tab, i){
        tab.classList.toggle('active', i === closest);
      });
    };
    var scrollTimer;
    carousel.addEventListener('scroll', function(){
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(syncActiveTab, 80);
    });
  }

  /* ---------- cursor dot ---------- */
  var dot = document.getElementById('cursorDot');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(dot && !reduceMotion){
    window.addEventListener('mousemove', function(e){
      dot.style.transform = 'translate('+e.clientX+'px,'+e.clientY+'px) translate(-50%,-50%)';
    });
    document.querySelectorAll('a, button, .tile').forEach(function(el){
      el.addEventListener('mouseenter', function(){ dot.classList.add('hover'); });
      el.addEventListener('mouseleave', function(){ dot.classList.remove('hover'); });
    });
  }

  /* ---------- nav scroll state ---------- */
  var nav = document.getElementById('siteNav');
  window.addEventListener('scroll', function(){
    if(window.scrollY > 40){ nav.classList.add('scrolled'); }
    else{ nav.classList.remove('scrolled'); }
  });

  /* ---------- mobile nav toggle ---------- */
  var toggle = document.getElementById('navToggle');
  var links = document.getElementById('navLinks');
  toggle.addEventListener('click', function(){
    var isOpen = links.classList.toggle('open');
    toggle.setAttribute('aria-expanded', isOpen);
  });
  links.querySelectorAll('[data-close]').forEach(function(el){
    el.addEventListener('click', function(){
      links.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });

  /* ---------- reveal on scroll ---------- */
  var revealEls = document.querySelectorAll('.reveal');
  if('IntersectionObserver' in window){
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting){
          entry.target.classList.add('in-view');
          io.unobserve(entry.target);
        }
      });
    }, { threshold:0.15 });
    revealEls.forEach(function(el){ io.observe(el); });
  } else {
    revealEls.forEach(function(el){ el.classList.add('in-view'); });
  }

  /* ---------- lazy-load video sources ---------- */
  /* The 3 main reels and the 4 grid videos below only get their real
     src (and therefore only start downloading) once the user has nearly
     scrolled to them. This keeps the initial page load light — nobody
     pays for videos they never scroll down to see — and each clip starts
     fresh from frame one right as it comes into view instead of having
     played through invisibly in the background. */
  var lazyVideos = document.querySelectorAll('video.lazy-video');
  if('IntersectionObserver' in window && lazyVideos.length){
    var lazyIO = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(!entry.isIntersecting) return;
        var video = entry.target;
        var src = video.getAttribute('data-src');
        if(src){
          video.src = src;
          video.removeAttribute('data-src');
          video.load();
        }
        lazyIO.unobserve(video);
      });
    }, { rootMargin: '150px 0px 150px 0px', threshold: 0.01 });
    lazyVideos.forEach(function(video){ lazyIO.observe(video); });
  } else {
    // no IntersectionObserver support: just load everything immediately
    lazyVideos.forEach(function(video){
      var src = video.getAttribute('data-src');
      if(src){ video.src = src; video.removeAttribute('data-src'); }
    });
  }

  /* ---------- reel video autoplay ---------- */
  /* Autoplay policies differ wildly: sandboxed iframes often block .play()
     until the user has interacted. We try several strategies:
       1) set muted as a JS property (not just attribute)
       2) call play() immediately on load
       3) call play() when the video enters the viewport
       4) kick everything alive on the first user interaction anywhere
       5) tap-to-play fallback on the video itself */
  var reelVideos = document.querySelectorAll('.video-grid video, .offer-video video, .offer-reel video, .close-video video');
  reelVideos.forEach(function(video){
    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.setAttribute('preload', 'auto');
    video.load();

    // Toggle the is-playing class on the parent so the play indicator fades
    var parent = video.closest('.tile') || video.closest('.offer-video') || video.closest('.offer-reel') || video.closest('.close-video');
    if(parent){
      video.addEventListener('playing', function(){ parent.classList.add('is-playing'); });
      video.addEventListener('pause', function(){ parent.classList.remove('is-playing'); });
      video.addEventListener('ended', function(){ parent.classList.remove('is-playing'); });
    }
  });

  function tryPlayAll(){
    reelVideos.forEach(function(video){
      if(video.paused){
        var p = video.play();
        if(p !== undefined) p.catch(function(){});
      }
    });
  }

  // 1) immediate attempt
  tryPlayAll();

  // 1b) safety-net retry loop for the first few seconds, in case autoplay
  //     was blocked before the video finished decoding
  var playRetries = 0;
  var playRetryTimer = setInterval(function(){
    playRetries++;
    var stillPaused = false;
    reelVideos.forEach(function(video){ if(video.paused) stillPaused = true; });
    if(!stillPaused || playRetries > 10){
      clearInterval(playRetryTimer);
      return;
    }
    tryPlayAll();
  }, 400);

  // 2) attempt again at each readiness milestone (some browsers fire one
  //    but not another depending on how the data URI decodes)
  reelVideos.forEach(function(video){
    ['loadedmetadata','loadeddata','canplay','canplaythrough'].forEach(function(ev){
      video.addEventListener(ev, function(){
        if(video.paused){ video.play().catch(function(){}); }
      }, { once: true });
    });
  });

  // 3) IntersectionObserver: play when scrolled into view, pause when out
  if('IntersectionObserver' in window){
    var vio = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        var video = entry.target;
        if(entry.isIntersecting){
          if(video.paused){
            var p = video.play();
            if(p !== undefined) p.catch(function(){});
          }
        } else {
          video.pause();
        }
      });
    }, { threshold: 0.15 });
    reelVideos.forEach(function(video){ vio.observe(video); });
  }

  // 4) kick everything alive on first user gesture anywhere in the doc
  function firstGesture(){
    tryPlayAll();
    ['click','touchstart','scroll','keydown','pointerdown'].forEach(function(ev){
      window.removeEventListener(ev, firstGesture, true);
    });
  }
  ['click','touchstart','scroll','keydown','pointerdown'].forEach(function(ev){
    window.addEventListener(ev, firstGesture, { capture: true, passive: true });
  });

  // 5) tap the video to play if all else failed
  reelVideos.forEach(function(video){
    video.addEventListener('click', function(){
      if(video.paused){ video.play().catch(function(){}); }
    });
  });

  /* ---------- reel mute/unmute toggle ---------- */
  document.querySelectorAll('.reel-mute-btn').forEach(function(btn){
    var video = btn.previousElementSibling;
    if(!video || video.tagName !== 'VIDEO') return;
    btn.addEventListener('click', function(e){
      e.stopPropagation();
      var nowMuted = !video.muted;
      video.muted = nowMuted;
      if(nowMuted){
        video.setAttribute('muted', '');
      } else {
        // some mobile browsers key their audio policy off the HTML
        // attribute as well as the JS property, and want an explicit
        // play() call inside the same tap to actually start the audio
        video.removeAttribute('muted');
        video.volume = 1;
        var p = video.play();
        if(p !== undefined) p.catch(function(){});
      }
      btn.setAttribute('aria-pressed', nowMuted ? 'false' : 'true');
      btn.setAttribute('aria-label', nowMuted ? 'Unmute video' : 'Mute video');
    });
  });

  /* ---------- count-up stats ---------- */
  var counters = document.querySelectorAll('.count-up');
  function animateCount(el){
    var target = parseInt(el.getAttribute('data-target'), 10);
    if(reduceMotion){ el.textContent = target; return; }
    var start = 0, duration = 1400, startTime = null;
    function step(ts){
      if(!startTime) startTime = ts;
      var progress = Math.min((ts - startTime) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.floor(eased * target);
      if(progress < 1){ requestAnimationFrame(step); }
      else { el.textContent = target; }
    }
    requestAnimationFrame(step);
  }
  if('IntersectionObserver' in window){
    var cio = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting){
          animateCount(entry.target);
          cio.unobserve(entry.target);
        }
      });
    }, { threshold:0.5 });
    counters.forEach(function(el){ cio.observe(el); });
  } else {
    counters.forEach(function(el){ el.textContent = el.getAttribute('data-target'); });
  }

  /* ---------- modal ---------- */
  var overlay = document.getElementById('modalOverlay');
  var openBtns = document.querySelectorAll('.open-modal');
  var closeBtn = document.getElementById('modalClose');
  var formBody = document.getElementById('formBody');
  var successState = document.getElementById('successState');
  var leadForm = document.getElementById('leadForm');
  var lastFocused = null;

  function openModal(){
    lastFocused = document.activeElement;
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    var firstField = document.getElementById('f-name');
    if(firstField) setTimeout(function(){ firstField.focus(); }, 300);
  }
  function closeModal(){
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    if(lastFocused) lastFocused.focus();
  }

  openBtns.forEach(function(btn){ btn.addEventListener('click', openModal); });
  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', function(e){ if(e.target === overlay) closeModal(); });
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape' && overlay.classList.contains('open')) closeModal();
  });

  leadForm.addEventListener('submit', function(e){
    e.preventDefault();
    // NOTE: hook this up to a form backend (e.g. Formspree, Basin, your own endpoint)
    // to actually receive submissions. Currently this only shows a confirmation state.
    formBody.classList.add('hidden');
    successState.classList.add('show');
  });

})();
