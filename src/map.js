const photosSource = new ol.source.Vector();

const layerOSM = new ol.layer.Tile({
  source: new ol.source.OSM()
});
const layerThumbs = new ol.layer.Vector({
  source: photosSource,
  style: thumbStyle,
});
const map = new ol.Map({
  target: 'map',
  layers: [layerOSM, layerThumbs],
  view: new ol.View({
    center: ol.proj.transform([20, 47], 'EPSG:4326', 'EPSG:3857'),
    zoom: 4
  })
});

const handleMapDataLoaded = items => {
  const transform = ol.proj.getTransform('EPSG:4326', 'EPSG:3857');
  items.forEach(item => {
    const feature = new ol.Feature(item);
    feature.set('url', item.preview);
    const coordinate = transform([parseFloat(item.lon), parseFloat(item.lat)]);
    feature.setGeometry(new ol.geom.Point(coordinate));
    photosSource.addFeature(feature);
  });
};
handleMapDataLoaded([{
  "preview": "https://annimon.com/albums/screens/dsc_1337_ps_5996.jpg.250.png",
  "lat": 47.765957,
  "lon": 37.255646
}]);

// -- icon styles --
const cache = {};

function photoStyle(feature, scale) {
  const url = feature.get('url');
  const key = `${scale}${url}`;
  if (!cache[key]) {
    cache[key] = new ol.style.Style({
      image: new ol.style.Icon({src: url, scale})
    });
  }
  return cache[key];
}

function thumbStyle(feature, resolution) {
  return [photoStyle(feature, clamp(0.2, 0.1 / resolution, 1))];
}

function clamp(min, value, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}