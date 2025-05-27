// app.js — full JavaScript logic for radar animation app

(async function() {
const wmsConfigs = {
  ethiopia: { wmsUrl: 'https://data-ethiopia.smartmet.org/wms', layerName: 'radar:composite_dbz' },
  vietnam: { wmsUrl: 'https://data.apps.nchmf.gov.vn/wms', layerName: 'vnmha:radar:comp_dbz' },
  georgia: { wmsUrl: 'https://data.nea.gov.ge/wms', layerName: 'radar:composite_dbz' }
};

let map, layerExtent = [-20037508, -20037508, 20037508, 20037508];
let currentBase = localStorage.getItem('lastBase') || 'light';
let currentCountry = localStorage.getItem('lastCountry') || 'ethiopia';
let currentOpacity = parseFloat(localStorage.getItem('lastOpacity')) || 0.7;
let speedIndex = parseInt(localStorage.getItem('lastSpeedIndex')) || 1;
let intervalDelay = [450, 225, 150, 113][speedIndex];
const speeds = [450, 225, 150, 113];
let prefetchedFrames = [], currentFrame = 0, intervalId = null, isPlaying = true;

const toggleBaseBtn = document.getElementById('toggleBaseBtn');
const opacityBtn = document.getElementById('opacityBtn');
const playPauseBtn = document.getElementById('playPauseBtn');
const nextBtn = document.getElementById('nextBtn');
const prevBtn = document.getElementById('prevBtn');
const speedLabel = document.querySelector('.speed-label');
const playIcon = document.getElementById('playIcon');
const timeDisplay = document.querySelector('.time-box .time');
const dateDisplay = document.querySelector('.time-box .date');
const progressFill = document.getElementById('progress-bar-fill');
const loadingIndicator = document.getElementById('loadingIndicator');
const countryMenu = document.getElementById('countryMenu');
const countrySelectBtn = document.getElementById('countrySelectBtn');

countrySelectBtn.addEventListener('click', () => {
  countryMenu.style.display = countryMenu.style.display === 'block' ? 'none' : 'block';
});
countryMenu.querySelectorAll('button').forEach(btn => {
  btn.addEventListener('click', async () => {
    const country = btn.getAttribute('data-country');
    localStorage.setItem('lastCountry', country);
    countryMenu.style.display = 'none';
    stopAnimation();
    await initMap(wmsConfigs[country]);
    startAnimation();
  });
});

speedLabel.textContent = `${speedIndex + 1}×`;
opacityBtn.textContent = `${Math.round(currentOpacity * 100)}%`;

let imageCanvasSource, imageCanvasLayer, baseLayerLight, baseLayerDark, overlayLayerLight, overlayLayerDark;
baseLayerLight = new ol.layer.Tile({ source: new ol.source.XYZ({ url: 'https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}' }) });
baseLayerDark = new ol.layer.Tile({ source: new ol.source.XYZ({ url: 'https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}' }) });
overlayLayerLight = new ol.layer.Tile({ source: new ol.source.XYZ({ url: 'https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}' }) });
overlayLayerDark = new ol.layer.Tile({ source: new ol.source.XYZ({ url: 'https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}' }) });

map = new ol.Map({
  target: 'map',
  controls: ol.control.defaults({ zoom: false, rotate: false }),
  interactions: ol.interaction.defaults({ altShiftDragRotate: false, pinchRotate: false }),
  layers: [currentBase === 'light' ? baseLayerLight : baseLayerDark, currentBase === 'light' ? overlayLayerLight : overlayLayerDark],
  view: new ol.View({ center: [0, 0], zoom: 2, projection: 'EPSG:3857' })
});

opacityBtn.addEventListener('click', () => {
  currentOpacity = (currentOpacity + 0.1 > 1) ? 0.1 : currentOpacity + 0.1;
  localStorage.setItem('lastOpacity', currentOpacity);
  if (imageCanvasLayer) imageCanvasLayer.setOpacity(currentOpacity);
  opacityBtn.textContent = `${Math.round(currentOpacity * 100)}%`;
});

toggleBaseBtn.addEventListener('click', () => {
  currentBase = currentBase === 'light' ? 'dark' : 'light';
  localStorage.setItem('lastBase', currentBase);
  map.getLayers().setAt(0, currentBase === 'light' ? baseLayerLight : baseLayerDark);
  map.getLayers().setAt(1, currentBase === 'light' ? overlayLayerLight : overlayLayerDark);
});

speedLabel.addEventListener('click', () => {
  speedIndex = (speedIndex + 1) % speeds.length;
  intervalDelay = speeds[speedIndex];
  speedLabel.textContent = `${speedIndex + 1}×`;
  localStorage.setItem('lastSpeedIndex', speedIndex);
  if (isPlaying) startAnimation();
});

playPauseBtn.addEventListener('click', () => { isPlaying ? stopAnimation() : startAnimation(); });
nextBtn.addEventListener('click', () => { stopAnimation(); nextFrame(); });
prevBtn.addEventListener('click', () => { stopAnimation(); prevFrame(); });

function parsePeriodTimes(raw) {
  const [start, end, period] = raw.split('/').map(s => s.trim());
  const startDate = new Date(start), endDate = new Date(end);
  const minutes = /PT(\d+)M/.exec(period) ? parseInt(/PT(\d+)M/.exec(period)[1], 10) : 10;
  const result = [];
  for (let d = new Date(startDate); d <= endDate; d.setMinutes(d.getMinutes() + minutes)) {
    result.push(new Date(d).toISOString());
  }
  return result;
}

async function fetchTimes(config) {
  const xml = await (await fetch(`${config.wmsUrl}?service=WMS&request=GetCapabilities`)).text();
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const layerNode = Array.from(doc.getElementsByTagName('Layer')).find(l => l.querySelector('Name')?.textContent === config.layerName);
  if (!layerNode) return [];
  const bbox = layerNode.querySelector('BoundingBox[CRS="EPSG:3857"], BoundingBox[SRS="EPSG:3857"]');
  if (bbox) layerExtent = [bbox.getAttribute('minx'), bbox.getAttribute('miny'), bbox.getAttribute('maxx'), bbox.getAttribute('maxy')].map(parseFloat);
  const dim = layerNode.querySelector('Dimension[name="time"]');
  return dim.textContent.includes(',') ? dim.textContent.split(',').slice(-12) : parsePeriodTimes(dim.textContent).slice(-12);
}

async function preloadFrames(config, times) {
  loadingIndicator.style.display = 'flex';
  const promises = times.map(time => new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve({ img, time });
    img.onerror = () => resolve(null);
    img.src = `${config.wmsUrl}?service=WMS&version=1.3.0&request=GetMap&layers=${config.layerName}&styles=&format=image/svg+xml&transparent=true&crs=EPSG:3857&bbox=${layerExtent.join(',')}&width=4096&height=4096&time=${time}`.replace(/\+/g, '%2B');
  }));
  prefetchedFrames = (await Promise.all(promises)).filter(f => f);
  loadingIndicator.style.display = 'none';
}

