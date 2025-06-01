# 🌦️ Radar Animation Web App

A mobile-optimized web application for visualizing weather radar data from multiple countries. Built with OpenLayers and vanilla JavaScript for fast, responsive performance.

## ✨ Features

- **Multi-Country Support**: View radar data from Finland, Ethiopia, Vietnam, and Georgia
- **Real-Time Animation**: Animated radar loops showing precipitation movement
- **Mobile Optimized**: Responsive design with touch-friendly controls
- **Offline Capable**: Progressive Web App (PWA) features
- **Dark/Light Themes**: Toggle between light and dark base maps *(Dark theme default)*
- **Adjustable Opacity**: Control radar overlay transparency
- **Variable Speed**: Multiple animation speeds (1×, 2×, 3×, 4×)
- **Error Handling**: Robust error handling with user-friendly messages
- **Auto-Zoom**: Automatically zooms to country extent when switching regions

## 🚀 Quick Start

### Local Development

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd radar-app
   ```

2. **Start a local server**
   ```bash
   # Using Python
   python3 -m http.server 8000
   
   # Using Node.js
   npx serve .
   
   # Using PHP
   php -S localhost:8000
   ```

3. **Open in browser**
   ```
   http://localhost:8000
   ```

### Docker Deployment

```bash
# Build the image
docker build -t radar-app .

# Run the container
docker run -p 8080:80 radar-app
```

### Kubernetes Deployment

```bash
kubectl apply -f deployment.yaml
```

## 🎮 Controls

| Control | Action |
|---------|--------|
| 🌍 Globe Icon | Select country/region |
| 🌙 Moon Icon | Toggle light/dark theme |
| **70%** | Adjust radar opacity |
| **2×** | Change animation speed |
| ⏮️ | Previous frame |
| ⏯️ | Play/pause animation |
| ⏭️ | Next frame |

## 🗺️ Supported Regions

- **🇫🇮 Finland**: Finnish Meteorological Institute (FMI) radar data *(Default)*
- **🇪🇹 Ethiopia**: SmartMet radar composite
- **🇻🇳 Vietnam**: Vietnam National Center for Hydro-Meteorological Forecasting
- **🇬🇪 Georgia**: National Environment Agency of Georgia

## 🛠️ Technical Details

### Architecture

- **Frontend**: Vanilla JavaScript, OpenLayers 10.5.0
- **Maps**: ArcGIS World Light/Dark Gray basemaps
- **Data Sources**: WMS (Web Map Service) endpoints
- **Projection**: EPSG:3857 (Web Mercator)
- **Image Format**: SVG for crisp, scalable graphics

### Data Flow

1. **GetCapabilities**: Fetches available time frames and geographic bounds
2. **Auto-Zoom**: Map immediately zooms to country extent
3. **GetMap**: Loads radar images for each time frame in parallel
4. **Animation**: Cycles through frames with configurable speed
5. **Error Handling**: Graceful degradation on network issues

### Performance Features

- **Parallel Loading**: All radar frames load simultaneously
- **Image Caching**: Frames cached in memory for smooth animation
- **Request Timeouts**: 15-second timeout prevents hanging
- **Progressive Enhancement**: Base map works even if radar fails
- **Local Storage**: Remembers user preferences

## 📁 Project Structure

```
radar-app/
├── index.html          # Main HTML file
├── app.js             # Core application logic
├── config.js          # WMS configuration (edit this to add new data sources)
├── README.md          # Documentation
├── Dockerfile         # Docker configuration
└── deployment.yaml    # Kubernetes deployment
```

## 🔧 Configuration

### Adding New Data Sources

Edit the `wmsConfigs` object in `config.js`:

```javascript
const wmsConfigs = {
  newCountry: {
    wmsUrl: 'https://your-wms-server.com/wms',
    layerName: 'your:layer:name',
    displayName: 'New Country',
    description: 'Description of the data source'
  }
};
```

Don't forget to add the corresponding menu item in `index.html`:

```html
<div id="countryMenu">
  <!-- existing countries -->
  <button data-country="newCountry">New Country</button>
</div>
```

### Customizing Animation

Modify the `speeds` array to change available animation speeds:

```javascript
const speeds = [450, 225, 150, 113]; // milliseconds between frames
```

## 📱 Mobile Features

- **Viewport Optimization**: Prevents zooming and handles safe areas
- **Touch-Friendly**: Large touch targets for mobile interaction
- **PWA Ready**: Can be installed as a mobile app
- **Offline Resilient**: Continues working with cached base maps

## 🐛 Error Handling

The application includes comprehensive error handling:

- **Network Timeouts**: 15-second timeout on all requests
- **Invalid Responses**: XML parsing validation
- **Missing Data**: Graceful fallback when radar unavailable
- **User Feedback**: Clear error messages with auto-hide
- **State Recovery**: App continues functioning after errors

## 🔍 Troubleshooting

### Common Issues

**Map doesn't load radar data**
- Check browser console for error messages
- Verify WMS server is accessible
- Check if CORS is enabled on the server

**Animation stutters**
- Reduce animation speed
- Check network connection
- Clear browser cache

**Mobile display issues**
- Ensure viewport meta tag is present
- Check CSS safe area insets
- Verify touch event handling

### Development Tips

- Use browser dev tools Network tab to monitor WMS requests
- Console shows detailed logging for debugging
- Error messages appear at top of screen for 5 seconds

## 📄 License

This project is open source. Please check with data providers for their specific usage terms.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📞 Support

For issues or questions:
- Check the browser console for error messages
- Verify WMS endpoints are accessible
- Report bugs with detailed reproduction steps

---

*Built with ❤️ for weather enthusiasts and developers*