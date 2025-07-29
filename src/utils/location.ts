// utils/location.ts
import { Geolocation } from '@capacitor/geolocation';

export const getCurrentLocation = async () => {
  try {
    const coordinates = await Geolocation.getCurrentPosition();
    return {
      latitude: coordinates.coords.latitude,
      longitude: coordinates.coords.longitude
    };
  } catch (error) {
    console.error('Error getting location:', error);
    return null;
  }
};
