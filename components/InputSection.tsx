import React, { useState } from 'react';
import { MapPin, Search, CheckCircle2, Navigation, AlertCircle, Info } from 'lucide-react';
import { LocationData, Theme } from '../types';
import { geocodeLocation } from '../services/weatherService';

interface InputSectionProps {
  onDataReady: (location: LocationData, locationName: string) => void;
  isProcessing: boolean;
  theme: Theme;
}

/**
 * Validates location data
 */
const validateLocationInput = (query: string): { valid: boolean; message: string } => {
  if (!query.trim()) {
    return { valid: false, message: 'Please enter a city name' };
  }

  if (query.length < 2) {
    return { valid: false, message: 'Location name must be at least 2 characters' };
  }

  if (query.length > 100) {
    return { valid: false, message: 'Location name is too long (max 100 characters)' };
  }

  // Check for valid characters (alphanumeric, spaces, hyphens, commas)
  const validPattern = /^[a-zA-Z0-9\s\-,.']+$/;
  if (!validPattern.test(query)) {
    return { valid: false, message: 'Location contains invalid characters' };
  }

  return { valid: true, message: '' };
};

/**
 * Validates coordinates
 */
const validateCoordinates = (latitude: number, longitude: number): { valid: boolean; message: string } => {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { valid: false, message: 'Invalid coordinates received' };
  }

  if (latitude < -90 || latitude > 90) {
    return { valid: false, message: 'Latitude must be between -90 and 90' };
  }

  if (longitude < -180 || longitude > 180) {
    return { valid: false, message: 'Longitude must be between -180 and 180' };
  }

  return { valid: true, message: '' };
};

/**
 * Validates complete location data
 */
