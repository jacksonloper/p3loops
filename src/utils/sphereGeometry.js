/**
 * Sphere geometry utilities for mapping rhombus coordinates to a 3D sphere.
 * 
 * The rhombus maps to a sphere where:
 *   - NE corner (southward=0, eastward=1) = North pole
 *   - SW corner (southward=1, eastward=0) = South pole
 *   - NW corner (southward=0, eastward=0) = on equator
 *   - SE corner (southward=1, eastward=1) = on equator
 * 
 * We define:
 *   - Latitude: ranges from +90° (north pole) to -90° (south pole)
 *   - Longitude: ranges from -180° to +180°
 * 
 * The mapping uses the diagonal from NE to SW as the polar axis,
 * and the perpendicular diagonal (NW to SE) defines the equator.
 */

import { getPointPaperCoordinates } from './geometry.js';

/**
 * Convert unit square coordinates (southward, eastward) to latitude/longitude.
 * 
 * Using the diagonal coordinates:
 *   - u = (eastward - southward) / 2 + 0.5  (ranges 0 to 1 along NW-SE diagonal direction)
 *   - v = (eastward + southward) / 2        (ranges 0 to 1 along SW-NE diagonal, 0 at NE, 1 at SW)
 * 
 * Then:
 *   - latitude = 90° - 180° * v  (north pole at v=0, south pole at v=1)
 *   - longitude = 360° * (u - 0.5)  (ranges -180° to +180°)
 */
export function unitSquareToLatLon(southward, eastward) {
  // Position along the NW-SE diagonal (perpendicular to polar axis)
  // At NW (0,0): u = 0.5, at SE (1,1): u = 0.5 (both on equator)
  // At NE (0,1): u = 1, at SW (1,0): u = 0
  const u = (eastward - southward + 1) / 2;
  
  // Position along the NE-SW diagonal (polar axis)
  // At NE (0,1): v = 0.5, at SW (1,0): v = 0.5
  // Let's use a different parameterization based on distance to NE corner
  // Distance from NE corner (0,1) to point (s,e):
  // For latitude, we need distance along the polar axis
  const v = (southward + (1 - eastward)) / 2; // 0 at NE, 1 at SW
  
  const latitude = 90 - 180 * v; // degrees, +90 at NE, -90 at SW
  const longitude = 360 * (u - 0.5); // degrees, -180 to +180
  
  return { latitude, longitude };
}

/**
 * Convert latitude/longitude to 3D Cartesian coordinates on a unit sphere.
 * 
 * @param {number} latitude - Latitude in degrees (-90 to 90)
 * @param {number} longitude - Longitude in degrees (-180 to 180)
 * @param {number} radius - Sphere radius (default 1)
 * @returns {{ x: number, y: number, z: number }}
 */
export function latLonToCartesian(latitude, longitude, radius = 1) {
  const latRad = (latitude * Math.PI) / 180;
  const lonRad = (longitude * Math.PI) / 180;
  
  // Standard spherical to Cartesian:
  // x = r * cos(lat) * cos(lon)
  // y = r * sin(lat)  (y is up)
  // z = r * cos(lat) * sin(lon)
  const x = radius * Math.cos(latRad) * Math.cos(lonRad);
  const y = radius * Math.sin(latRad);
  const z = radius * Math.cos(latRad) * Math.sin(lonRad);
  
  return { x, y, z };
}

/**
 * Convert a point (boundary or interior) to 3D sphere coordinates.
 * 
 * @param {Object} point - Point object with either {side, t} or {interior, southward, eastward}
 * @param {number} radius - Sphere radius
 * @returns {{ x: number, y: number, z: number }}
 */
export function pointToSphereCoordinates(point, radius = 1) {
  const paper = getPointPaperCoordinates(point);
  const { latitude, longitude } = unitSquareToLatLon(paper.southward, paper.eastward);
  return latLonToCartesian(latitude, longitude, radius);
}

/**
 * Subdivide an edge into N segments and return the 3D coordinates for each point.
 * 
 * @param {Object} edge - Edge object with {from, to}
 * @param {number} subdivisions - Number of segments to divide the edge into
 * @param {number} radius - Sphere radius
 * @returns {Array<{ x: number, y: number, z: number }>}
 */
export function subdivideEdgeOnSphere(edge, subdivisions = 10, radius = 1) {
  const fromPaper = getPointPaperCoordinates(edge.from);
  const toPaper = getPointPaperCoordinates(edge.to);
  
  const points = [];
  
  for (let i = 0; i <= subdivisions; i++) {
    const t = i / subdivisions;
    
    // Interpolate in paper coordinates (unit square)
    const southward = fromPaper.southward + t * (toPaper.southward - fromPaper.southward);
    const eastward = fromPaper.eastward + t * (toPaper.eastward - fromPaper.eastward);
    
    // Convert to sphere
    const { latitude, longitude } = unitSquareToLatLon(southward, eastward);
    const cartesian = latLonToCartesian(latitude, longitude, radius);
    
    points.push(cartesian);
  }
  
  return points;
}

/**
 * Get the midpoint of an edge on the sphere surface.
 * 
 * @param {Object} edge - Edge object with {from, to}
 * @param {number} radius - Sphere radius
 * @returns {{ position: { x, y, z }, direction: { x, y, z } }}
 */
export function getEdgeMidpointAndDirection(edge, radius = 1) {
  const fromPaper = getPointPaperCoordinates(edge.from);
  const toPaper = getPointPaperCoordinates(edge.to);
  
  // Midpoint in paper coordinates
  const midSouthward = (fromPaper.southward + toPaper.southward) / 2;
  const midEastward = (fromPaper.eastward + toPaper.eastward) / 2;
  
  // Convert midpoint to sphere
  const { latitude: midLat, longitude: midLon } = unitSquareToLatLon(midSouthward, midEastward);
  const midpoint = latLonToCartesian(midLat, midLon, radius);
  
  // Get a point slightly after midpoint to determine direction
  const t = 0.55;
  const afterSouthward = fromPaper.southward + t * (toPaper.southward - fromPaper.southward);
  const afterEastward = fromPaper.eastward + t * (toPaper.eastward - fromPaper.eastward);
  const { latitude: afterLat, longitude: afterLon } = unitSquareToLatLon(afterSouthward, afterEastward);
  const afterPoint = latLonToCartesian(afterLat, afterLon, radius);
  
  // Direction vector (from midpoint toward after point)
  const direction = {
    x: afterPoint.x - midpoint.x,
    y: afterPoint.y - midpoint.y,
    z: afterPoint.z - midpoint.z
  };
  
  // Normalize direction
  const len = Math.sqrt(direction.x ** 2 + direction.y ** 2 + direction.z ** 2);
  if (len > 0) {
    direction.x /= len;
    direction.y /= len;
    direction.z /= len;
  }
  
  return { position: midpoint, direction };
}
