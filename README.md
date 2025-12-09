

## Features

### Real-Time Weather Data Analysis

The app continuously analyzes real-time weather conditions and generates intelligent forecasts:

**Real-Time Metrics Collected:**
- Temperature & humidity tracking
- Cloud cover percentage
- Wind speed and direction
- Atmospheric pressure
- Precipitation detection

**Advanced Weather Analysis:**
- **Trend Detection**: Analyzes temperature, cloud cover, wind, and pressure changes over 24 hours
- **Weather Pattern Recognition**: Identifies weather stability and forecast reliability
- **Severe Weather Alerts**: Detects extreme conditions (heavy clouds, extreme temperatures, high winds, pressure changes)
- **Forecast Quality Scoring**: Automatically rates forecast reliability (10-99% confidence)

### Advanced Solar Forecast Algorithms

The app uses sophisticated meteorological algorithms for accurate solar irradiance prediction:

- **Spencer's Solar Position Equations**: Highly accurate solar position calculations for any location and time
- **Ineichen-Perez Clear-Sky Model**: Theoretical maximum irradiance under clear conditions
- **Advanced Cloud Impact Modeling**: Non-linear cloud cover analysis with temperature correction
- **Aerosol Optical Depth Estimation**: Atmospheric scattering and pollution effects
- **Irradiance Decomposition**: Splits global irradiance into Direct Normal (DNI) and Diffuse (DHI) components
- **Temperature Loss Correction**: -0.4% efficiency loss per °C above 25°C
- **Weather Pattern Confidence Scoring**: Dynamic confidence estimation based on cloud stability and atmospheric conditions

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. The app uses **Open-Meteo** API for weather data and forecasting - no API key required!
3. Run the app:
   `npm run dev`
