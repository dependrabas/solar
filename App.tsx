import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Sun, History, CloudLightning, Database, Clock, CloudRain, FileJson, FileSpreadsheet, ArrowRight, RefreshCw, Calendar, TrendingUp, Zap, AlertTriangle, CheckCircle, Download, Loader2 } from 'lucide-react';
import InputSection from './components/InputSection';
import SolarChart from './components/SolarChart';
import { generateSolarForecast } from './services/geminiService';
import { fetchWeatherForecast, fetchRecentHistoricalWeather, fetchHistoricalWeather, EnhancedWeatherForecast, HistoricalWeatherData, calculateSolarPotential } from './services/weatherService';
import { getHistory, saveSession } from './services/storageService';
import { AppState, ForecastPoint, LocationData, SolarDataPoint, StoredSession, Theme } from './types';
import { format, parseISO, isValid, subDays } from 'date-fns';

const themes: Theme[] = [
  {
    id: 'cosmic',
    label: 'Cosmic',
    classes: {
      bgMain: 'bg-slate-900',
      bgHeader: 'bg-slate-900/80',
      bgCard: 'bg-slate-800/60',
      bgInput: 'bg-slate-900',
      bgHover: 'hover:bg-slate-700/60',
      border: 'border-slate-700/50',
      textMain: 'text-slate-100',
      textMuted: 'text-slate-400',
      textDim: 'text-slate-500',
      accentText: 'text-blue-400',
      accentBg: 'bg-blue-600',
      buttonPrimary: 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white',
      buttonSecondary: 'bg-slate-700/80 text-slate-300 hover:bg-slate-600 hover:text-white',
      buttonActive: 'bg-blue-600 text-white shadow-lg shadow-blue-500/25 ring-1 ring-blue-500',
    },
    chartColors: {
      historical: '#3b82f6',
      predicted: '#facc15',
      weatherLine: '#f87171',
      weatherBar: '#3b82f6'
    }
  },
  {
    id: 'nature',
    label: 'Nature',
    classes: {
      bgMain: 'bg-stone-950',
      bgHeader: 'bg-stone-950/80',
      bgCard: 'bg-stone-900/60',
      bgInput: 'bg-stone-950',
      bgHover: 'hover:bg-stone-800/60',
      border: 'border-stone-700/50',
      textMain: 'text-stone-100',
      textMuted: 'text-stone-400',
      textDim: 'text-stone-500',
      accentText: 'text-emerald-400',
      accentBg: 'bg-emerald-600',
      buttonPrimary: 'bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white',
      buttonSecondary: 'bg-stone-800/80 text-stone-300 hover:bg-stone-700 hover:text-white',
      buttonActive: 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/25 ring-1 ring-emerald-500',
    },
    chartColors: {
      historical: '#10b981',
      predicted: '#facc15',
      weatherLine: '#fb923c',
      weatherBar: '#10b981'
    }
  },
  {
    id: 'industrial',
    label: 'Industrial',
    classes: {
      bgMain: 'bg-neutral-900',
      bgHeader: 'bg-neutral-900/80',
      bgCard: 'bg-neutral-800/60',
      bgInput: 'bg-neutral-900',
      bgHover: 'hover:bg-neutral-700/60',
      border: 'border-neutral-700/50',
      textMain: 'text-neutral-100',
      textMuted: 'text-neutral-400',
      textDim: 'text-neutral-500',
      accentText: 'text-orange-400',
      accentBg: 'bg-orange-600',
      buttonPrimary: 'bg-gradient-to-r from-orange-600 to-red-500 hover:from-orange-500 hover:to-red-400 text-white',
      buttonSecondary: 'bg-neutral-700/80 text-neutral-300 hover:bg-neutral-600 hover:text-white',
      buttonActive: 'bg-orange-600 text-white shadow-lg shadow-orange-500/25 ring-1 ring-orange-500',
    },
    chartColors: {
      historical: '#f97316',
      predicted: '#fbbf24',
      weatherLine: '#a3a3a3',
      weatherBar: '#f97316'
    }
  }
];

