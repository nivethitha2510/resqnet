import type { LocationCoordinates } from '../types/domain';

class LocationService {
  public getCurrentPosition(): Promise<LocationCoordinates> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser.'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          
          try {
            const addressDetails = await this.reverseGeocode(lat, lng);
            resolve({
              latitude: lat,
              longitude: lng,
              address: addressDetails.address || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
              city: addressDetails.city,
              district: addressDetails.district,
            });
          } catch {
            resolve({
              latitude: lat,
              longitude: lng,
              address: `GPS Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
            });
          }
        },
        (error) => {
          let errorMsg = 'Unable to retrieve location.';
          if (error.code === error.PERMISSION_DENIED) {
            errorMsg = 'Location permission denied. Please select location manually on the map.';
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            errorMsg = 'Location information is unavailable.';
          } else if (error.code === error.TIMEOUT) {
            errorMsg = 'Location request timed out.';
          }
          reject(new Error(errorMsg));
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }

  public async reverseGeocode(lat: number, lng: number): Promise<{ address?: string; city?: string; district?: string }> {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`
      );
      if (!response.ok) return {};
      const data = await response.json();
      
      return {
        address: data.display_name || undefined,
        city: data.address?.city || data.address?.town || data.address?.village,
        district: data.address?.state_district || data.address?.county,
      };
    } catch {
      return {};
    }
  }
}

export const locationService = new LocationService();
