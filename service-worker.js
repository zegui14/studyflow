// StudyFlow — Service Worker
// Sube este número cada vez que subas una versión nueva de index.html;
// si no lo subes, los usuarios se quedan con la versión vieja en caché.
var CACHE_VERSION = 'studyflow-v2';

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

self.addEventListener('push', function(event){
  var datos = {};
  try{ datos = event.data ? event.data.json() : {}; }catch(e){ datos = {titulo:'StudyFlow', cuerpo: event.data ? event.data.text() : ''}; }
  var titulo = datos.titulo || 'StudyFlow';
  var opciones = {
    body: datos.cuerpo || '',
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    data: { url: datos.url || './' }
  };
  event.waitUntil(self.registration.showNotification(titulo, opciones));
});

self.addEventListener('notificationclick', function(event){
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || './';
  event.waitUntil(
    clients.matchAll({type:'window', includeUncontrolled:true}).then(function(lista){
      for(var i=0;i<lista.length;i++){
        if('focus' in lista[i]) return lista[i].focus();
      }
      if(clients.openWindow) return clients.openWindow(url);
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