function App() {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [currentHistory, setCurrentHistory] = useState<SolarDataPoint[]>([]);
  const [currentForecast, setCurrentForecast] = useState<ForecastPoint[]>([]);
  const [currentWeatherData, setCurrentWeatherData] = useState<EnhancedWeatherForecast | null>(null);
  const [historicalWeatherData, setHistoricalWeatherData] = useState<HistoricalWeatherData | null>(null);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [currentLocationName, setCurrentLocationName] = useState<string>('');
  const [pastSessions, setPastSessions] = useState<StoredSession[]>([]);
  const [viewDuration, setViewDuration] = useState<number>(24);
  const [currentTheme, setCurrentTheme] = useState<Theme>(themes[0]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  // Date Range State for Downloads - now supports historical dates
  const [downloadStartDate, setDownloadStartDate] = useState<string>('');
  const [downloadEndDate, setDownloadEndDate] = useState<string>('');
  const [isDownloadingHistorical, setIsDownloadingHistorical] = useState(false);
  const [downloadError, setDownloadError] = useState<string>('');

  const durationOptions = [6, 12, 24, 48, 72, 168, 0];

  // Calculate date limits - allow up to 2 years of historical data
  const today = new Date();
  const minHistoricalDate = format(subDays(today, 730), 'yyyy-MM-dd'); // 2 years back
  const maxForecastDate = format(subDays(today, -7), 'yyyy-MM-dd'); // 7 days forward

  useEffect(() => {
    setPastSessions(getHistory());
  }, []);

  // Set default dates when location is set
  useEffect(() => {
    if (currentLocation && !downloadStartDate) {
      const todayStr = format(today, 'yyyy-MM-dd');
      setDownloadStartDate(todayStr);
      setDownloadEndDate(todayStr);
    }
  }, [currentLocation]);

  // Auto-refresh effect
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (appState === AppState.SUCCESS && currentLocation) {
      const REFRESH_RATE = 30 * 60 * 1000; // 30 minutes

      intervalId = setInterval(async () => {
        await handleRefresh();
      }, REFRESH_RATE);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [appState, currentLocation]);

  const handleRefresh = useCallback(async () => {
    if (!currentLocation || isRefreshing) return;

    setIsRefreshing(true);
    try {
      const newWeatherData = await fetchWeatherForecast(currentLocation);
      setCurrentWeatherData(newWeatherData);

      const newForecast = await generateSolarForecast(currentLocation, [], newWeatherData);
      setCurrentForecast(newForecast);
      setLastRefresh(new Date());
      setErrorMessage('');
    } catch (error) {
      console.error("Refresh failed:", error);
      setErrorMessage('Failed to refresh data. Will retry automatically.');
    } finally {
      setIsRefreshing(false);
    }
  }, [currentLocation, isRefreshing]);

  const handleDataReady = async (location: LocationData, locationName: string) => {
    try {
      setCurrentLocation(location);
      setCurrentLocationName(locationName);
      setErrorMessage('');
      setAppState(AppState.FETCHING_WEATHER);

      // Set default download dates
      const todayStr = format(today, 'yyyy-MM-dd');
      setDownloadStartDate(todayStr);
      setDownloadEndDate(todayStr);

      // Fetch current weather forecast
      const weatherData = await fetchWeatherForecast(location);
      setCurrentWeatherData(weatherData);

      // Fetch historical data in parallel (non-blocking)
      fetchRecentHistoricalWeather(location)
        .then(historical => {
          setHistoricalWeatherData(historical);
          console.log('Historical data loaded:', historical.time.length, 'hours');
        })
        .catch(err => {
          console.warn('Historical data unavailable:', err);
        });

      setAppState(AppState.ANALYZING);
      
      const forecast = await generateSolarForecast(location, [], weatherData);
      
      setCurrentHistory([]); 
      setCurrentForecast(forecast);
      setLastRefresh(new Date());
      
      const newSession = saveSession({
        location,
        fileName: locationName,
        forecast,
      });
      
      setPastSessions(prev => [newSession, ...prev.slice(0, 9)]); // Keep last 10
      setAppState(AppState.SUCCESS);

    } catch (error) {
      console.error("Forecast generation failed:", error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to generate forecast');
      setAppState(AppState.ERROR);
    }
  };

  const loadSession = (session: StoredSession) => {
    setCurrentLocation(session.location);
    setCurrentLocationName(session.fileName);
    setCurrentForecast(session.forecast);
    setCurrentHistory([]); 
    setCurrentWeatherData(null);
    setHistoricalWeatherData(null);
    setAppState(AppState.SUCCESS);
    
    // Refresh weather data for loaded session
    fetchWeatherForecast(session.location)
      .then(weather => {
        setCurrentWeatherData(weather);
        setLastRefresh(new Date());
      })
      .catch(console.error);
  };

  // Download weather data - supports both forecast and historical
  const downloadData = async (formatType: 'csv' | 'json') => {
    if (!currentLocation) {
      alert('Please select a location first.');
      return;
    }

    if (!downloadStartDate || !downloadEndDate) {
      alert('Please select a date range.');
      return;
    }

    setIsDownloadingHistorical(true);
    setDownloadError('');

    try {
      const todayStr = format(today, 'yyyy-MM-dd');
      const isHistorical = downloadStartDate < todayStr || downloadEndDate < todayStr;
      const isFuture = downloadStartDate > todayStr || downloadEndDate > todayStr;

      let dataToExport: any[] = [];
      let dataSource = '';

      // Fetch historical data if needed
      if (isHistorical) {
        const historicalEndDate = downloadEndDate < todayStr ? downloadEndDate : format(subDays(today, 1), 'yyyy-MM-dd');
        const historicalStartDate = downloadStartDate;

        console.log(`Fetching historical data from ${historicalStartDate} to ${historicalEndDate}`);
        
        const historicalData = await fetchHistoricalWeather(
          currentLocation,
          historicalStartDate,
          historicalEndDate
        );

        // Process historical data
        historicalData.time.forEach((time, idx) => {
          const dateStr = time.split('T')[0];
          if (dateStr >= downloadStartDate && dateStr <= downloadEndDate) {
            dataToExport.push({
              time,
              data_type: 'historical',
              temperature_c: historicalData.temperature_2m[idx],
              cloud_cover_pct: historicalData.cloud_cover[idx],
              humidity_pct: historicalData.humidity[idx],
              wind_speed_ms: historicalData.windSpeed[idx],
              pressure_hpa: historicalData.pressure[idx],
              precipitation_mm: historicalData.precipitation[idx],
              solar_radiation_wm2: historicalData.shortwave_radiation[idx],
            });
          }
        });

        dataSource = 'Open-Meteo Historical Archive API';
      }

      // Add forecast data if date range includes future
      if (isFuture || downloadStartDate >= todayStr) {
        // Use existing forecast data or fetch new
        let forecastData = currentWeatherData;
        if (!forecastData) {
          forecastData = await fetchWeatherForecast(currentLocation);
        }

        forecastData.time.forEach((time, idx) => {
          const dateStr = time.split('T')[0];
          if (dateStr >= downloadStartDate && dateStr <= downloadEndDate) {
            // Check if we already have this time from historical
            const existingIdx = dataToExport.findIndex(d => d.time === time);
            if (existingIdx === -1) {
              dataToExport.push({
                time,
                data_type: 'forecast',
                temperature_c: forecastData!.temperature_2m[idx],
                cloud_cover_pct: forecastData!.cloud_cover[idx],
                humidity_pct: forecastData!.humidity?.[idx] ?? null,
                wind_speed_ms: forecastData!.windSpeed?.[idx] ?? null,
                pressure_hpa: forecastData!.pressure?.[idx] ?? null,
                precipitation_mm: forecastData!.precipitation?.[idx] ?? null,
                solar_radiation_wm2: forecastData!.shortwave_radiation[idx],
              });
            }
          }
        });

        dataSource = dataSource ? `${dataSource} + Open-Meteo Forecast API` : 'Open-Meteo Forecast API';
      }

      if (dataToExport.length === 0) {
        setDownloadError('No data available for the selected date range.');
        return;
      }

      // Sort by time
      dataToExport.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

      // Calculate statistics
      const temps = dataToExport.map(d => d.temperature_c).filter(t => t !== null);
      const clouds = dataToExport.map(d => d.cloud_cover_pct).filter(c => c !== null);
      const radiation = dataToExport.map(d => d.solar_radiation_wm2).filter(r => r !== null);

      const avgTemp = temps.length ? (temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1) : 'N/A';
      const avgCloud = clouds.length ? (clouds.reduce((a, b) => a + b, 0) / clouds.length).toFixed(1) : 'N/A';
      const avgRadiation = radiation.length ? (radiation.reduce((a, b) => a + b, 0) / radiation.length).toFixed(1) : 'N/A';
      const maxRadiation = radiation.length ? Math.max(...radiation).toFixed(1) : 'N/A';
      const totalEnergy = radiation.length ? (radiation.reduce((a, b) => a + b, 0) / 1000).toFixed(2) : 'N/A';

      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const dateSuffix = downloadStartDate === downloadEndDate
        ? downloadStartDate
        : `${downloadStartDate}_to_${downloadEndDate}`;
      const filename = `weather_data_${dateSuffix}_${timestamp}`;

      if (formatType === 'json') {
        const exportData = {
          metadata: {
            generated_at: new Date().toISOString(),
            location: currentLocation,
            location_name: currentLocationName,
            date_range: { start: downloadStartDate, end: downloadEndDate },
            data_points_count: dataToExport.length,
            data_source: dataSource,
          },
          summary_statistics: {
            average_temperature_c: parseFloat(avgTemp) || null,
            average_cloud_cover_pct: parseFloat(avgCloud) || null,
            average_radiation_wm2: parseFloat(avgRadiation) || null,
            max_radiation_wm2: parseFloat(maxRadiation) || null,
            estimated_energy_kwh: parseFloat(totalEnergy) || null,
          },
          weather_data: dataToExport,
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const headers = [
          'Time',
          'Data Type',
          'Temperature (°C)',
          'Cloud Cover (%)',
          'Humidity (%)',
          'Wind Speed (m/s)',
          'Pressure (hPa)',
          'Precipitation (mm)',
          'Solar Radiation (W/m²)',
        ];

        const rows = dataToExport.map(row => [
          row.time,
          row.data_type,
          row.temperature_c ?? '',
          row.cloud_cover_pct ?? '',
          row.humidity_pct ?? '',
          row.wind_speed_ms ?? '',
          row.pressure_hpa ?? '',
          row.precipitation_mm ?? '',
          row.solar_radiation_wm2 ?? '',
        ].map(val => typeof val === 'string' && val.includes(',') ? `"${val}"` : val));

        const summaryRows = [
          [],
          ['SUMMARY STATISTICS'],
          ['Average Temperature (°C)', avgTemp],
          ['Average Cloud Cover (%)', avgCloud],
          ['Average Radiation (W/m²)', avgRadiation],
          ['Maximum Radiation (W/m²)', maxRadiation],
          ['Estimated Energy (kWh)', totalEnergy],
          ['Data Points', dataToExport.length],
          ['Location', currentLocationName],
          ['Date Range', `${downloadStartDate} to ${downloadEndDate}`],
          ['Data Source', dataSource],
          ['Generated At', new Date().toISOString()],
        ];

        const csvContent = [
          headers.join(','),
          ...rows.map(r => r.join(',')),
          ...summaryRows.map(row => row.join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }

      console.log(`Downloaded ${dataToExport.length} data points`);
    } catch (error) {
      console.error('Download failed:', error);
      setDownloadError(error instanceof Error ? error.message : 'Failed to download data. Please try again.');
    } finally {
      setIsDownloadingHistorical(false);
    }
  };

  const isAllTime = viewDuration === 0;
  const visibleForecast = isAllTime ? currentForecast : currentForecast.slice(0, viewDuration);
  const visibleHistory: SolarDataPoint[] = [];

  // Calculate metrics
  const solarPotential = currentWeatherData ? calculateSolarPotential(currentWeatherData) : 0;
  const forecastQuality = currentWeatherData?.weatherAnalysis?.forecastQuality || 0;

  const formatLastRefresh = () => {
    if (!lastRefresh) return '';
    try {
      return format(lastRefresh, 'HH:mm:ss');
    } catch {
      return '';
    }
  };

  return (
    <div className={`min-h-screen ${currentTheme.classes.bgMain} ${currentTheme.classes.textMain} pb-20 transition-colors duration-300`}>
      {/* Header */}
      <header className={`border-b ${currentTheme.classes.border} ${currentTheme.classes.bgHeader} backdrop-blur-xl sticky top-0 z-50 transition-colors duration-300`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-yellow-400 to-orange-500 p-2.5 rounded-xl shadow-lg shadow-orange-500/20">
              <Sun className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                SolarCast AI
              </h1>
              <p className={`text-xs ${currentTheme.classes.textDim} hidden sm:block`}>Real-time Solar Forecasting</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Last Refresh Indicator */}
            {lastRefresh && (
              <div className={`hidden sm:flex items-center gap-2 text-xs ${currentTheme.classes.textDim} bg-black/20 px-3 py-1.5 rounded-full`}>
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span>Updated {formatLastRefresh()}</span>
              </div>
            )}

            {/* Refresh Button */}
            {appState === AppState.SUCCESS && (
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className={`p-2 rounded-lg ${currentTheme.classes.buttonSecondary} transition-all ${isRefreshing ? 'opacity-50' : ''}`}
                title="Refresh data"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            )}

            {/* Theme Selector */}
            <div className="flex items-center gap-2 bg-black/20 p-1.5 rounded-full border border-white/5">
              {themes.map(theme => (
                <button
                  key={theme.id}
                  onClick={() => setCurrentTheme(theme)}
                  className={`w-6 h-6 rounded-full transition-all ${
                    currentTheme.id === theme.id ? 'ring-2 ring-white scale-110 shadow-lg' : 'opacity-50 hover:opacity-100'
                  }`}
                  style={{ 
                    backgroundColor: theme.id === 'cosmic' ? '#3b82f6' : theme.id === 'nature' ? '#10b981' : '#f97316'
                  }}
                  title={theme.label}
                />
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column: Input & History */}
          <div className="space-y-6">
            <InputSection 
              onDataReady={handleDataReady} 
              isProcessing={appState === AppState.ANALYZING || appState === AppState.FETCHING_WEATHER}
              theme={currentTheme}
            />

            {/* Quick Stats */}
            {appState === AppState.SUCCESS && currentWeatherData && (
              <div className={`${currentTheme.classes.bgCard} backdrop-blur-md rounded-xl p-4 border ${currentTheme.classes.border} shadow-xl transition-colors duration-300`}>
                <h3 className={`text-sm font-semibold ${currentTheme.classes.textMain} mb-3 flex items-center gap-2`}>
                  <Zap className={`w-4 h-4 ${currentTheme.classes.accentText}`} />
                  Quick Analysis
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-black/20 rounded-lg p-3 border border-white/5">
                    <p className={`text-xs ${currentTheme.classes.textDim} uppercase tracking-wider`}>Solar Potential</p>
                    <p className={`text-2xl font-bold ${solarPotential > 70 ? 'text-green-400' : solarPotential > 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {solarPotential}%
                    </p>
                  </div>
                  <div className="bg-black/20 rounded-lg p-3 border border-white/5">
                    <p className={`text-xs ${currentTheme.classes.textDim} uppercase tracking-wider`}>Forecast Quality</p>
                    <p className={`text-2xl font-bold ${forecastQuality > 0.7 ? 'text-green-400' : forecastQuality > 0.5 ? 'text-yellow-400' : 'text-orange-400'}`}>
                      {(forecastQuality * 100).toFixed(0)}%
                    </p>
                  </div>
                </div>
                
                {/* Weather Alerts */}
                {currentWeatherData.weatherAnalysis?.weatherAlerts && 
                  Object.values(currentWeatherData.weatherAnalysis.weatherAlerts).some(a => a) && (
                  <div className="mt-3 p-2 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                    <div className="flex items-center gap-2 text-yellow-400 text-xs">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="font-medium">Weather Alerts Active</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* History Panel */}
            <div className={`${currentTheme.classes.bgCard} backdrop-blur-md rounded-xl p-4 border ${currentTheme.classes.border} shadow-xl max-h-[350px] overflow-y-auto transition-colors duration-300`}>
              <h2 className={`text-sm font-semibold ${currentTheme.classes.textMain} mb-3 flex items-center gap-2`}>
                <History className={`w-4 h-4 ${currentTheme.classes.accentText}`} />
                Recent Forecasts
              </h2>
              {pastSessions.length === 0 ? (
                <div className={`text-center py-6 ${currentTheme.classes.textDim} text-sm`}>
                  <Database className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>No saved forecasts yet</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {pastSessions.map(session => (
                    <li 
                      key={session.id} 
                      onClick={() => loadSession(session)}
                      className={`p-3 bg-black/20 ${currentTheme.classes.bgHover} rounded-lg border ${currentTheme.classes.border} cursor-pointer transition-all group hover:border-white/20`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${currentTheme.classes.textMain} truncate group-hover:${currentTheme.classes.accentText} transition-colors`}>
                            {session.fileName || 'Unknown Location'}
                          </p>
                          <p className={`text-xs ${currentTheme.classes.textMuted} mt-0.5`}>
                            {(() => {
                              try {
                                const date = parseISO(session.date);
                                return isValid(date) ? format(date, 'MMM dd, yyyy HH:mm') : session.date;
                              } catch {
                                return session.date;
                              }
                            })()}
                          </p>
                        </div>
                        <div className={`px-2 py-1 rounded text-xs ${currentTheme.classes.bgInput} ${currentTheme.classes.textDim}`}>
                          {session.forecast.length}h
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Right Column: Visualization */}
          <div className="lg:col-span-2 space-y-4">
            
            {appState === AppState.IDLE && (
              <div className={`h-[450px] rounded-xl border-2 border-dashed ${currentTheme.classes.border} flex flex-col items-center justify-center ${currentTheme.classes.textDim} bg-gradient-to-br from-white/5 to-transparent`}>
                <div className="bg-gradient-to-br from-yellow-400/20 to-orange-500/20 p-6 rounded-full mb-4">
                  <Sun className="w-12 h-12 text-yellow-400/50" />
                </div>
                <p className="text-lg font-medium">Ready to Forecast</p>
                <p className="text-sm opacity-60 mt-1">Enter a location to begin solar analysis</p>
              </div>
            )}

            {appState === AppState.FETCHING_WEATHER && (
              <div className={`h-[450px] rounded-xl border ${currentTheme.classes.border} ${currentTheme.classes.bgCard} flex flex-col items-center justify-center`}>
                <div className="relative">
                  <CloudRain className="w-16 h-16 text-blue-400 animate-bounce" />
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-12 h-1 bg-blue-400/30 rounded-full blur-sm"></div>
                </div>
                <p className={`mt-6 font-medium ${currentTheme.classes.accentText}`}>Fetching Real-time Weather Data...</p>
                <p className={`text-xs ${currentTheme.classes.textDim} mt-2`}>Connecting to Open-Meteo API</p>
                <div className="flex gap-1 mt-4">
                  {[0, 1, 2].map(i => (
                    <div 
                      key={i} 
                      className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"
                      style={{ animationDelay: `${i * 0.2}s` }}
                    />
                  ))}
                </div>
              </div>
            )}

            {appState === AppState.ANALYZING && (
              <div className={`h-[450px] rounded-xl border ${currentTheme.classes.border} ${currentTheme.classes.bgCard} flex flex-col items-center justify-center`}>
                <div className="relative">
                  <div className={`w-16 h-16 border-4 ${currentTheme.classes.accentText} border-t-transparent rounded-full animate-spin`}></div>
                  <Sun className={`w-8 h-8 ${currentTheme.classes.accentText} absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2`} />
                </div>
                <p className={`mt-6 font-medium ${currentTheme.classes.accentText}`}>Generating Solar Forecast...</p>
                <p className={`text-xs ${currentTheme.classes.textDim} mt-2`}>Analyzing weather patterns and solar position</p>
              </div>
            )}

            {appState === AppState.ERROR && (
              <div className="h-[450px] rounded-xl border border-red-900/50 bg-red-900/10 flex flex-col items-center justify-center text-red-400 p-6">
                <CloudLightning className="w-16 h-16 mb-4 opacity-50" />
                <p className="font-medium text-lg">Forecast Generation Failed</p>
                <p className="text-sm opacity-80 mt-2 text-center max-w-md">
                  {errorMessage || 'Unable to process weather data. Please try again with different coordinates.'}
                </p>
                <button
                  onClick={() => setAppState(AppState.IDLE)}
                  className="mt-6 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-sm transition-colors"
                >
                  Try Again
                </button>
              </div>
            )}

            {appState === AppState.SUCCESS && currentForecast.length > 0 && (
              <div className="space-y-4">
                
                {/* Control Bar */}
                <div className={`flex flex-col gap-3 bg-black/20 p-3 rounded-xl border ${currentTheme.classes.border}`}>
                  {/* Duration Selector Row */}
                  <div className="flex items-center gap-3">
                    <div className={`flex items-center gap-2 text-xs ${currentTheme.classes.textMuted}`}>
                      <Clock className="w-4 h-4" />
                      <span className="hidden sm:inline">View:</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {durationOptions.map(hours => (
                        <button
                          key={hours}
                          onClick={() => setViewDuration(hours)}
                          className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all ${
                            viewDuration === hours
                              ? currentTheme.classes.buttonActive
                              : `${currentTheme.classes.buttonSecondary} hover:bg-white/10`
                          }`}
                        >
                          {hours === 0 ? 'All' : hours === 168 ? '7d' : `${hours}h`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Download Data Row */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2 border-t border-white/5">
                    <div className={`flex items-center gap-2 text-xs ${currentTheme.classes.textMuted}`}>
                      <Download className="w-4 h-4" />
                      <span>Download Data:</span>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2 flex-1">
                      {/* Date Range Picker */}
                      <div className={`flex items-center gap-2 ${currentTheme.classes.bgInput} rounded-lg px-2 py-1.5 border border-white/5 flex-1 sm:flex-none`}>
                        <Calendar className={`w-3.5 h-3.5 ${currentTheme.classes.textDim} flex-shrink-0`} />
                        <input
                          type="date"
                          min={minHistoricalDate}
                          max={maxForecastDate}
                          value={downloadStartDate}
                          onChange={(e) => {
                            const newStart = e.target.value;
                            if (newStart) {
                              setDownloadStartDate(newStart);
                              if (newStart > downloadEndDate) setDownloadEndDate(newStart);
                              setDownloadError('');
                            }
                          }}
                          className={`bg-transparent text-xs font-medium outline-none cursor-pointer ${currentTheme.classes.textMain} [color-scheme:dark] w-[110px]`}
                        />
                        <ArrowRight className={`w-3 h-3 ${currentTheme.classes.textDim} flex-shrink-0`} />
                        <input
                          type="date"
                          min={minHistoricalDate}
                          max={maxForecastDate}
                          value={downloadEndDate}
                          onChange={(e) => {
                            const newEnd = e.target.value;
                            if (newEnd) {
                              setDownloadEndDate(newEnd);
                              if (newEnd < downloadStartDate) setDownloadStartDate(newEnd);
                              setDownloadError('');
                            }
                          }}
                          className={`bg-transparent text-xs font-medium outline-none cursor-pointer ${currentTheme.classes.textMain} [color-scheme:dark] w-[110px]`}
                        />
                      </div>

                      {/* Download Buttons */}
                      <div className="flex gap-1">
                        <button 
                          onClick={() => downloadData('csv')}
                          disabled={isDownloadingHistorical}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg ${currentTheme.classes.buttonSecondary} border border-white/5 hover:bg-white/10 transition-all disabled:opacity-50`}
                          title="Download as CSV"
                        >
                          {isDownloadingHistorical ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                          )}
                          CSV
                        </button>
                        <button 
                          onClick={() => downloadData('json')}
                          disabled={isDownloadingHistorical}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg ${currentTheme.classes.buttonSecondary} border border-white/5 hover:bg-white/10 transition-all disabled:opacity-50`}
                          title="Download as JSON"
                        >
                          {isDownloadingHistorical ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <FileJson className="w-3.5 h-3.5" />
                          )}
                          JSON
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Date range info */}
                  <div className={`text-xs ${currentTheme.classes.textDim} flex items-center gap-2`}>
                    <span>📅 Select any date from {format(parseISO(minHistoricalDate), 'MMM yyyy')} to {format(parseISO(maxForecastDate), 'MMM dd, yyyy')} (historical + forecast)</span>
                  </div>

                  {/* Download Error */}
                  {downloadError && (
                    <div className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg border border-red-500/20">
                      {downloadError}
                    </div>
                  )}
                </div>

                {/* Chart */}
                <SolarChart 
                  history={visibleHistory} 
                  forecast={visibleForecast} 
                  weather={currentWeatherData} 
                  theme={currentTheme}
                  locationName={currentLocationName}
                />
                
                {/* Stats Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className={`${currentTheme.classes.bgCard} p-4 rounded-xl border ${currentTheme.classes.border} transition-colors duration-300`}>
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4 text-yellow-400" />
                      <p className={`${currentTheme.classes.textMuted} text-xs uppercase font-semibold tracking-wider`}>Peak</p>
                    </div>
                    <p className="text-2xl font-bold text-yellow-400">
                      {Math.max(...visibleForecast.map(f => f.predictedIrradiance)).toFixed(0)}
                    </p>
                    <p className={`text-xs ${currentTheme.classes.textDim}`}>W/m²</p>
                  </div>
                  <div className={`${currentTheme.classes.bgCard} p-4 rounded-xl border ${currentTheme.classes.border} transition-colors duration-300`}>
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className={`w-4 h-4 ${currentTheme.classes.accentText}`} />
                      <p className={`${currentTheme.classes.textMuted} text-xs uppercase font-semibold tracking-wider`}>Confidence</p>
                    </div>
                    <p className={`text-2xl font-bold ${currentTheme.classes.accentText}`}>
                      {(visibleForecast.reduce((acc, curr) => acc + curr.confidence, 0) / visibleForecast.length * 100).toFixed(0)}%
                    </p>
                    <p className={`text-xs ${currentTheme.classes.textDim}`}>average</p>
                  </div>
                  <div className={`${currentTheme.classes.bgCard} p-4 rounded-xl border ${currentTheme.classes.border} transition-colors duration-300`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="w-4 h-4 text-purple-400" />
                      <p className={`${currentTheme.classes.textMuted} text-xs uppercase font-semibold tracking-wider`}>Energy</p>
                    </div>
                    <p className="text-2xl font-bold text-purple-400">
                      {(visibleForecast.reduce((acc, curr) => acc + curr.predictedIrradiance, 0) / 1000).toFixed(1)}
                    </p>
                    <p className={`text-xs ${currentTheme.classes.textDim}`}>kWh est.</p>
                  </div>
                  <div className={`${currentTheme.classes.bgCard} p-4 rounded-xl border ${currentTheme.classes.border} transition-colors duration-300`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4 text-green-400" />
                      <p className={`${currentTheme.classes.textMuted} text-xs uppercase font-semibold tracking-wider`}>Duration</p>
                    </div>
                    <p className="text-2xl font-bold text-green-400">
                      {isAllTime ? visibleForecast.length : viewDuration}
                    </p>
                    <p className={`text-xs ${currentTheme.classes.textDim}`}>hours</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Footer Note */}
            <div className={`p-3 bg-black/20 rounded-xl border ${currentTheme.classes.border} text-xs ${currentTheme.classes.textDim}`}>
              <p>
                📊 Forecasts use real-time data from Open-Meteo API. Download historical weather data up to 2 years back or forecast data up to 7 days ahead.
                Auto-refreshes every 30 minutes.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;