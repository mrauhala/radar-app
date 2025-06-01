// WMS Configuration for Radar Data Sources
// Add new countries and their WMS endpoints here

const wmsConfigs = {
  finland: {
    wmsUrl: 'https://data.fmi.fi/fmi-apikey/a4fffcae-8a20-4765-8d34-777cf1ac5b0a/wms',
    layerName: 'fmi:observation:radar:PrecipitationRate5min',
    displayName: 'Finland',
    description: 'Finnish Meteorological Institute (FMI) radar data',
    useNamespace: true
  },
  ethiopia: {
    wmsUrl: 'https://data-ethiopia.smartmet.org/wms',
    layerName: 'radar:composite_dbz',
    displayName: 'Ethiopia',
    description: 'SmartMet radar composite',
    useNamespace: true
  },
  vietnam: {
    wmsUrl: 'https://data.apps.nchmf.gov.vn/wms',
    layerName: 'vnmha:radar:comp_dbz',
    displayName: 'Vietnam',
    description: 'Vietnam National Center for Hydro-Meteorological Forecasting',
    useNamespace: false
  },
  georgia: {
    wmsUrl: 'https://data.nea.gov.ge/wms',
    layerName: 'radar:composite_dbz',
    displayName: 'Georgia',
    description: 'National Environment Agency of Georgia',
    useNamespace: true
  }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { wmsConfigs };
} else {
  window.wmsConfigs = wmsConfigs;
}
