import { LocationData, WeatherForecastData } from '../types';

/**
 * Extended weather data with real-time analysis
 */
export interface RealTimeWeatherAnalysis {
  currentConditions: {
    temperature: number;
    humidity: number;
    cloudCover: number;
    windSpeed: number;
    windDirection: number;
    pressure: number;
    precipitation: number;
    uvIndex?: number;
    visibility?: number;
  };
  weatherTrends: {
    tempTrend: number;
    cloudCoverTrend: number;
    windSpeedTrend: number;
    pressureTrend: number;
    humidityTrend: number;
  };
  weatherAlerts: {
    cloudCoverAlert: boolean;
    temperatureAlert: boolean;
    windAlert: boolean;
    pressureAlert: boolean;
    precipitationAlert: boolean;
  };
  forecastQuality: number;
  dataFreshness: string;
}

/**
 * Enhanced weather forecast with quality metrics
 */
export interface EnhancedWeatherForecast extends WeatherForecastData {
  humidity?: number[];
  windSpeed?: number[];
  windDirection?: number[];
  pressure?: number[];
  precipitation?: number[];
  uvIndex?: number[];
  visibility?: number[];
  dewPoint?: number[];
  apparentTemperature?: number[];
  weatherAnalysis?: RealTimeWeatherAnalysis;
  lastUpdated?: string;
}

/**
 * Historical weather data structure
 */
export interface HistoricalWeatherData {
  time: string[];
  temperature_2m: number[];
  cloud_cover: number[];
  shortwave_radiation: number[];
  humidity: number[];
  windSpeed: number[];
  precipitation: number[];
  pressure: number[];
}

/**
 * Geocode location by name using Open-Meteo API
 */
export const geocodeLocation = async (query: string): Promise<{ name: string, country: string, latitude: number, longitude: number, timezone?: string } | null> => {
  try {
    const response = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`,
      { 
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000)
      }
    );
    
    if (!response.ok) {
      throw new Error(`Geocoding API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.results || data.results.length === 0) {
      return null;
    }
    
    // Return the best match (first result)
    const result = data.results[0];
    return {
      name: result.name,
      country: result.country || result.country_code || 'Unknown',
      latitude: result.latitude,
      longitude: result.longitude,
      timezone: result.timezone
    };
  } catch (error) {
    console.error("Geocoding failed:", error);
    return null;
  }
};

/**
 * Analyze weather trends from forecast data
 */
const analyzeWeatherTrends = (forecastData: EnhancedWeatherForecast): RealTimeWeatherAnalysis['weatherTrends'] => {
  const n = Math.min(24, forecastData.temperature_2m.length);
  
  if (n < 2) {
    return { tempTrend: 0, cloudCoverTrend: 0, windSpeedTrend: 0, pressureTrend: 0, humidityTrend: 0 };
  }

  // Calculate linear regression slope for each metric
  const calculateTrend = (data: number[]): number => {
    const slice = data.slice(0, n);
    if (slice.length < 2) return 0;
    
    const xMean = (slice.length - 1) / 2;
    const yMean = slice.reduce((a, b) => a + b, 0) / slice.length;
    
    let numerator = 0;
    let denominator = 0;
    
    slice.forEach((y, x) => {
      numerator += (x - xMean) * (y - yMean);
      denominator += Math.pow(x - xMean, 2);
    });
    
    return denominator !== 0 ? numerator / denominator : 0;
  };

  return {
    tempTrend: Number(calculateTrend(forecastData.temperature_2m).toFixed(3)),
    cloudCoverTrend: Number(calculateTrend(forecastData.cloud_cover).toFixed(2)),
    windSpeedTrend: Number(calculateTrend(forecastData.windSpeed || []).toFixed(3)),
    pressureTrend: Number(calculateTrend(forecastData.pressure || []).toFixed(2)),
    humidityTrend: Number(calculateTrend(forecastData.humidity || []).toFixed(2))
  };
};

/**
 * Detect severe weather alerts
 */
