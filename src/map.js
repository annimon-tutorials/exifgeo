const photosSource = new ol.source.Vector();

// Configure map layers: bottom - OpenStreetMap map, top - photo thumbnails
const layerOSM = new ol.layer.Tile({
  source: new ol.source.OSM()
});
const layerThumbs = new ol.layer.Vector({
  source: photosSource,
  style: thumbStyle,
  updateWhileAnimating: true,
  updateWhileInteracting: true,
});
const map = new ol.Map({
  target: 'map',
  layers: [layerOSM, layerThumbs],
  view: new ol.View({
    center: ol.proj.transform([20, 47], 'EPSG:4326', 'EPSG:3857'),
    zoom: 4
  })
});

// Configure thumbnail selector
const thumbSelector = new ol.interaction.Select({
  layers: [layerThumbs],
  style: selectedStyle
});
map.addInteraction(thumbSelector);

const selectedFeatures = thumbSelector.getFeatures();
selectedFeatures.on('add', event => {
  const feature = event.target.item(0);
  const details = photoDetails(feature);
  document.getElementById('photo-details').innerHTML = details;
});
selectedFeatures.on('remove', () => {
  document.getElementById('photo-details').innerHTML = '';
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
  "name": "dsc_1337_ps_5996.jpg",
  "path": "https://annimon.com/albums/files/dsc_1337_ps_5996.jpg",
  "preview": "https://annimon.com/albums/screens/dsc_1337_ps_5996.jpg.250.png",
  "lat": 47.765957,
  "lon": 37.255646,
  "make": "Sony Ericsson",
  "model": "MK16i",
  "date": "2017-06-02 19:30:08"
}]);

// -- photo details --
function photoDetails(feature) {
  let content = document.getElementById('photo-template').innerHTML;
  const keys = ['name', 'preview', 'date', 'lat', 'lon', 'make', 'model', 'path'];
  keys.forEach(key => {
    const value = feature.get(key);
    content = content.replace(`{${key}}`, value);
  });
  return content;
}

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

function selectedStyle(feature, resolution) {
  return [photoStyle(feature, clamp(0.4, 0.14 / resolution, 1.2))];
}

function clamp(min, value, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}