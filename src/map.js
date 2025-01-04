const photosSource = new ol.source.Vector();
const clusterSource = new ol.source.Cluster({
  distance: 30,
  minDistance: 10,
  source: photosSource
});

// Configure map layers: bottom - OpenStreetMap map, top - photo thumbnails
const layerOSM = new ol.layer.Tile({
  source: new ol.source.OSM()
});
const layerClusters = new ol.layer.Vector({
  source: clusterSource,
  style: clusterStyle,
  updateWhileAnimating: true,
  updateWhileInteracting: true,
});
const map = new ol.Map({
  target: 'map',
  layers: [layerOSM, layerClusters],
  view: new ol.View({
    center: ol.proj.transform([20, 47], 'EPSG:4326', 'EPSG:3857'),
    zoom: 4,
    maxZoom: 20
  })
});

map.on('click', event => {
  layerClusters.getFeatures(event.pixel).then(clickedFeatures => {
    if (!clickedFeatures.length) return;
    const features = clickedFeatures[0].get('features');
    if (features.length > 1 && !isMaximumZoom(map.getView())) {
      // Zoom in
      const extent = ol.extent.boundingExtent(
        features.map(r => r.getGeometry().getCoordinates()),
      );
      map.getView().fit(extent, {duration: 400, padding: [150, 150, 150, 150]});
    } else {
      // Show photo details
      const details = features.map(f => photoDetails(f));
      document.getElementById('photo-details').innerHTML = details.join();
    }
  });
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
},{
  "name": "dsc03425_1211.jpg",
  "path": "https://annimon.com/albums/files/dsc03425_1211.jpg",
  "preview": "https://annimon.com/albums/screens/dsc03425_1211.jpg.250.png",
  "lat": 47.8,
  "lon": 37.27,
  "make": "Sony Ericsson",
  "model": "C510i",
  "date": "2011-06-03 16:55:23"
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

function clusterStyle(feature, resolution) {
  const features = feature.get('features');
  const size = features.length;
  if (size === 1) return thumbStyle(features[0], resolution);

  const key = `cl-${size}`;
  if (!cache[key]) {
    cache[key] = new ol.style.Style({
      zIndex: 110,
      image: new ol.style.Circle({
        radius: 12,
        stroke: new ol.style.Stroke({color: '#8AFFD9'}),
        fill: new ol.style.Fill({color: '#229D75'})
      }),
      text: new ol.style.Text({
        text: `${size}`,
        fill: new ol.style.Fill({color: '#fff'})
      }),
    });
  }
  return cache[key];
}

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

function isMaximumZoom(view) {
  const maxZoom = view.getMaxZoom();
  const currentZoom = view.getZoom();
  return currentZoom >= maxZoom;
}