const generateWeatherAlerts = (
  forecastData: EnhancedWeatherForecast, 
  trends: RealTimeWeatherAnalysis['weatherTrends']
): RealTimeWeatherAnalysis['weatherAlerts'] => {
  const currentCloud = forecastData.cloud_cover[0] || 0;
  const currentTemp = forecastData.temperature_2m[0] || 20;
  const currentWind = forecastData.windSpeed?.[0] || 0;
  const currentPrecip = forecastData.precipitation?.[0] || 0;

  // Check for rapid changes in next 6 hours
  const next6hCloud = forecastData.cloud_cover.slice(0, 6);
  const cloudVariability = next6hCloud.length > 1 
    ? Math.max(...next6hCloud) - Math.min(...next6hCloud) 
    : 0;

  return {
    cloudCoverAlert: currentCloud > 80 || cloudVariability > 50,
    temperatureAlert: currentTemp < -10 || currentTemp > 40,
    windAlert: currentWind > 20,
    pressureAlert: Math.abs(trends.pressureTrend) > 1.5,
    precipitationAlert: currentPrecip > 5
  };
};

/**
 * Calculate forecast quality score
 */
const calculateForecastQuality = (forecastData: EnhancedWeatherForecast): number => {
  if (forecastData.temperature_2m.length === 0) return 0.5;

  const n = Math.min(24, forecastData.temperature_2m.length);
  
  // Temperature stability
  const temps = forecastData.temperature_2m.slice(0, n);
  const tempMean = temps.reduce((a, b) => a + b, 0) / temps.length;
  const tempVariance = temps.reduce((sum, t) => sum + Math.pow(t - tempMean, 2), 0) / temps.length;
  const tempStability = Math.max(0.3, 1 - Math.sqrt(tempVariance) / 20);

  // Cloud cover consistency
  const clouds = forecastData.cloud_cover.slice(0, n);
  const cloudMean = clouds.reduce((a, b) => a + b, 0) / clouds.length;
  const cloudVariance = clouds.reduce((sum, c) => sum + Math.pow(c - cloudMean, 2), 0) / clouds.length;
  const cloudStability = Math.max(0.3, 1 - Math.sqrt(cloudVariance) / 40);

  // Precipitation impact
  const precip = forecastData.precipitation?.slice(0, n) || [];
  const hasPrecip = precip.some(p => p > 0);
  const precipFactor = hasPrecip ? 0.85 : 1.0;

  const quality = (tempStability * 0.4 + cloudStability * 0.4 + precipFactor * 0.2);
  return Math.min(0.99, Math.max(0.1, quality));
};

/**
 * Fetch real-time weather forecast from Open-Meteo
 */
