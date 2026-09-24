// Shared rules for the parent sign-in/out flow: the PIN format and the
// geofence around each center. Imported by both the API and the dialog so the
// client can explain a rejection with the same numbers the server used.

export const PIN_LENGTH = 6;
export const METERS_PER_MILE = 1609.344;
export const DEFAULT_SIGN_IN_RADIUS_METERS = 1609;

export function isValidPin(value) {
  return typeof value === "string" && new RegExp(`^\\d{${PIN_LENGTH}}$`).test(value);
}

// Great-circle distance in meters between two lat/lng points (haversine).
export function distanceMeters(from, to) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRad(to.latitude - from.latitude);
  const dLng = toRad(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.latitude)) * Math.cos(toRad(to.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function parseCoordinates(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (
    latitude === null ||
    latitude === undefined ||
    latitude === "" ||
    longitude === null ||
    longitude === undefined ||
    longitude === "" ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  ) {
    return null;
  }
  return { latitude: lat, longitude: lng };
}

export function centerHasLocation(center) {
  return !!parseCoordinates(center?.latitude, center?.longitude);
}

/**
 * Where the parent stands relative to a center. `configured` is false when an
 * admin has not pinned the center on the map yet, in which case nobody can be
 * inside its geofence.
 */
export function checkProximity(center, position) {
  const radiusMeters = center?.signInRadiusMeters || DEFAULT_SIGN_IN_RADIUS_METERS;
  const centerPoint = parseCoordinates(center?.latitude, center?.longitude);
  if (!centerPoint) {
    return { configured: false, withinRange: false, distanceMeters: null, radiusMeters };
  }
  const distance = distanceMeters(position, centerPoint);
  return {
    configured: true,
    withinRange: distance <= radiusMeters,
    distanceMeters: Math.round(distance),
    radiusMeters,
  };
}

export function formatMiles(meters) {
  const miles = meters / METERS_PER_MILE;
  if (miles < 0.1) return "less than 0.1 miles";
  const rounded = miles < 10 ? miles.toFixed(1) : String(Math.round(miles));
  return `${rounded} ${rounded === "1.0" ? "mile" : "miles"}`;
}

// Latitude/longitude/radius for a center's sign-in geofence, from an admin
// form body. Returns { data } to write or { error }. Blank coordinates clear
// the pin.
export function centerGeofenceData(body = {}) {
  const data = {};
  if (body.latitude !== undefined || body.longitude !== undefined) {
    const blank = (v) => v === null || v === undefined || v === "";
    if (blank(body.latitude) && blank(body.longitude)) {
      data.latitude = null;
      data.longitude = null;
    } else {
      const coords = parseCoordinates(body.latitude, body.longitude);
      if (!coords) return { error: "Enter a valid latitude and longitude." };
      Object.assign(data, coords);
    }
  }
  if (body.signInRadiusMeters !== undefined && body.signInRadiusMeters !== "") {
    const radius = Math.round(Number(body.signInRadiusMeters));
    if (!Number.isFinite(radius) || radius < 50 || radius > 80467) {
      return { error: "Sign-in radius must be between 50 meters and 50 miles." };
    }
    data.signInRadiusMeters = radius;
  }
  return { data };
}
