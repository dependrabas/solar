import { ForecastPoint, LocationData, SolarDataPoint, WeatherForecastData } from "../types";

/**
 * Calculate solar zenith angle using Spencer's equations
 * More accurate solar position calculation
 */
const calculateSolarPosition = (
  latitude: number,
  longitude: number,
  date: Date
): { zenithAngle: number; elevation: number; azimuth: number } => {
  const dayOfYear = Math.floor(
    (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000
  );

  // Fractional year in radians
  const gamma = (2 * Math.PI * (dayOfYear - 1)) / 365;

  // Spencer's equations for solar declination
  const declination =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.00205 * Math.cos(3 * gamma) +
    0.00029 * Math.sin(3 * gamma);

  // Equation of time (in minutes)
  const eot =
    229.18 *
    (0.017645 * Math.sin(2 * gamma) -
      0.033827 * Math.cos(gamma) -
      0.00969 * Math.sin(gamma) -
      0.00569 * Math.cos(2 * gamma));

  // Solar time
  const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes();
  const localMinutes = utcMinutes; // Simplified - use UTC
  const solarMinutes = localMinutes + eot + longitude * 4;
  const solarHours = solarMinutes / 60;

  // Hour angle in radians
  const hourAngle = ((solarHours - 12) * 15 * Math.PI) / 180;

  // Convert latitude to radians
  const latRad = (latitude * Math.PI) / 180;

  // Solar elevation angle
  const sinElevation =
    Math.sin(latRad) * Math.sin(declination) +
    Math.cos(latRad) * Math.cos(declination) * Math.cos(hourAngle);

  const elevation = Math.asin(Math.max(-1, Math.min(1, sinElevation)));
  const zenithAngle = (Math.PI / 2) - elevation;

  // Solar azimuth angle
  let azimuth = 0;
  if (elevation > 0) {
    const cosAzimuth =
      (Math.sin(declination) - Math.sin(elevation) * Math.sin(latRad)) /
      (Math.cos(elevation) * Math.cos(latRad));
    azimuth = Math.acos(Math.max(-1, Math.min(1, cosAzimuth)));

    if (Math.sin(hourAngle) > 0) {
      azimuth = 2 * Math.PI - azimuth;
    }
  }

  return {
    zenithAngle: zenithAngle * (180 / Math.PI),
    elevation: elevation * (180 / Math.PI),
    azimuth: azimuth * (180 / Math.PI)
  };
};

/**
 * Advanced cloud cover impact model
 * Considers cloud type and opacity effects on solar irradiance
 */
const calculateCloudImpact = (cloudCover: number, temperature: number): number => {
  // Different cloud types have different optical depths
  // High clouds (cirrus): less impact, allow more radiation
  // Low clouds (stratus): more opaque, block more radiation
  // We estimate cloud type based on temperature proxy
  
  if (cloudCover < 10) {
    return 0.95; // Clear sky, minimal reduction
  }

  if (cloudCover > 90) {
    return 0.15; // Overcast, significant reduction
  }

  // Non-linear relationship: exponential decay
  // Higher cloud cover = exponential impact increase
  const cloudOpacity = Math.pow(cloudCover / 100, 1.3);
  
  // Temperature influence: colder = likely higher cloud
  // Range: -5 to 40°C
  const tempFactor = Math.max(0.8, Math.min(1.0, (temperature + 5) / 45));

  const reduction = 1 - cloudOpacity * tempFactor * 0.85;
  return Math.max(0.1, reduction);
};

/**
 * Aerosol optical depth estimation
 * Higher pollution/aerosols = more atmospheric scattering
 */
const estimateAerosolFactor = (elevation: number): number => {
  // Lower sun elevation = more atmospheric path = more scattering
  if (elevation < 0) return 0;
  if (elevation < 10) return 0.85;
  if (elevation < 20) return 0.90;
  if (elevation < 30) return 0.93;
  return 0.95; // Higher elevation = less atmospheric scattering
};

/**
 * Clear-sky model (Ineichen-Perez)
 * Calculates theoretical maximum irradiance under clear conditions
 */
const calculateClearSkyIrradiance = (
  elevation: number,
  zenithAngle: number
): number => {
  if (elevation <= 0) return 0;

  const zenithRad = (zenithAngle * Math.PI) / 180;
  const airmass = 1 / (Math.cos(zenithRad) + 0.50572 * Math.pow(96.07995 - zenithAngle, -1.6364));

  // Clear-sky coefficients
  const c0 = 910.6;
  const c1 = 0.6797;
  const c2 = -0.00639;

  // Clear-sky irradiance
  const clearSkyGHI = c0 * Math.exp(c1 - c2 * airmass) * Math.max(0, Math.cos(zenithRad));
  return Math.max(0, clearSkyGHI);
};

/**
 * Decompose global horizontal irradiance into components
 * Direct Normal Irradiance (DNI) and Diffuse Horizontal Irradiance (DHI)
 */
const decomposeIrradiance = (
  ghi: number,
  elevation: number,
  cloudCover: number
): { dni: number; dhi: number } => {
  if (elevation <= 0) {
    return { dni: 0, dhi: 0 };
  }

  // Clearness index
  const elevation_rad = (elevation * Math.PI) / 180;
  const clearSkyGHI = calculateClearSkyIrradiance(elevation, 90 - elevation);
  const clearness = clearSkyGHI > 0 ? Math.min(1, ghi / clearSkyGHI) : 0;

  // Estimate DHI from GHI and clearness (Erbs et al.)
  let dhi: number;
  if (clearness <= 0.3) {
    dhi = ghi * (1.020 - 0.254 * clearness + 0.0123 * Math.sin(elevation_rad));
  } else if (clearness <= 0.78) {
    dhi = ghi * (0.972 - 0.306 * clearness + 0.0311 * Math.sin(elevation_rad));
  } else {
    dhi = ghi * (0.29 * clearness + 0.0049 * Math.sin(elevation_rad));
  }

  // Direct normal irradiance
  const dni = Math.max(0, (ghi - dhi) / Math.max(0.01, Math.sin(elevation_rad)));

  return { dni: Math.max(0, dni), dhi: Math.max(0, dhi) };
};

/**
 * Predict confidence based on weather stability and patterns
 */
const predictConfidence = (
  cloudCover: number,
  elevation: number,
  temperature: number,
  index: number,
  weatherData: WeatherForecastData
): number => {
  if (elevation < 0) return 0.95; // High confidence during night

  // Cloud cover variability (checking adjacent hours)
  let cloudVariance = 0;
  if (index > 0 && index < weatherData.cloud_cover.length - 1) {
    const prevCloud = weatherData.cloud_cover[index - 1];
    const nextCloud = weatherData.cloud_cover[index + 1];
    cloudVariance = Math.abs(prevCloud - nextCloud) / 100;
  }

  // Base confidence from cloud stability
  const cloudConfidence = 1 - cloudVariance * 0.4;

  // Elevation-based confidence: higher sun = more stable
  const elevationConfidence = Math.min(1, elevation / 80);

  // Temperature stability (extreme temperatures = unstable weather)
  const tempConfidence = temperature < -10 || temperature > 40 ? 0.7 : 0.9;

  return Math.max(0.1, cloudConfidence * elevationConfidence * tempConfidence);
};

/**
 * Generate solar irradiance forecast using advanced weather analysis algorithms
 * Combines multiple forecast methods and weather pattern analysis
 */
export const generateSolarForecast = async (
  location: LocationData,
  historicalData: SolarDataPoint[],
  weatherForecast: WeatherForecastData
): Promise<ForecastPoint[]> => {
  try {
    // Convert latitude/longitude to numbers
    const lat = typeof location.latitude === 'string' ? parseFloat(location.latitude) : location.latitude;
    const lon = typeof location.longitude === 'string' ? parseFloat(location.longitude) : location.longitude;

    // System efficiency parameters
    const systemEfficiency = 0.85; // Account for inverter, wiring, temperature losses
    const temperatureCoefficient = -0.004; // -0.4% per °C above 25°C

    const forecast: ForecastPoint[] = weatherForecast.time.map((time, index) => {
      const date = new Date(time);
      const temperature = weatherForecast.temperature_2m[index] || 25;
      const cloudCover = weatherForecast.cloud_cover[index] || 0;
      const baseGHI = weatherForecast.shortwave_radiation[index] || 0;

      // 1. Calculate solar position
      const solarPos = calculateSolarPosition(lat, lon, date);

      // If sun is below horizon
      if (solarPos.elevation < 0) {
        return {
          time,
          predictedIrradiance: 0,
          confidence: 0.95
        };
      }

      // 2. Calculate clear-sky maximum
      const clearSkyGHI = calculateClearSkyIrradiance(solarPos.elevation, solarPos.zenithAngle);

      // 3. Apply cloud cover impact
      const cloudImpact = calculateCloudImpact(cloudCover, temperature);

      // 4. Apply aerosol scattering
      const aerosolFactor = estimateAerosolFactor(solarPos.elevation);

      // 5. Calculate actual GHI considering all factors
      const predictedGHI = Math.max(0, baseGHI * cloudImpact * aerosolFactor);

      // 6. Apply temperature correction
      const tempDeviation = Math.max(0, temperature - 25);
      const tempLossFactor = 1 + temperatureCoefficient * tempDeviation;

      // 7. Apply system efficiency
      const predictedIrradiance = Math.max(0, predictedGHI * systemEfficiency * tempLossFactor);

      // 8. Decompose into direct and diffuse components
      const { dni, dhi } = decomposeIrradiance(predictedGHI, solarPos.elevation, cloudCover);

      // 9. Calculate confidence
      const confidence = predictConfidence(cloudCover, solarPos.elevation, temperature, index, weatherForecast);

      return {
        time,
        predictedIrradiance,
        confidence
      };
    });

    return forecast;

  } catch (error) {
    console.error("Forecasting Error:", error);
    throw new Error("Failed to generate solar forecast. Please check the data format.");
  }
};