export const fetchWeatherForecast = async (location: LocationData): Promise<EnhancedWeatherForecast> => {
  try {
    const params = new URLSearchParams({
      latitude: location.latitude,
      longitude: location.longitude,
      hourly: [
        'temperature_2m',
        'relative_humidity_2m',
        'dew_point_2m',
        'apparent_temperature',
        'cloud_cover',
        'cloud_cover_low',
        'cloud_cover_mid',
        'cloud_cover_high',
        'shortwave_radiation',
        'direct_radiation',
        'diffuse_radiation',
        'wind_speed_10m',
        'wind_direction_10m',
        'wind_gusts_10m',
        'surface_pressure',
        'precipitation',
        'precipitation_probability',
        'visibility',
        'uv_index'
      ].join(','),
      forecast_days: '7',
      timezone: 'auto',
      wind_speed_unit: 'ms',
    });

    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?${params.toString()}`,
      { 
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(15000)
      }
    );
    
    if (!response.ok) {
      throw new Error(`Weather API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.hourly || !data.hourly.time) {
      throw new Error("Invalid response format from Weather API");
    }

    const hourlyData = data.hourly;
    const maxHours = Math.min(168, hourlyData.time.length); // Up to 7 days

    const enhancedForecast: EnhancedWeatherForecast = {
      time: hourlyData.time.slice(0, maxHours),
      temperature_2m: hourlyData.temperature_2m?.slice(0, maxHours) || [],
      cloud_cover: hourlyData.cloud_cover?.slice(0, maxHours) || [],
      shortwave_radiation: hourlyData.shortwave_radiation?.slice(0, maxHours) || [],
      humidity: hourlyData.relative_humidity_2m?.slice(0, maxHours) || [],
      windSpeed: hourlyData.wind_speed_10m?.slice(0, maxHours) || [],
      windDirection: hourlyData.wind_direction_10m?.slice(0, maxHours) || [],
      pressure: hourlyData.surface_pressure?.slice(0, maxHours) || [],
      precipitation: hourlyData.precipitation?.slice(0, maxHours) || [],
      uvIndex: hourlyData.uv_index?.slice(0, maxHours) || [],
      visibility: hourlyData.visibility?.slice(0, maxHours) || [],
      dewPoint: hourlyData.dew_point_2m?.slice(0, maxHours) || [],
      apparentTemperature: hourlyData.apparent_temperature?.slice(0, maxHours) || [],
      lastUpdated: new Date().toISOString()
    };

    // Perform weather analysis
    const weatherTrends = analyzeWeatherTrends(enhancedForecast);
    const weatherAlerts = generateWeatherAlerts(enhancedForecast, weatherTrends);
    const forecastQuality = calculateForecastQuality(enhancedForecast);

    const currentConditions: RealTimeWeatherAnalysis['currentConditions'] = {
      temperature: enhancedForecast.temperature_2m[0] || 0,
      humidity: enhancedForecast.humidity?.[0] || 50,
      cloudCover: enhancedForecast.cloud_cover[0] || 0,
      windSpeed: enhancedForecast.windSpeed?.[0] || 0,
      windDirection: enhancedForecast.windDirection?.[0] || 0,
      pressure: enhancedForecast.pressure?.[0] || 1013,
      precipitation: enhancedForecast.precipitation?.[0] || 0,
      uvIndex: enhancedForecast.uvIndex?.[0],
      visibility: enhancedForecast.visibility?.[0]
    };

    enhancedForecast.weatherAnalysis = {
      currentConditions,
      weatherTrends,
      weatherAlerts,
      forecastQuality,
      dataFreshness: 'Real-time'
    };

    console.log('Weather Data Loaded:', {
      location: `${location.latitude}, ${location.longitude}`,
      dataPoints: enhancedForecast.time.length,
      currentTemp: currentConditions.temperature,
      currentCloud: currentConditions.cloudCover,
      forecastQuality: `${(forecastQuality * 100).toFixed(1)}%`
    });

    return enhancedForecast;

  } catch (error) {
    console.error("Failed to fetch weather data:", error);
    throw error;
  }
};

/**
 * Fetch historical weather data from Open-Meteo Archive API
 */
