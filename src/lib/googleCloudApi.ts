/**
 * Google Cloud API Integration
 * Provides static maps and landmark imagery using Google Cloud APIs
 */

const GOOGLE_API_KEY = process.env.GOOGLE_CLOUDS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_CLOUDS_API_KEY;

export interface GooglePlacesPhoto {
  photo_reference: string;
  height: number;
  width: number;
  html_attributions: string[];
}

export interface GooglePlace {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  photos?: GooglePlacesPhoto[];
  types: string[];
  rating?: number;
}

/**
 * Get static map image URL using Google Maps Static API
 */
export function getStaticMapUrl(
  lat: number,
  lng: number,
  zoom: number = 17,
  width: number = 512,
  height: number = 512,
  markers?: Array<{ lat: number; lng: number; color?: string; label?: string }>
): string {
  if (!GOOGLE_API_KEY) {
    console.warn('Google API key not found, cannot generate map');
    return '';
  }

  let url = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=${width}x${height}&key=${GOOGLE_API_KEY}`;
  
  if (markers && markers.length > 0) {
    const markerParams = markers.map((m) => {
      const color = m.color || 'red';
      const label = m.label ? `label:${m.label}|` : '';
      return `&markers=${label}color:${color}|${m.lat},${m.lng}`;
    }).join('');
    url += markerParams;
  }
  
  return url;
}

/**
 * Get visual landmark with photo using Google Places API
 */
export async function getVisualLandmark(lat: number, lng: number): Promise<{
  name: string;
  category: string;
  distance: number;
  imageUrl?: string;
  description?: string;
} | null> {
  if (!GOOGLE_API_KEY) {
    console.warn('Google API key not found, cannot fetch landmarks');
    return null;
  }

  try {
    // Search for nearby places using Google Places API
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=200&type=point_of_interest&key=${GOOGLE_API_KEY}`
    );

    if (!response.ok) {
      throw new Error(`Google Places API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      // Look for a place with photos
      const placeWithPhoto = data.results.find((place: GooglePlace) => 
        place.photos && place.photos.length > 0
      );
      
      const selectedPlace = placeWithPhoto || data.results[0];
      const distance = calculateDistance(
        lat, lng,
        selectedPlace.geometry.location.lat,
        selectedPlace.geometry.location.lng
      );

      let imageUrl: string | undefined;
      
      // Get photo URL if available
      if (selectedPlace.photos && selectedPlace.photos.length > 0) {
        const photoRef = selectedPlace.photos[0].photo_reference;
        imageUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photoRef}&key=${GOOGLE_API_KEY}`;
      }

      return {
        name: selectedPlace.name,
        category: getCategoryFromTypes(selectedPlace.types),
        distance: Math.round(distance),
        imageUrl,
        description: selectedPlace.formatted_address
      };
    }

    return null;
  } catch (error) {
    console.error('Error finding Google Places landmark:', error);
    return null;
  }
}

/**
 * Get nearby landmarks using Google Places API
 */
export async function getNearbyLandmarks(
  lat: number,
  lng: number,
  type: string = 'point_of_interest',
  radius: number = 500
): Promise<GooglePlace[]> {
  if (!GOOGLE_API_KEY) {
    console.warn('Google API key not found, cannot fetch landmarks');
    return [];
  }

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=${type}&key=${GOOGLE_API_KEY}`
    );

    if (!response.ok) {
      throw new Error(`Google Places API error: ${response.status}`);
    }

    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error('Error fetching nearby landmarks:', error);
    return [];
  }
}

/**
 * Get place photo URL
 */
export function getPlacePhotoUrl(
  photoReference: string, 
  maxWidth: number = 400
): string {
  if (!GOOGLE_API_KEY) {
    console.warn('Google API key not found, cannot get photo');
    return '';
  }

  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photoreference=${photoReference}&key=${GOOGLE_API_KEY}`;
}

/**
 * Convert Google Places types to readable categories
 */
function getCategoryFromTypes(types: string[]): string {
  const typeMap: { [key: string]: string } = {
    'tourist_attraction': 'Attraction',
    'museum': 'Museum',
    'park': 'Park',
    'restaurant': 'Restaurant',
    'shopping_mall': 'Shopping',
    'hospital': 'Healthcare',
    'school': 'Education',
    'bank': 'Finance',
    'gas_station': 'Transport',
    'subway_station': 'MRT Station',
    'transit_station': 'Transit',
    'bus_station': 'Bus Stop',
    'place_of_worship': 'Religious',
    'library': 'Library',
    'government': 'Government',
    'establishment': 'Establishment'
  };

  for (const type of types) {
    if (typeMap[type]) {
      return typeMap[type];
    }
  }
  
  return types[0]?.replace(/_/g, ' ')?.replace(/\b\w/g, l => l.toUpperCase()) || 'Location';
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}