function updateDisplays() {
  const frameTime = new Date(prefetchedFrames[currentFrame].time);
  timeDisplay.textContent = `${frameTime.getUTCHours().toString().padStart(2, '0')}.${frameTime.getUTCMinutes().toString().padStart(2, '0')} UTC`;
  dateDisplay.textContent = `${frameTime.getUTCDate()}.${frameTime.getUTCMonth() + 1}.${frameTime.getUTCFullYear()}`;
  progressFill.style.width = `${(currentFrame / (prefetchedFrames.length - 1)) * 100}%`;
}

function nextFrame() { currentFrame = (currentFrame + 1) % prefetchedFrames.length; imageCanvasSource.changed(); updateDisplays(); }
function prevFrame() { currentFrame = (currentFrame - 1 + prefetchedFrames.length) % prefetchedFrames.length; imageCanvasSource.changed(); updateDisplays(); }
function startAnimation() { clearInterval(intervalId); intervalId = setInterval(nextFrame, intervalDelay); isPlaying = true; playIcon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>'; }
function stopAnimation() { clearInterval(intervalId); intervalId = null; isPlaying = false; playIcon.innerHTML = '<path d="M8 5v14l11-7z"/>'; }

async function initMap(config) {
  const times = await fetchTimes(config);
  await preloadFrames(config, times);
  imageCanvasSource = new ol.source.ImageCanvas({
    canvasFunction: (extent, res, ratio, size) => {
      const canvas = document.createElement('canvas');
      canvas.width = size[0];
      canvas.height = size[1];
      const ctx = canvas.getContext('2d');
      const img = prefetchedFrames[currentFrame].img;
      const scaleX = size[0] / (extent[2] - extent[0]) * (layerExtent[2] - layerExtent[0]) / img.width;
      const scaleY = size[1] / (extent[3] - extent[1]) * (layerExtent[3] - layerExtent[1]) / img.height;
      const dx = (layerExtent[0] - extent[0]) / (extent[2] - extent[0]) * size[0];
      const dy = (extent[3] - layerExtent[3]) / (extent[3] - extent[1]) * size[1];
      ctx.setTransform(scaleX, 0, 0, scaleY, dx, dy);
      ctx.drawImage(img, 0, 0);
      return canvas;
    },
    projection: 'EPSG:3857', ratio: 1, imageExtent: layerExtent
  });

  if (imageCanvasLayer) map.removeLayer(imageCanvasLayer);
  imageCanvasLayer = new ol.layer.Image({ source: imageCanvasSource, opacity: currentOpacity });
  map.getLayers().insertAt(1, imageCanvasLayer);
  map.getView().fit(layerExtent, { size: map.getSize() });
  currentFrame = 0;
  updateDisplays();
  startAnimation();
}

await initMap(wmsConfigs[currentCountry]);
})();

