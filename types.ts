export interface SolarDataPoint {
  timestamp: string;
  irradiance: number; // W/m^2
  temperature?: number; // Optional ambient temp
}

export interface ForecastPoint {
  time: string;
  predictedIrradiance: number;
  confidence: number;
}

export interface LocationData {
  latitude: string;
  longitude: string;
}

export interface StoredSession {
  id: string;
  date: string;
  location: LocationData;
  fileName: string;
  forecast: ForecastPoint[];
}

export interface WeatherForecastData {
  time: string[];
  temperature_2m: number[];
  cloud_cover: number[];
  shortwave_radiation: number[];
}

// Extended weather data with real-time analysis
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
    tempTrend: number; // Change per hour
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
  forecastQuality: number; // 0-1 confidence score
  dataFreshness: string;
}

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

export enum AppState {
  IDLE = 'IDLE',
  PARSING = 'PARSING',
  FETCHING_WEATHER = 'FETCHING_WEATHER',
  ANALYZING = 'ANALYZING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}

export interface Theme {
  id: string;
  label: string;
  classes: {
    bgMain: string;
    bgHeader: string;
    bgCard: string;
    bgInput: string;
    bgHover: string;
    border: string;
    textMain: string;
    textMuted: string;
    textDim: string;
    accentText: string;
    accentBg: string;
    buttonPrimary: string;
    buttonSecondary: string;
    buttonActive: string;
  };
  chartColors: {
    historical: string;
    predicted: string;
    weatherLine: string;
    weatherBar: string;
  };
}

// Chart data types
export interface SolarChartDataPoint {
  time: string;
  displayTime: string;
  displayDate: string;
  predicted: number;
  confidence: number;
  confidenceLow: number;
  confidenceHigh: number;
  temperature: number | null;
  cloudCover: number | null;
  radiation: number | null;
}

export interface WeatherChartDataPoint {
  time: string;
  displayTime: string;
  displayDate: string;
  cloudCover: number;
  temperature: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  pressure: number;
  precipitation: number;
  radiation: number;
}

export interface CombinedChartDataPoint {
  time: string;
  displayTime: string;
  solarOutput: number;
  cloudCover: number | null;
  temperature: number | null;
  efficiency: number | null;
  clearSkyPotential: number | null;
}

// Analysis metrics
export interface AnalysisMetrics {
  peakIrradiance: number;
  avgIrradiance: number;
  avgConfidence: number;
  totalEnergy: number;
  avgTemp: number;
  avgCloud: number;
  avgHumidity: number;
}

// Export data types
export interface ExportDataPoint {
  time: string;
  predicted_solar_irradiance_w_m2: string;
  forecast_confidence_0_1: string;
  forecast_confidence_pct: string;
  temperature_c?: number;
  cloud_cover_pct?: number;
  humidity_pct?: number;
  wind_speed_ms?: number;
  wind_direction_deg?: number;
  pressure_hpa?: number;
  precipitation_mm?: number;
  raw_radiation_wm2?: number;
  irradiance_quality?: string;
  cloud_impact_factor?: string;
  temperature_efficiency_loss?: string;
  adjusted_output?: string;
  forecast_reliability?: string;
  weather_stability?: string;
  hour_to_hour_change_pct?: string;
  confidence_change?: string;
}

export interface ExportMetadata {
  generated_at: string;
  location: LocationData;
  location_name: string;
  date_range: {
    start: string;
    end: string;
  };
  forecast_points_count: number;
  data_source: string;
}

export interface ExportSummary {
  average_irradiance_w_m2: number;
  max_irradiance_w_m2: number;
  min_irradiance_w_m2: number;
  estimated_energy_kwh: number;
  average_confidence_pct: number;
}

export interface FullExportData {
  metadata: ExportMetadata;
  summary_statistics: ExportSummary;
  weather_analysis: RealTimeWeatherAnalysis | null;
  forecast_data: ExportDataPoint[];
}