export const fetchHistoricalWeather = async (
  location: LocationData,
  startDate: string,
  endDate: string
): Promise<HistoricalWeatherData> => {
  try {
    const params = new URLSearchParams({
      latitude: location.latitude,
      longitude: location.longitude,
      start_date: startDate,
      end_date: endDate,
      hourly: [
        'temperature_2m',
        'relative_humidity_2m',
        'cloud_cover',
        'shortwave_radiation',
        'wind_speed_10m',
        'precipitation',
        'surface_pressure'
      ].join(','),
      timezone: 'auto',
      wind_speed_unit: 'ms'
    });

    const response = await fetch(
      `https://archive-api.open-meteo.com/v1/archive?${params.toString()}`,
      { 
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(20000)
      }
    );
    
    if (!response.ok) {
      throw new Error(`Historical API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.hourly || !data.hourly.time) {
      throw new Error("Invalid response from Historical Weather API");
    }

    const hourlyData = data.hourly;

    return {
      time: hourlyData.time || [],
      temperature_2m: hourlyData.temperature_2m || [],
      cloud_cover: hourlyData.cloud_cover || [],
      shortwave_radiation: hourlyData.shortwave_radiation || [],
      humidity: hourlyData.relative_humidity_2m || [],
      windSpeed: hourlyData.wind_speed_10m || [],
      precipitation: hourlyData.precipitation || [],
      pressure: hourlyData.surface_pressure || []
    };

  } catch (error) {
    console.error("Failed to fetch historical weather:", error);
    throw error;
  }
};

/**
 * Fetch past 7 days of weather data for analysis
 */
export const fetchRecentHistoricalWeather = async (location: LocationData): Promise<HistoricalWeatherData> => {
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 1); // Yesterday
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 8); // 7 days ago

  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  return fetchHistoricalWeather(location, formatDate(startDate), formatDate(endDate));
};

/**
 * Get weather analysis summary
 */
export const getWeatherAnalysis = (weatherData: EnhancedWeatherForecast): RealTimeWeatherAnalysis | null => {
  return weatherData.weatherAnalysis || null;
};

/**
 * Generate human-readable weather summary
 */
export const generateWeatherSummary = (analysis: RealTimeWeatherAnalysis): string => {
  const { currentConditions, weatherTrends, weatherAlerts, forecastQuality } = analysis;
  
  let summary = `🌡️ ${currentConditions.temperature.toFixed(1)}°C | `;
  summary += `☁️ ${currentConditions.cloudCover.toFixed(0)}% | `;
  summary += `💧 ${currentConditions.humidity.toFixed(0)}% | `;
  summary += `💨 ${currentConditions.windSpeed.toFixed(1)} m/s\n`;

  summary += `📊 Forecast Quality: ${(forecastQuality * 100).toFixed(0)}%\n`;

  // Trends
  const tempTrendIcon = weatherTrends.tempTrend > 0.1 ? '📈' : weatherTrends.tempTrend < -0.1 ? '📉' : '➡️';
  const cloudTrendIcon = weatherTrends.cloudCoverTrend > 1 ? '☁️↑' : weatherTrends.cloudCoverTrend < -1 ? '☀️↑' : '➡️';
  
  summary += `${tempTrendIcon} Temp trend: ${weatherTrends.tempTrend > 0 ? '+' : ''}${weatherTrends.tempTrend.toFixed(2)}°C/h\n`;
  summary += `${cloudTrendIcon} Cloud trend: ${weatherTrends.cloudCoverTrend > 0 ? '+' : ''}${weatherTrends.cloudCoverTrend.toFixed(1)}%/h\n`;

  // Alerts
  const activeAlerts = Object.entries(weatherAlerts)
    .filter(([_, active]) => active)
    .map(([key]) => {
      switch(key) {
        case 'cloudCoverAlert': return '⚠️ Heavy clouds';
        case 'temperatureAlert': return '🌡️ Extreme temp';
        case 'windAlert': return '💨 High wind';
        case 'pressureAlert': return '📊 Pressure change';
        case 'precipitationAlert': return '🌧️ Precipitation';
        default: return '';
      }
    })
    .filter(Boolean);

  if (activeAlerts.length > 0) {
    summary += `\nAlerts: ${activeAlerts.join(' | ')}`;
  }

  return summary;
};

/**
 * Calculate solar potential based on weather conditions
 */
export const calculateSolarPotential = (weather: EnhancedWeatherForecast): number => {
  if (!weather.shortwave_radiation?.length) return 0;

  // Get daytime hours only (radiation > 0)
  const daytimeRadiation = weather.shortwave_radiation.filter(r => r > 0);
  if (daytimeRadiation.length === 0) return 0;

  const avgRadiation = daytimeRadiation.reduce((a, b) => a + b, 0) / daytimeRadiation.length;
  const avgCloud = weather.cloud_cover.reduce((a, b) => a + b, 0) / weather.cloud_cover.length;

  // Solar potential score (0-100)
  const cloudFactor = (100 - avgCloud) / 100;
  const radiationFactor = Math.min(1, avgRadiation / 800); // 800 W/m² as reference max

  return Math.round(cloudFactor * radiationFactor * 100);
};