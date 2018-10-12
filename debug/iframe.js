var doc = document.getElementById('frame').contentWindow.document;
doc.open();

// more minimal test case
// doc.write('<script>window.history.replaceState(window.history.state, "", "asdf.html");</script>');

doc.write('<!DOCTYPE html><html><head><title>Mapbox GL JS debug page</title><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no"><link rel="stylesheet" href="/dist/mapbox-gl.css" /><style>body { margin: 0; padding: 0; }html, body, #map { height: 100%; }</style></head><body><div id="map"></div><script src="/dist/mapbox-gl-dev.js"></script><script src="/debug/access_token_generated.js"></script><script>var map = window.map = new mapboxgl.Map({container: "map",zoom: 12.5,center: [-77.01866, 38.888],style: "mapbox://styles/mapbox/streets-v10",hash: true});</script></body></html>'); 
doc.close();
