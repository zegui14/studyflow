// StudyFlow — Service Worker
// Sube este número cada vez que subas una versión nueva de index.html;
// si no lo subes, los usuarios se quedan con la versión vieja en caché.
var CACHE_VERSION = 'studyflow-v1';

var APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', function(event){
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function(cache){
      return cache.addAll(APP_SHELL);
    }).then(function(){
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function(event){
  event.waitUntil(
    caches.keys().then(function(nombres){
      return Promise.all(
        nombres.filter(function(n){ return n !== CACHE_VERSION; })
               .map(function(n){ return caches.delete(n); })
      );
    }).then(function(){
      return self.clients.claim();
    })
  );
});

// Red primero para el propio index.html (para no quedarte pillado en una
// versión vieja mientras desarrollas), caché primero para el resto.
self.addEventListener('fetch', function(event){
  var req = event.request;
  if(req.method !== 'GET') return;

  var esHtml = req.mode === 'navigate' || (req.headers.get('accept') || '').indexOf('text/html') !== -1;

  if(esHtml){
    event.respondWith(
      fetch(req).then(function(res){
        var copia = res.clone();
        caches.open(CACHE_VERSION).then(function(cache){ cache.put(req, copia); });
        return res;
      }).catch(function(){
        return caches.match(req).then(function(r){ return r || caches.match('./index.html'); });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(function(cached){
      return cached || fetch(req).then(function(res){
        var copia = res.clone();
        caches.open(CACHE_VERSION).then(function(cache){ cache.put(req, copia); });
        return res;
      });
    })
  );
});