const validateLocationData = (name: string, lat: number, lon: number): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // Validate input format
  const inputValidation = validateLocationInput(name);
  if (!inputValidation.valid) {
    errors.push(inputValidation.message);
  }

  // Validate coordinates
  const coordValidation = validateCoordinates(lat, lon);
  if (!coordValidation.valid) {
    errors.push(coordValidation.message);
  }

  // Additional check for realistic location names
  if (name.trim().split(/[\s,]+/).every(part => part.length === 1)) {
    errors.push('Location name appears to be just initials');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

const InputSection: React.FC<InputSectionProps> = ({ onDataReady, isProcessing, theme }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [location, setLocation] = useState<LocationData | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationInfo, setValidationInfo] = useState<string | null>(null);
  const [locationDetails, setLocationDetails] = useState<{ country: string; lat: number; lon: number } | null>(null);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    // Validate input
    const inputValidation = validateLocationInput(searchQuery);
    if (!inputValidation.valid) {
      setError(inputValidation.message);
      setLocation(null);
      setLocationName(null);
      setValidationInfo(null);
      return;
    }

    setIsSearching(true);
    setError(null);
    setValidationInfo(null);
    
    try {
      const result = await geocodeLocation(searchQuery);
      
      if (result) {
        // Validate received coordinates
        const coordValidation = validateCoordinates(result.latitude, result.longitude);
        if (!coordValidation.valid) {
          setError(coordValidation.message);
          setLocation(null);
          setLocationName(null);
          setLocationDetails(null);
          return;
        }

        // Validate complete location data
        const fullValidation = validateLocationData(result.name, result.latitude, result.longitude);
        if (!fullValidation.valid) {
          setError(fullValidation.errors.join('; '));
          setLocation(null);
          setLocationName(null);
          setLocationDetails(null);
          return;
        }

        // Success - set all data
        setLocation({
          latitude: result.latitude.toString(),
          longitude: result.longitude.toString()
        });
        setLocationName(`${result.name}, ${result.country}`);
        setLocationDetails({
          country: result.country,
          lat: result.latitude,
          lon: result.longitude
        });
        setValidationInfo(`✓ Location validated: ${result.name}, ${result.country} (${result.latitude.toFixed(2)}°, ${result.longitude.toFixed(2)}°)`);
      } else {
        setError("Location not found. Please check the spelling or try another city.");
        setLocation(null);
        setLocationName(null);
        setLocationDetails(null);
        setValidationInfo(null);
      }
    } catch (err) {
      setError("Failed to search location. Please try again.");
      setLocation(null);
      setLocationName(null);
      setLocationDetails(null);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!location) {
      if (searchQuery) {
        // Validate input first
        const inputValidation = validateLocationInput(searchQuery);
        if (!inputValidation.valid) {
          setError(inputValidation.message);
          return;
        }

        await handleSearch();
        return;
      } else {
        setError('Please search for a location.');
        return;
      }
    }

    // Final validation before submission
    if (locationDetails) {
      const finalValidation = validateLocationData(locationName || '', locationDetails.lat, locationDetails.lon);
      if (!finalValidation.valid) {
        setError(finalValidation.errors.join('; '));
        return;
      }
    }

    onDataReady(location, locationName || "Unknown Location");
  };

  return (
    <div className={`${theme.classes.bgCard} backdrop-blur-md rounded-xl p-6 border ${theme.classes.border} shadow-xl transition-colors duration-500`}>
      <h2 className={`text-xl font-bold ${theme.classes.textMain} mb-6 flex items-center gap-2`}>
        <Navigation className={`w-5 h-5 ${theme.classes.accentText}`} />
        Location Setup
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Location Search */}
        <div>
          <label className={`block text-xs font-medium ${theme.classes.textMuted} uppercase tracking-wider mb-2`}>Location</label>
          <p className={`text-xs ${theme.classes.textDim} mb-3`}>Enter a city name to search and validate</p>
          
          <div className="flex gap-2">
            <div className="relative flex-1">
              <MapPin className={`absolute left-3 top-2.5 w-4 h-4 ${theme.classes.textDim}`} />
              <input
                type="text"
                placeholder="Search city (e.g. London, New York, Tokyo)"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (location) {
                    setLocation(null); 
                    setLocationName(null);
                    setValidationInfo(null);
                  }
                  setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSearch();
                  }
                }}
                className={`w-full ${theme.classes.bgInput} border ${theme.classes.border} rounded-lg py-2 pl-10 pr-3 text-sm ${theme.classes.textMain} focus:ring-2 focus:ring-opacity-50 focus:ring-current focus:border-transparent outline-none transition-all placeholder-gray-600`}
                style={{ '--tw-ring-color': theme.id === 'cosmic' ? '#3b82f6' : theme.id === 'nature' ? '#10b981' : '#f97316' } as React.CSSProperties}
              />
            </div>
            <button
              type="button"
              onClick={(e) => handleSearch(e)}
              disabled={isSearching || !searchQuery}
              className={`${theme.classes.buttonSecondary} px-3 py-2 rounded-lg transition-colors border border-white/5 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isSearching ? (
                 <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <Search className="w-5 h-5" />
              )}
            </button>
          </div>
          
          {/* Validation Success */}
          {locationName && !error && (
             <div className="mt-3 flex items-start gap-2 text-xs text-green-400 bg-green-900/20 p-3 rounded border border-green-900/30">
                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-medium">Location Validated</p>
                  <p>{locationName}</p>
                  {locationDetails && (
                    <p className="text-green-400/70 mt-1">
                      Coordinates: {locationDetails.lat.toFixed(4)}°N, {locationDetails.lon.toFixed(4)}°E
                    </p>
                  )}
                </div>
             </div>
          )}

          {/* Validation Info */}
          {validationInfo && !error && (
            <div className="mt-2 flex items-start gap-2 text-xs text-blue-400 bg-blue-900/20 p-3 rounded border border-blue-900/30">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{validationInfo}</span>
            </div>
          )}
        </div>

        {/* Error Messages */}
        {error && (
          <div className="p-3 bg-red-900/20 border border-red-800 rounded-lg flex items-start gap-2 text-red-300 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Validation Error</p>
              <p className="text-xs mt-1">{error}</p>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={isProcessing || !location}
          className={`w-full py-3 px-4 rounded-lg font-medium text-sm transition-all shadow-lg ${
            isProcessing || !location
              ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
              : theme.classes.buttonPrimary
          }`}
        >
          {isProcessing ? 'Generating Forecast...' : location ? 'Generate Forecast' : 'Search for Location First'}
        </button>
      </form>
    </div>
  );
};

export default InputSection;