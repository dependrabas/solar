import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  Legend,
  Brush
} from 'recharts';
import { ForecastPoint, SolarDataPoint, Theme } from '../types';
import { EnhancedWeatherForecast } from '../services/weatherService';
import { Sun, CloudRain, Thermometer, Wind, Droplets, TrendingUp, TrendingDown, Minus, Activity, BarChart3, Camera, Loader2 } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';

interface SolarChartProps {
  history: SolarDataPoint[];
  forecast: ForecastPoint[];
  weather: EnhancedWeatherForecast | null;
  theme: Theme;
  locationName?: string;
}

type GraphType = 'solar' | 'weather' | 'combined' | 'analysis';

// Custom tooltip component for better UX
const CustomTooltip = ({ active, payload, label, theme }: any) => {
  if (!active || !payload || !payload.length) return null;

  let formattedLabel = label;
  try {
    const date = parseISO(label);
    if (isValid(date)) {
      formattedLabel = format(date, 'MMM dd, HH:mm');
    }
  } catch (e) {
    // Keep original label
  }

  return (
    <div className={`${theme?.classes?.bgCard || 'bg-slate-800'} p-3 rounded-lg border ${theme?.classes?.border || 'border-slate-700'} shadow-xl backdrop-blur-md`}>
      <p className={`text-xs font-semibold ${theme?.classes?.textMain || 'text-white'} mb-2 border-b border-white/10 pb-1`}>
        {formattedLabel}
      </p>
      <div className="space-y-1">
        {payload.filter((entry: any) => entry.value !== null && entry.value !== undefined).map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-xs">
            <div 
              className="w-2 h-2 rounded-full" 
              style={{ backgroundColor: entry.color }}
            />
            <span className={theme?.classes?.textMuted || 'text-slate-400'}>
              {entry.name}:
            </span>
            <span className={`font-medium ${theme?.classes?.textMain || 'text-white'}`}>
              {typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}
              {entry.unit || ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Trend indicator component
const TrendIndicator = ({ value, label, unit, theme }: { value: number; label: string; unit: string; theme: Theme }) => {
  const isPositive = value > 0;
  const isNeutral = Math.abs(value) < 0.1;
  
  return (
    <div className={`flex items-center gap-1 text-xs ${theme.classes.textMuted}`}>
      {isNeutral ? (
        <Minus className="w-3 h-3 text-gray-400" />
      ) : isPositive ? (
        <TrendingUp className="w-3 h-3 text-green-400" />
      ) : (
        <TrendingDown className="w-3 h-3 text-red-400" />
      )}
      <span>{label}: {isPositive ? '+' : ''}{value.toFixed(2)}{unit}</span>
    </div>
  );
};

const SolarChart: React.FC<SolarChartProps> = ({ history, forecast, weather, theme, locationName = 'chart' }) => {
  const [graphType, setGraphType] = useState<GraphType>('solar');
  const [showBrush, setShowBrush] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const chartAreaRef = useRef<HTMLDivElement>(null);

  // Export chart as JPG - only the graph area
  const handleExportJPG = async () => {
    if (!chartAreaRef.current || isExporting) return;

    setIsExporting(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      
      const canvas = await html2canvas(chartAreaRef.current, {
        backgroundColor: '#1e293b',
        scale: 2,
        logging: false,
        useCORS: true,
        allowTaint: true,
        ignoreElements: (element) => {
          // Ignore the export button itself
          return element.classList.contains('export-btn');
        }
      });

      const link = document.createElement('a');
      const safeName = locationName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      link.download = `solarcast_${safeName}_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.95);
      link.click();
    } catch (error) {
      console.error('Failed to export chart:', error);
      alert('Failed to export chart. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  // Format time for display
  const formatTime = useCallback((timeStr: string) => {
    try {
      const date = parseISO(timeStr);
      if (isValid(date)) {
        return format(date, 'HH:mm');
      }
    } catch (e) {
      // Fallback
    }
    return timeStr;
  }, []);

  const formatDate = useCallback((timeStr: string) => {
    try {
      const date = parseISO(timeStr);
      if (isValid(date)) {
        return format(date, 'MMM dd');
      }
    } catch (e) {
      // Fallback
    }
    return timeStr;
  }, []);

  // Solar chart data with improved processing
  const solarChartData = useMemo(() => {
    if (!forecast.length) return [];

    return forecast.map((f, idx) => {
      let temp = null;
      let cloudCover = null;
      let radiation = null;

      if (weather) {
        const wIndex = weather.time.findIndex(t => t === f.time);
        if (wIndex >= 0) {
          temp = weather.temperature_2m[wIndex];
          cloudCover = weather.cloud_cover[wIndex];
          radiation = weather.shortwave_radiation[wIndex];
        }
      }

      return {
        time: f.time,
        displayTime: formatTime(f.time),
        displayDate: formatDate(f.time),
        predicted: f.predictedIrradiance,
        confidence: f.confidence * 100,
        confidenceLow: f.predictedIrradiance * (1 - (1 - f.confidence) * 0.5),
        confidenceHigh: f.predictedIrradiance * (1 + (1 - f.confidence) * 0.3),
        temperature: temp,
        cloudCover: cloudCover,
        radiation: radiation,
      };
    });
  }, [forecast, weather, formatTime, formatDate]);

  // Weather chart data
  const weatherChartData = useMemo(() => {
    if (!weather || !weather.time.length) return [];

    return weather.time.map((t, i) => ({
      time: t,
      displayTime: formatTime(t),
      displayDate: formatDate(t),
      cloudCover: weather.cloud_cover[i] || 0,
      temperature: weather.temperature_2m[i] || 0,
      humidity: weather.humidity?.[i] || 0,
      windSpeed: weather.windSpeed?.[i] || 0,
      windDirection: weather.windDirection?.[i] || 0,
      pressure: weather.pressure?.[i] || 1013,
      precipitation: weather.precipitation?.[i] || 0,
      radiation: weather.shortwave_radiation[i] || 0,
    }));
  }, [weather, formatTime, formatDate]);

  // Combined analysis data
  const combinedChartData = useMemo(() => {
    if (!forecast.length) return [];

    return forecast.map((f) => {
      let cloudCover = null;
      let temperature = null;
      let clearSkyPotential = null;
      let efficiency = null;

      if (weather && weather.time.length > 0) {
        const wIndex = weather.time.findIndex(t => t === f.time);
        if (wIndex >= 0) {
          cloudCover = weather.cloud_cover[wIndex];
          temperature = weather.temperature_2m[wIndex];
          clearSkyPotential = weather.shortwave_radiation[wIndex];
          
          if (clearSkyPotential && clearSkyPotential > 0) {
            efficiency = (f.predictedIrradiance / clearSkyPotential) * 100;
            efficiency = Math.min(100, Math.max(0, efficiency));
          }
        }
      }

      return {
        time: f.time,
        displayTime: formatTime(f.time),
        solarOutput: f.predictedIrradiance,
        cloudCover: cloudCover,
        temperature: temperature,
        efficiency: efficiency,
        clearSkyPotential: clearSkyPotential,
      };
    });
  }, [forecast, weather, formatTime]);

  // Analysis chart data
  const analysisChartData = useMemo(() => {
    if (!weather || !weather.time.length) return [];

    const startTime = forecast.length > 0 ? forecast[0].time : null;
    const endTime = forecast.length > 0 ? forecast[forecast.length - 1].time : null;

    return weather.time.map((t, i) => ({
      time: t,
      displayTime: formatTime(t),
      displayDate: formatDate(t),
      radiation: weather.shortwave_radiation[i] || 0,
      windSpeed: weather.windSpeed?.[i] || 0,
      precipitation: (weather.precipitation?.[i] || 0) * 10,
      pressure: weather.pressure?.[i] || 1013,
    })).filter(d => {
      if (!startTime || !endTime) return true;
      return d.time >= startTime && d.time <= endTime;
    });
  }, [weather, forecast, formatTime, formatDate]);

  const weatherTrends = weather?.weatherAnalysis?.weatherTrends;
  const weatherAlerts = weather?.weatherAnalysis?.weatherAlerts;
  const currentConditions = weather?.weatherAnalysis?.currentConditions;

  const hasWeatherData = weather && weather.time.length > 0;
  const hasCombinedData = combinedChartData.length > 0 && combinedChartData.some(d => d.cloudCover !== null);
  const hasAnalysisData = analysisChartData.length > 0;

  return (
    <div 
      className={`w-full ${theme.classes.bgCard} rounded-xl border ${theme.classes.border} shadow-xl backdrop-blur-sm flex flex-col transition-colors duration-300 relative`}
    >
      
      {/* Chart Header with Controls */}
      <div className="p-4 border-b border-white/5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Title */}
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${graphType === 'solar' ? 'bg-yellow-500/20' : graphType === 'weather' ? 'bg-blue-500/20' : graphType === 'combined' ? 'bg-purple-500/20' : 'bg-green-500/20'}`}>
              {graphType === 'solar' && <Sun className="w-5 h-5 text-yellow-400" />}
              {graphType === 'weather' && <CloudRain className="w-5 h-5 text-blue-400" />}
              {graphType === 'combined' && <Activity className="w-5 h-5 text-purple-400" />}
              {graphType === 'analysis' && <BarChart3 className="w-5 h-5 text-green-400" />}
            </div>
            <div>
              <h3 className={`${theme.classes.textMain} font-semibold text-sm`}>
                {graphType === 'solar' && 'Solar Irradiance Forecast'}
                {graphType === 'weather' && 'Weather Conditions'}
                {graphType === 'combined' && 'Solar vs Weather Analysis'}
                {graphType === 'analysis' && 'Radiation & Wind Analysis'}
              </h3>
              <p className={`text-xs ${theme.classes.textDim}`}>
                {graphType === 'solar' && 'Real-time solar output prediction (W/m²)'}
                {graphType === 'weather' && 'Temperature, cloud cover & humidity'}
                {graphType === 'combined' && 'Solar output correlated with cloud cover'}
                {graphType === 'analysis' && 'Raw radiation, wind speed & precipitation'}
              </p>
            </div>
          </div>

          {/* Graph Type Selector */}
          <div className="flex items-center gap-2">
            <div className="flex bg-black/30 p-1 rounded-lg border border-white/5">
              {[
                { type: 'solar' as GraphType, icon: Sun, label: 'Solar', disabled: false },
                { type: 'weather' as GraphType, icon: CloudRain, label: 'Weather', disabled: !hasWeatherData },
                { type: 'combined' as GraphType, icon: Activity, label: 'Combined', disabled: !hasCombinedData },
                { type: 'analysis' as GraphType, icon: BarChart3, label: 'Analysis', disabled: !hasAnalysisData },
              ].map(({ type, icon: Icon, label, disabled }) => (
                <button
                  key={type}
                  onClick={() => !disabled && setGraphType(type)}
                  disabled={disabled}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-all ${
                    graphType === type
                      ? `bg-white/10 ${theme.classes.textMain} shadow-sm`
                      : `${theme.classes.textMuted} hover:${theme.classes.textMain} hover:bg-white/5`
                  } ${disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>

            {/* Brush toggle */}
            <button
              onClick={() => setShowBrush(!showBrush)}
              className={`p-2 rounded-lg transition-all ${showBrush ? 'bg-white/10' : 'bg-black/20'} ${theme.classes.textMuted} hover:${theme.classes.textMain}`}
              title="Toggle zoom brush"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Current Conditions Bar */}
        {currentConditions && (graphType === 'weather' || graphType === 'combined' || graphType === 'analysis') && (
          <div className="mt-4 flex flex-wrap items-center gap-4 p-3 bg-black/20 rounded-lg border border-white/5">
            <div className="flex items-center gap-2">
              <Thermometer className="w-4 h-4 text-orange-400" />
              <span className={`text-sm ${theme.classes.textMain}`}>{currentConditions.temperature.toFixed(1)}°C</span>
            </div>
            <div className="flex items-center gap-2">
              <CloudRain className="w-4 h-4 text-blue-400" />
              <span className={`text-sm ${theme.classes.textMain}`}>{currentConditions.cloudCover.toFixed(0)}%</span>
            </div>
            <div className="flex items-center gap-2">
              <Droplets className="w-4 h-4 text-cyan-400" />
              <span className={`text-sm ${theme.classes.textMain}`}>{currentConditions.humidity.toFixed(0)}%</span>
            </div>
            <div className="flex items-center gap-2">
              <Wind className="w-4 h-4 text-gray-400" />
              <span className={`text-sm ${theme.classes.textMain}`}>{currentConditions.windSpeed.toFixed(1)} m/s</span>
            </div>
            
            {weatherTrends && (
              <div className="flex items-center gap-3 ml-auto">
                <TrendIndicator value={weatherTrends.tempTrend} label="Temp" unit="°C/h" theme={theme} />
                <TrendIndicator value={weatherTrends.cloudCoverTrend} label="Cloud" unit="%/h" theme={theme} />
              </div>
            )}
          </div>
        )}

        {/* Weather Alerts */}
        {weatherAlerts && Object.values(weatherAlerts).some(a => a) && (
          <div className="mt-2 flex flex-wrap gap-2">
            {weatherAlerts.cloudCoverAlert && (
              <span className="px-2 py-1 text-xs bg-blue-500/20 text-blue-300 rounded-full border border-blue-500/30">
                ⚠️ Heavy Cloud Cover
              </span>
            )}
            {weatherAlerts.temperatureAlert && (
              <span className="px-2 py-1 text-xs bg-red-500/20 text-red-300 rounded-full border border-red-500/30">
                ⚠️ Extreme Temperature
              </span>
            )}
            {weatherAlerts.windAlert && (
              <span className="px-2 py-1 text-xs bg-yellow-500/20 text-yellow-300 rounded-full border border-yellow-500/30">
                ⚠️ High Wind
              </span>
            )}
            {weatherAlerts.pressureAlert && (
              <span className="px-2 py-1 text-xs bg-purple-500/20 text-purple-300 rounded-full border border-purple-500/30">
                ⚠️ Pressure Change
              </span>
            )}
          </div>
        )}
      </div>

      {/* Chart Area - This is what gets exported */}
      <div ref={chartAreaRef} className="flex-1 p-4 relative bg-slate-800/50" style={{ minHeight: '380px' }}>
        <ResponsiveContainer width="100%" height={380}>
          {graphType === 'solar' ? (
            <AreaChart data={solarChartData} margin={{ top: 10, right: 30, left: 0, bottom: showBrush ? 40 : 0 }}>
              <defs>
                <linearGradient id="colorPredicted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={theme.chartColors.predicted} stopOpacity={0.8}/>
                  <stop offset="50%" stopColor={theme.chartColors.predicted} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={theme.chartColors.predicted} stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorConfidence" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} opacity={0.3} />
              <XAxis 
                dataKey="displayTime" 
                stroke="#64748b"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickLine={{ stroke: '#475569' }}
                axisLine={{ stroke: '#475569' }}
                interval="preserveStartEnd"
                minTickGap={40}
              />
              <YAxis 
                stroke="#64748b" 
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickLine={{ stroke: '#475569' }}
                axisLine={{ stroke: '#475569' }}
                label={{ value: 'W/m²', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 11 }}
              />
              <Tooltip content={<CustomTooltip theme={theme} />} />
              
              <Area 
                type="monotone" 
                dataKey="confidenceHigh" 
                stroke="none"
                fill="url(#colorConfidence)" 
                fillOpacity={0.3}
                name="Upper Bound"
                animationDuration={800}
              />
              
              <Area 
                type="monotone" 
                dataKey="predicted" 
                stroke={theme.chartColors.predicted}
                strokeWidth={2}
                fill="url(#colorPredicted)" 
                name="Solar Irradiance"
                animationDuration={1000}
                dot={false}
                activeDot={{ r: 6, fill: theme.chartColors.predicted, stroke: '#fff', strokeWidth: 2 }}
              />
              
              <Legend 
                wrapperStyle={{ paddingTop: '15px' }}
                formatter={(value) => <span className="text-xs text-slate-400">{value}</span>}
              />
              
              {showBrush && (
                <Brush 
                  dataKey="displayTime" 
                  height={30} 
                  stroke={theme.chartColors.predicted}
                  fill="#1e293b"
                  tickFormatter={(val) => val}
                />
              )}
            </AreaChart>
          ) : graphType === 'weather' ? (
            <ComposedChart data={weatherChartData} margin={{ top: 10, right: 30, left: 0, bottom: showBrush ? 40 : 0 }}>
              <defs>
                <linearGradient id="colorCloud" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={theme.chartColors.weatherBar} stopOpacity={0.6}/>
                  <stop offset="95%" stopColor={theme.chartColors.weatherBar} stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} opacity={0.3} />
              <XAxis 
                dataKey="displayTime" 
                stroke="#64748b"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickLine={{ stroke: '#475569' }}
                interval="preserveStartEnd"
                minTickGap={40}
              />
              <YAxis 
                yAxisId="left" 
                stroke="#64748b" 
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                domain={[0, 100]}
                label={{ value: 'Cloud/Humidity %', angle: -90, position: 'insideLeft', fill: theme.chartColors.weatherBar, fontSize: 10 }}
              />
              <YAxis 
                yAxisId="right" 
                orientation="right" 
                stroke="#64748b" 
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                label={{ value: 'Temp °C', angle: 90, position: 'insideRight', fill: theme.chartColors.weatherLine, fontSize: 10 }}
              />
              <Tooltip content={<CustomTooltip theme={theme} />} />
              
              <Bar 
                yAxisId="left"
                dataKey="cloudCover" 
                fill="url(#colorCloud)"
                name="Cloud Cover %"
                barSize={12}
                radius={[4, 4, 0, 0]}
                animationDuration={800}
              />
              
              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="humidity" 
                stroke="#06b6d4"
                strokeWidth={2}
                dot={false}
                name="Humidity %"
                animationDuration={1000}
              />
              
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="temperature" 
                stroke={theme.chartColors.weatherLine}
                strokeWidth={2.5}
                dot={false}
                name="Temperature °C"
                animationDuration={1200}
              />
              
              <Legend 
                wrapperStyle={{ paddingTop: '15px' }}
                formatter={(value) => <span className="text-xs text-slate-400">{value}</span>}
              />
              
              {showBrush && (
                <Brush 
                  dataKey="displayTime" 
                  height={30} 
                  stroke={theme.chartColors.weatherBar}
                  fill="#1e293b"
                />
              )}
            </ComposedChart>
          ) : graphType === 'combined' ? (
            <ComposedChart data={combinedChartData} margin={{ top: 10, right: 30, left: 0, bottom: showBrush ? 40 : 0 }}>
              <defs>
                <linearGradient id="colorSolarCombined" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={theme.chartColors.predicted} stopOpacity={0.7}/>
                  <stop offset="95%" stopColor={theme.chartColors.predicted} stopOpacity={0.1}/>
                </linearGradient>
                <linearGradient id="colorCloudCombined" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.5}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} opacity={0.3} />
              <XAxis 
                dataKey="displayTime" 
                stroke="#64748b"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                interval="preserveStartEnd"
                minTickGap={40}
              />
              <YAxis 
                yAxisId="left" 
                stroke="#64748b" 
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                label={{ value: 'Solar W/m²', angle: -90, position: 'insideLeft', fill: theme.chartColors.predicted, fontSize: 10 }}
              />
              <YAxis 
                yAxisId="right" 
                orientation="right" 
                stroke="#64748b" 
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                domain={[0, 100]}
                label={{ value: 'Cloud Cover %', angle: 90, position: 'insideRight', fill: '#3b82f6', fontSize: 10 }}
              />
              <Tooltip content={<CustomTooltip theme={theme} />} />
              
              <Area 
                yAxisId="left"
                type="monotone" 
                dataKey="solarOutput" 
                stroke={theme.chartColors.predicted}
                strokeWidth={2}
                fill="url(#colorSolarCombined)"
                name="Solar Output (W/m²)"
                animationDuration={1000}
              />
              
              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="clearSkyPotential" 
                stroke="#94a3b8"
                strokeWidth={1.5}
                strokeDasharray="5 5"
                dot={false}
                name="Clear Sky Potential"
                animationDuration={800}
              />
              
              <Bar 
                yAxisId="right"
                dataKey="cloudCover" 
                fill="url(#colorCloudCombined)"
                name="Cloud Cover %"
                barSize={10}
                radius={[3, 3, 0, 0]}
                animationDuration={600}
              />
              
              <Legend 
                wrapperStyle={{ paddingTop: '15px' }}
                formatter={(value) => <span className="text-xs text-slate-400">{value}</span>}
              />
              
              {showBrush && (
                <Brush 
                  dataKey="displayTime" 
                  height={30} 
                  stroke="#a855f7"
                  fill="#1e293b"
                />
              )}
            </ComposedChart>
          ) : (
            <ComposedChart data={analysisChartData} margin={{ top: 10, right: 30, left: 0, bottom: showBrush ? 40 : 0 }}>
              <defs>
                <linearGradient id="colorRadiation" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.6}/>
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} opacity={0.3} />
              <XAxis 
                dataKey="displayTime" 
                stroke="#64748b"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                interval="preserveStartEnd"
                minTickGap={40}
              />
              <YAxis 
                yAxisId="left" 
                stroke="#64748b" 
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                label={{ value: 'Radiation W/m²', angle: -90, position: 'insideLeft', fill: '#22c55e', fontSize: 10 }}
              />
              <YAxis 
                yAxisId="right" 
                orientation="right" 
                stroke="#64748b" 
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                label={{ value: 'Wind (m/s) / Precip (mm×10)', angle: 90, position: 'insideRight', fill: '#64748b', fontSize: 9 }}
              />
              <Tooltip content={<CustomTooltip theme={theme} />} />
              
              <Area 
                yAxisId="left"
                type="monotone" 
                dataKey="radiation" 
                stroke="#22c55e"
                strokeWidth={2}
                fill="url(#colorRadiation)"
                name="Solar Radiation (W/m²)"
                animationDuration={1000}
              />
              
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="windSpeed" 
                stroke="#64748b"
                strokeWidth={2}
                dot={false}
                name="Wind Speed (m/s)"
                animationDuration={1200}
              />
              
              <Bar 
                yAxisId="right"
                dataKey="precipitation" 
                fill="#3b82f6"
                opacity={0.6}
                name="Precipitation (mm×10)"
                barSize={8}
                radius={[2, 2, 0, 0]}
              />
              
              <Legend 
                wrapperStyle={{ paddingTop: '15px' }}
                formatter={(value) => <span className="text-xs text-slate-400">{value}</span>}
              />
              
              {showBrush && (
                <Brush 
                  dataKey="displayTime" 
                  height={30} 
                  stroke="#22c55e"
                  fill="#1e293b"
                />
              )}
            </ComposedChart>
          )}
        </ResponsiveContainer>

        {/* Export JPG Button - Bottom Right Corner (icon only) */}
        <button
          onClick={handleExportJPG}
          disabled={isExporting}
          className={`export-btn absolute bottom-4 right-4 p-2.5 rounded-lg 
            bg-black/40 hover:bg-black/60 backdrop-blur-sm
            ${theme.classes.textMuted} hover:${theme.classes.textMain}
            border border-white/10 hover:border-white/20
            transition-all shadow-lg
            disabled:opacity-50 disabled:cursor-not-allowed
            z-10`}
          title="Download chart as JPG"
        >
          {isExporting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Camera className="w-5 h-5" />
          )}
        </button>
      </div>
    </div>
  );
};

export default SolarChart;