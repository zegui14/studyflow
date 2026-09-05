/* StudyFlow — Service Worker
   ──────────────────────────────────────────────────────────────────────
   REESCRITO desde cero (2026-09-03) para solucionar el bug de "la app se
   queda pillada en una versión vieja" — incluyendo el color de acento
   revirtiendo tras un reload, que en parte era esto: si este archivo tenía
   cache-first para TODO (incluido index.html) en vez de solo para los
   estáticos, el navegador podía seguir sirviendo un index.html antiguo
   desde la Cache Storage del Service Worker sin llegar siquiera a
   consultar la red, pasando por alto el Cache-Control:no-cache de
   vercel.json (esa cabecera solo la respeta la caché HTTP normal del
   navegador, no la Cache Storage que gestiona este archivo).

   Cambios clave respecto a antes:
   1. self.skipWaiting() en 'install' — el Service Worker nuevo se activa
      YA, sin esperar a que se cierren todas las pestañas.
   2. clients.claim() en 'activate' — toma el control de las pestañas ya
      abiertas de inmediato, no solo de las que se abran después.
   3. Borra CUALQUIER caché con nombre distinto al de esta versión en
      'activate' — así una instalación vieja nunca se queda huérfana
      sirviendo contenido antiguo indefinidamente.
   4. index.html y este mismo archivo: SIEMPRE red primero (network-first)
      de verdad, con caché solo como último recurso sin conexión — nunca
      se sirven desde caché habiendo red disponible.
   5. Estáticos reales (iconos, manifest): cache-first, como antes — no
      cambian nunca, no hace falta ir a la red cada vez.

   Subir este número en cada cambio de ESTE archivo (aunque con el punto 4
   ya no debería hacer falta para forzar actualizaciones de index.html en
   sí — index.html nunca depende de este número para refrescarse). */
var CACHE_VERSION = 'studyflow-v4';
var CACHE_ESTATICOS = CACHE_VERSION + '-estaticos';

var ESTATICOS_PRECACHE = [
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'icon-180.png'
];

self.addEventListener('install', function(event){
  event.waitUntil(
    caches.open(CACHE_ESTATICOS)
      .then(function(cache){
        // addAll falla entero si UN solo archivo de la lista no existe —
        // los precacheamos uno a uno para que un icono que falte no tumbe
        // la instalación del Service Worker completo.
        return Promise.all(ESTATICOS_PRECACHE.map(function(url){
          return cache.add(url).catch(function(err){
            console.warn('[SW] No se pudo precachear', url, err);
          });
        }));
      })
      .then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(event){
  event.waitUntil(
    caches.keys()
      .then(function(nombres){
        return Promise.all(
          nombres
            .filter(function(nombre){ return nombre.indexOf('studyflow-') === 0 && nombre !== CACHE_ESTATICOS; })
            .map(function(nombre){ return caches.delete(nombre); })
        );
      })
      .then(function(){ return self.clients.claim(); })
  );
});

function esArchivoSiempreFresco(url){
  // El propio HTML y este mismo Service Worker: nunca servidos "a ciegas"
  // desde caché mientras haya red. pathname==='/' cubre la carga inicial
  // sin nombre de archivo explícito.
  return url.pathname === '/' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/service-worker.js');
}

self.addEventListener('fetch', function(event){
  var url = new URL(event.request.url);
  if(url.origin !== self.location.origin || event.request.method !== 'GET') return; // no tocar peticiones a Supabase, etc.

  if(esArchivoSiempreFresco(url)){
    // Network-first de verdad: solo se cae a caché si de verdad no hay red.
    event.respondWith(
      fetch(event.request)
        .then(function(res){
          var copia = res.clone();
          caches.open(CACHE_ESTATICOS).then(function(cache){ cache.put(event.request, copia); });
          return res;
        })
        .catch(function(){ return caches.match(event.request); })
    );
    return;
  }

  // Estáticos: cache-first, con la red como respaldo y actualización
  // silenciosa de la caché para la próxima vez.
  event.respondWith(
    caches.match(event.request).then(function(enCache){
      if(enCache) return enCache;
      return fetch(event.request).then(function(res){
        var copia = res.clone();
        caches.open(CACHE_ESTATICOS).then(function(cache){ cache.put(event.request, copia); });
        return res;
      });
    })
  );
});

self.addEventListener('push', function(event){
  var datos = {};
  try{ datos = event.data ? event.data.json() : {}; }catch(e){}
  var titulo = datos.titulo || 'StudyFlow';
  var opciones = {
    body: datos.cuerpo || '',
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    tag: datos.tag || 'studyflow-notif'
  };
  event.waitUntil(self.registration.showNotification(titulo, opciones));
});

self.addEventListener('notificationclick', function(event){
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({type:'window'}).then(function(lista){
      for(var i=0;i<lista.length;i++){
        if('focus' in lista[i]) return lista[i].focus();
      }
      if(self.clients.openWindow) return self.clients.openWindow('/');
    })
  );
});
