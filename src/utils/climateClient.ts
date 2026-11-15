import type { ClimateLocationReading } from '../config/assistantEngine';
import type { Chemistry, VehicleType } from '../config/modelConfig';

export interface ClimateRequestParams {
  latitude?: number;
  longitude?: number;
  locationQuery?: string;
  vehicleType: VehicleType;
  chemistry: Chemistry;
}

export async function fetchClimateLocationReading(
  params: ClimateRequestParams,
): Promise<ClimateLocationReading> {
  const response = await fetch('/api/climate-location', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const payload = (await response.json().catch(() => ({}))) as Partial<ClimateLocationReading> & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(
      payload.error || 'Could not retrieve Google Maps climate data for this location.',
    );
  }

  return {
    locationName: payload.locationName || params.locationQuery || 'Current location',
    climateProfile: payload.climateProfile || 'Regional climate estimate',
    peakTempRangeC: payload.peakTempRangeC || '32–42°C',
    suggestedHeatPct:
      typeof payload.suggestedHeatPct === 'number' ? payload.suggestedHeatPct : 25,
    chargingAdvice: payload.chargingAdvice || '',
    summary: payload.summary || '',
    mapLinks: Array.isArray(payload.mapLinks) ? payload.mapLinks : [],
    latitude: payload.latitude ?? params.latitude ?? null,
    longitude: payload.longitude ?? params.longitude ?? null,
    updatedAt: payload.updatedAt,
  };
}

export function getBrowserCoordinates(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Location services are unavailable in this browser. Enter a city instead.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          reject(new Error('Location permission was denied. Enter your city or locality below instead.'));
        } else if (err.code === err.TIMEOUT) {
          reject(new Error('Location request timed out. Try again or enter your city name.'));
        } else {
          reject(new Error('Could not detect GPS location. Enter your city name instead.'));
        }
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000,
      },
    );
  });
}
