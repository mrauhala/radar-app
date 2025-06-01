(async function() {
const wmsConfigs = {
  finland: { wmsUrl: 'https://data.fmi.fi/fmi-apikey/dc50c49c-8111-4b48-aa2c-e9797f5c71da/wms', layerName: 'fmi:observation:radar:PrecipitationRate5min' },
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
    if (prefetchedFrames.length > 0) {
      startAnimation();
    }
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
  layers: [currentBase === 'light' ? baseLayerLight : baseLayerDark, currentBase === 'dark' ? overlayLayerLight : overlayLayerDark],
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
  try {
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    const response = await fetch(`${config.wmsUrl}?service=WMS&request=GetCapabilities&namespace=${config.layerName}`, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const xml = await response.text();
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    
    // Check for XML parsing errors
    const parserError = doc.querySelector('parsererror');
    if (parserError) {
      throw new Error('Invalid XML response from server');
    }
    
    const layerNode = Array.from(doc.getElementsByTagName('Layer')).find(l => l.querySelector('Name')?.textContent === config.layerName);
    if (!layerNode) {
      throw new Error(`Layer ${config.layerName} not found in GetCapabilities response`);
    }
    
    const bbox = layerNode.querySelector('BoundingBox[CRS="EPSG:3857"], BoundingBox[SRS="EPSG:3857"]');
    if (bbox) {
      layerExtent = [bbox.getAttribute('minx'), bbox.getAttribute('miny'), bbox.getAttribute('maxx'), bbox.getAttribute('maxy')].map(parseFloat);
    }
    
    const dim = layerNode.querySelector('Dimension[name="time"]');
    if (!dim || !dim.textContent) {
      throw new Error('No time dimension found in layer');
    }
    
    return dim.textContent.includes(',') ? dim.textContent.split(',').slice(-12) : parsePeriodTimes(dim.textContent).slice(-12);
  } catch (error) {
    console.error('Error fetching times:', error);
    
    if (error.name === 'AbortError') {
      throw new Error('Request timeout - server took too long to respond');
    }
    
    throw error;
  }
}

async function preloadFrames(config, times) {
  const promises = times.map(time => new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve({ img, time });
    img.onerror = () => resolve(null);
    img.src = `${config.wmsUrl}?service=WMS&version=1.3.0&request=GetMap&layers=${config.layerName}&styles=&format=image/svg+xml&transparent=true&crs=EPSG:3857&bbox=${layerExtent.join(',')}&width=4096&height=4096&time=${time}`.replace(/\+/g, '%2B');
  }));
  prefetchedFrames = (await Promise.all(promises)).filter(f => f);
}

function showError(message) {
  // Create or update error display
  let errorDiv = document.getElementById('errorMessage');
  if (!errorDiv) {
    errorDiv = document.createElement('div');
    errorDiv.id = 'errorMessage';
    errorDiv.style.cssText = `
      position: fixed;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      background: #ff4444;
      color: white;
      padding: 10px 20px;
      border-radius: 5px;
      z-index: 1000;
      font-family: Arial, sans-serif;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    `;
    document.body.appendChild(errorDiv);
  }
  
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    if (errorDiv) {
      errorDiv.style.display = 'none';
    }
  }, 5000);
}

function hideError() {
  const errorDiv = document.getElementById('errorMessage');
  if (errorDiv) {
    errorDiv.style.display = 'none';
  }
}

function updateDisplays() {
  if (prefetchedFrames.length === 0) return;
  
  const frameTime = new Date(prefetchedFrames[currentFrame].time);
  timeDisplay.textContent = `${frameTime.getUTCHours().toString().padStart(2, '0')}.${frameTime.getUTCMinutes().toString().padStart(2, '0')} UTC`;
  dateDisplay.textContent = `${frameTime.getUTCDate()}.${frameTime.getUTCMonth() + 1}.${frameTime.getUTCFullYear()}`;
  progressFill.style.width = `${(currentFrame / (prefetchedFrames.length - 1)) * 100}%`;
}

function nextFrame() { 
  if (prefetchedFrames.length === 0) return;
  currentFrame = (currentFrame + 1) % prefetchedFrames.length; 
  imageCanvasSource.changed(); 
  updateDisplays(); 
}

function prevFrame() { 
  if (prefetchedFrames.length === 0) return;
  currentFrame = (currentFrame - 1 + prefetchedFrames.length) % prefetchedFrames.length; 
  imageCanvasSource.changed(); 
  updateDisplays(); 
}

function startAnimation() { 
  if (prefetchedFrames.length === 0) return;
  clearInterval(intervalId); 
  intervalId = setInterval(nextFrame, intervalDelay); 
  isPlaying = true; 
  playIcon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>'; 
}

function stopAnimation() { 
  clearInterval(intervalId); 
  intervalId = null; 
  isPlaying = false; 
  playIcon.innerHTML = '<path d="M8 5v14l11-7z"/>'; 
}

async function initMap(config) {
  try {
    // Show loading indicator for entire process
    loadingIndicator.style.display = 'flex';
    hideError();
    
    console.log(`Initializing map for ${Object.keys(wmsConfigs).find(key => wmsConfigs[key] === config)}`);
    
    const times = await fetchTimes(config);
    
    if (times.length === 0) {
      throw new Error('No radar data available for this region');
    }
    
    console.log(`Found ${times.length} time frames`);
    
    await preloadFrames(config, times);
    
    if (prefetchedFrames.length === 0) {
      throw new Error('Failed to load radar images');
    }
    
    imageCanvasSource = new ol.source.ImageCanvas({
      canvasFunction: (extent, res, ratio, size) => {
        if (prefetchedFrames.length === 0) return document.createElement('canvas');
        
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
    
    console.log('Map initialization completed successfully');
    
  } catch (error) {
    console.error('Error initializing map:', error);
    showError(`Failed to load radar data: ${error.message}`);
    
    // Reset state on error
    prefetchedFrames = [];
    currentFrame = 0;
    stopAnimation();
    
    // Clear any existing radar layer
    if (imageCanvasLayer) {
      map.removeLayer(imageCanvasLayer);
      imageCanvasLayer = null;
    }
    
  } finally {
    loadingIndicator.style.display = 'none';
  }
}

// Initialize with error handling
(async () => {
  try {
    await initMap(wmsConfigs[currentCountry]);
    if (prefetchedFrames.length > 0) {
      startAnimation();
    }
  } catch (error) {
    console.error('Failed to initialize application:', error);
    showError('Failed to initialize radar application');
  }
})();
})();

