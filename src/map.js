const layerOSM = new ol.layer.Tile({
  source: new ol.source.OSM()
});
const map = new ol.Map({
  target: 'map',
  layers: [layerOSM],
  view: new ol.View({
    center: ol.proj.transform([20, 47], 'EPSG:4326', 'EPSG:3857'),
    zoom: 4
  })
});