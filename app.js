(async function() {
// WMS configuration is now loaded from config.js

let map, layerExtent = [-20037508, -20037508, 20037508, 20037508];
let currentBase = localStorage.getItem('lastBase') || 'dark';
let currentCountry = localStorage.getItem('lastCountry') || 'finland';
let currentOpacity = parseFloat(localStorage.getItem('lastOpacity')) || 0.7;
let speedIndex = parseInt(localStorage.getItem('lastSpeedIndex')) || 1;
let intervalDelay = [450, 225, 150, 113][speedIndex];
const speeds = [450, 225, 150, 113];
let prefetchedFrames = [], currentFrame = 0, intervalId = null, isPlaying = true;

// Auto-refresh variables
let refreshIntervalId = null;
let currentConfig = null;
let lastKnownTimes = [];

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
    stopAutoRefresh(); // Stop auto-refresh when switching countries
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

async function fetchTimes(config, silent = false) {
  try {
    // Update status to show we're fetching capabilities (only if not silent)
    if (!silent) {
      showLoadingStatus('Fetching server capabilities...');
    }
    
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    // Build GetCapabilities URL with optional namespace parameter
    let capabilitiesUrl = `${config.wmsUrl}?service=WMS&request=GetCapabilities`;
    if (config.useNamespace) {
      capabilitiesUrl += `&namespace=${config.layerName}`;
    }
    
    const response = await fetch(capabilitiesUrl, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    // Update status to show we're parsing capabilities (only if not silent)
    if (!silent) {
      showLoadingStatus('Processing server capabilities...');
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
    
    // Update status to show capabilities loaded successfully (only if not silent)
    if (!silent) {
      showLoadingStatus('Server capabilities loaded successfully');
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
  // Add global timeout to ensure the entire function never hangs indefinitely
  return new Promise(async (resolve, reject) => {
    const globalTimeoutId = setTimeout(() => {
      console.warn('Global timeout: preloadFrames took longer than 5 minutes, aborting');
      reject(new Error('Frame loading timeout - server too slow or unresponsive'));
    }, 300000); // 5 minute global timeout (increased for slow servers)
    
    try {
      let loadedCount = 0;
      const totalFrames = times.length;
      let hasFirstFrame = false;
      
      // Update status to show we're starting to load images
      showLoadingStatus(`Loading radar images 0/${totalFrames}...`);
      
      // Set progress bar to loading mode (green background)
      progressFill.style.background = '#00ff00';
      progressFill.style.width = '0%';
      
      // Reset prefetchedFrames to allow progressive loading
      prefetchedFrames = [];
      
      // Limit concurrent requests to avoid overwhelming servers
      const BATCH_SIZE = 4; // Reduced batch size for slow servers
      const results = [];
      
      for (let i = 0; i < times.length; i += BATCH_SIZE) {
        const batch = times.slice(i, i + BATCH_SIZE);
        
        const batchPromises = batch.map(time => new Promise(resolve => {
          const img = new Image();
          
          // Add timeout to prevent hanging (increased for slow servers)
          const timeoutId = setTimeout(() => {
            console.warn(`Frame load timeout after 60 seconds for time: ${time}`);
            loadedCount++;
            const progress = (loadedCount / totalFrames) * 100;
            progressFill.style.width = `${progress}%`;
            
            // Update status with timeout info
            showLoadingStatus(`Loading radar images ${loadedCount}/${totalFrames} (some timeouts)...`);
            
            resolve(null); // Resolve with null for timeout
          }, 60000); // 60 second timeout (increased from 30)
          
          img.onload = () => {
            clearTimeout(timeoutId);
            loadedCount++;
            
            // Add successful frame to results immediately
            const frameData = { img, time };
            results.push(frameData);
            
            // Add to prefetchedFrames for immediate use
            prefetchedFrames.push(frameData);
            
            // Start animation as soon as first frame is ready
            if (!hasFirstFrame) {
              hasFirstFrame = true;
              console.log('First frame loaded, starting preview');
              // Update displays and start animation
              currentFrame = 0;
              updateDisplays();
              if (window.enableAnimation !== false) {
                startAnimation();
              }
            }
            
            // Update progress bar as frames load
            const progress = (loadedCount / totalFrames) * 100;
            progressFill.style.width = `${progress}%`;
            
            // Update loading status to show frame count
            showLoadingStatus(`Loading radar images ${loadedCount}/${totalFrames}...`);
            
            resolve(frameData);
          };
          img.onerror = () => {
            clearTimeout(timeoutId);
            loadedCount++;
            // Update progress even for failed frames
            const progress = (loadedCount / totalFrames) * 100;
            progressFill.style.width = `${progress}%`;
            
            // Update loading status to show frame count with error info
            showLoadingStatus(`Loading radar images ${loadedCount}/${totalFrames} (some errors)...`);
            
            console.warn(`Failed to load frame for time: ${time}`);
            resolve(null);
          };
          img.src = `${config.wmsUrl}?service=WMS&version=1.3.0&request=GetMap&layers=${config.layerName}&styles=&format=image/svg+xml&transparent=true&crs=EPSG:3857&bbox=${layerExtent.join(',')}&width=4096&height=4096&time=${time}`.replace(/\+/g, '%2B');
        }));
        
        // Wait for current batch to complete before starting next batch
        const batchResults = await Promise.all(batchPromises);
        // Don't add to results here since we're adding directly in onload
      }
      
      // Sort prefetchedFrames by time to ensure correct order
      prefetchedFrames.sort((a, b) => new Date(a.time) - new Date(b.time));
      
      // Filter out null results for final count
      const successfulFrames = results.filter(f => f);
      console.log(`Successfully loaded ${successfulFrames.length} out of ${totalFrames} frames`);
      
      // Show completion status first
      showLoadingStatus(`Loading radar images ${loadedCount}/${totalFrames}...`);
      
      // Wait a moment to show the final count, then show completion message
      setTimeout(() => {
        if (successfulFrames.length === totalFrames) {
          showLoadingStatus(`All ${totalFrames} radar images loaded successfully!`);
        } else if (successfulFrames.length > 0) {
          showLoadingStatus(`Loaded ${successfulFrames.length} of ${totalFrames} radar images`);
        }
        
        // Hide loading status after showing completion message
        setTimeout(() => {
          hideLoadingStatus();
        }, 2000);
      }, 500);
      
      // Reset progress bar to normal blue color after loading
      progressFill.style.background = '#00aaff';
      progressFill.style.width = '0%';
      
      clearTimeout(globalTimeoutId);
      resolve();
      
    } catch (error) {
      clearTimeout(globalTimeoutId);
      reject(error);
    }
  });
}

function showError(message) {
  // Create or update error display
  let errorDiv = document.getElementById('errorMessage');
  if (!errorDiv) {
    errorDiv = document.createElement('div');
    errorDiv.id = 'errorMessage';
    errorDiv.style.cssText = `
      position: fixed;
      top: max(40px, calc(40px + env(safe-area-inset-top)));
      left: calc(10px + env(safe-area-inset-left));
      right: calc(10px + env(safe-area-inset-right));
      background: #ff4444;
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      z-index: 1000;
      font-family: Arial, sans-serif;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
      text-align: center;
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

function showLoadingStatus(message) {
  // Create or update loading status display
  let loadingDiv = document.getElementById('loadingMessage');
  if (!loadingDiv) {
    loadingDiv = document.createElement('div');
    loadingDiv.id = 'loadingMessage';
    loadingDiv.style.cssText = `
      position: fixed;
      top: max(40px, calc(40px + env(safe-area-inset-top)));
      left: calc(10px + env(safe-area-inset-left));
      right: calc(10px + env(safe-area-inset-right));
      background: #0088cc;
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      z-index: 1000;
      font-family: Arial, sans-serif;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
      text-align: center;
    `;
    document.body.appendChild(loadingDiv);
  }
  
  loadingDiv.textContent = message;
  loadingDiv.style.display = 'block';
}

function hideLoadingStatus() {
  const loadingDiv = document.getElementById('loadingMessage');
  if (loadingDiv) {
    loadingDiv.style.display = 'none';
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
    showLoadingStatus('Connecting to radar server...');
    hideError();
    
    console.log(`Initializing map for ${Object.keys(wmsConfigs).find(key => wmsConfigs[key] === config)}`);
    
    const times = await fetchTimes(config);
    
    if (times.length === 0) {
      throw new Error('No radar data available for this region');
    }
    
    console.log(`Found ${times.length} time frames`);
    
    // Store config and times for auto-refresh
    currentConfig = config;
    lastKnownTimes = [...times]; // Make a copy of the times array
    
    // Update status to show we're preparing to load images
    showLoadingStatus('Preparing to load radar images...');
    
    // Immediately fit the map to the country extent after GetCapabilities
    map.getView().fit(layerExtent, { size: map.getSize(), duration: 1000 });
    
    // Set up canvas source early so progressive loading can use it
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

    // Add layer to map early
    if (imageCanvasLayer) map.removeLayer(imageCanvasLayer);
    imageCanvasLayer = new ol.layer.Image({ source: imageCanvasSource, opacity: currentOpacity });
    map.getLayers().insertAt(1, imageCanvasLayer);
    
    // Start loading frames progressively in the background
    // This will start animation as soon as first frame is ready
    await preloadFrames(config, times);
    
    // Final check - if no frames loaded, show error
    if (prefetchedFrames.length === 0) {
      throw new Error('Failed to load radar images');
    }
    
    // Start auto-refresh after successful initialization
    startAutoRefresh();
    
    console.log('Map initialization completed successfully');
    
  } catch (error) {
    console.error('Error initializing map:', error);
    showError(`Failed to load radar data: ${error.message}`);
    
    // Reset state on error
    prefetchedFrames = [];
    currentFrame = 0;
    stopAnimation();
    stopAutoRefresh(); // Stop auto-refresh on error
    
    // Clear any existing radar layer
    if (imageCanvasLayer) {
      map.removeLayer(imageCanvasLayer);
      imageCanvasLayer = null;
    }
    
  } finally {
    hideLoadingStatus();
  }
}

// New functions for checking and loading specific frames
async function checkForNewFrames() {
  if (!currentConfig) {
    console.log('No current configuration available for auto-refresh');
    return;
  }
  
  if (!lastKnownTimes || lastKnownTimes.length === 0) {
    console.log('No last known times available for comparison');
    return;
  }
  
  try {
    console.log('Checking for new radar frames...');
    
    // Fetch latest times
    const newTimes = await fetchTimes(currentConfig, true); // true = silent mode
    
    if (!newTimes || newTimes.length === 0) {
      console.log('No new times received from server');
      return;
    }
    
    // Compare with last known times
    const newTimesteps = newTimes.filter(time => !lastKnownTimes.includes(time));
    
    if (newTimesteps.length === 0) {
      console.log('No new radar frames available');
      return;
    }
    
    console.log(`Found ${newTimesteps.length} new radar frames`);
    
    // Load new frames
    const newFrames = await loadSpecificFrames(currentConfig, newTimesteps);
    
    if (newFrames.length > 0) {
      // Add new frames to the end of prefetchedFrames
      prefetchedFrames.push(...newFrames);
      
      // Sort all frames by time to ensure correct order
      prefetchedFrames.sort((a, b) => new Date(a.time) - new Date(b.time));
      
      // Keep only the latest 12 frames
      if (prefetchedFrames.length > 12) {
        const framesToRemove = prefetchedFrames.length - 12;
        prefetchedFrames.splice(0, framesToRemove);
        
        // Adjust current frame index if needed
        if (currentFrame >= framesToRemove) {
          currentFrame -= framesToRemove;
        } else {
          currentFrame = 0;
        }
      }
      
      // Update last known times
      lastKnownTimes = [...newTimes]; // Make a copy
      
      // Update displays and canvas source
      updateDisplays();
      if (imageCanvasSource) {
        imageCanvasSource.changed();
      }
      
      console.log(`Updated radar animation with ${newFrames.length} new frames`);
      
      // Brief notification to user
      showLoadingStatus(`Added ${newFrames.length} new radar images`);
      setTimeout(() => {
        hideLoadingStatus();
      }, 2000);
    }
    
  } catch (error) {
    console.error('Error checking for new frames:', error);
    // Don't show error to user for background checks unless it's critical
    // Only log to console to avoid interrupting user experience
  }
}

async function loadSpecificFrames(config, times) {
  const newFrames = [];
  
  // Load frames with reduced batch size for background updates
  const BATCH_SIZE = 2;
  
  for (let i = 0; i < times.length; i += BATCH_SIZE) {
    const batch = times.slice(i, i + BATCH_SIZE);
    
    const batchPromises = batch.map(time => new Promise(resolve => {
      const img = new Image();
      
      // Shorter timeout for background updates
      const timeoutId = setTimeout(() => {
        console.warn(`Background frame load timeout for time: ${time}`);
        resolve(null);
      }, 30000); // 30 second timeout
      
      img.onload = () => {
        clearTimeout(timeoutId);
        const frameData = { img, time };
        newFrames.push(frameData);
        resolve(frameData);
      };
      
      img.onerror = () => {
        clearTimeout(timeoutId);
        console.warn(`Failed to load background frame for time: ${time}`);
        resolve(null);
      };
      
      img.src = `${config.wmsUrl}?service=WMS&version=1.3.0&request=GetMap&layers=${config.layerName}&styles=&format=image/svg+xml&transparent=true&crs=EPSG:3857&bbox=${layerExtent.join(',')}&width=4096&height=4096&time=${time}`.replace(/\+/g, '%2B');
    }));
    
    await Promise.all(batchPromises);
  }
  
  return newFrames.filter(frame => frame !== null);
}

function startAutoRefresh() {
  // Clear any existing refresh interval
  if (refreshIntervalId) {
    clearInterval(refreshIntervalId);
    refreshIntervalId = null;
  }
  
  // Only start auto-refresh if we have a valid configuration
  if (!currentConfig) {
    console.log('Cannot start auto-refresh: No current configuration available');
    return;
  }
  
  // Start checking for new frames every minute
  refreshIntervalId = setInterval(checkForNewFrames, 60000); // 60 seconds
  console.log('Auto-refresh started - checking for new frames every minute');
  
  // Also check for new frames immediately after a short delay
  // This helps catch any frames that became available during initialization
  setTimeout(checkForNewFrames, 10000); // Check again after 10 seconds
}

function stopAutoRefresh() {
  if (refreshIntervalId) {
    clearInterval(refreshIntervalId);
    refreshIntervalId = null;
    console.log('Auto-refresh stopped');
  }
}

// Initialize with error handling
(async () => {
  try {
    // Stop any existing auto-refresh before initializing
    stopAutoRefresh();
    
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

