/**
 * Modular Map Component
 * Hardened against invalid/null coordinates to prevent Leaflet render crashes.
 */

import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import type { LocationCoordinates, Incident, EmergencyReport, Vehicle } from '../../types/domain';

// Fix standard Leaflet default marker icon path issue in bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const DEFAULT_CENTER: [number, number] = [13.0827, 80.2707]; // Chennai coordinates fallback

function isValidCoordinate(lat: any, lng: any): boolean {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return false;
  const numLat = Number(lat);
  const numLng = Number(lng);
  return (
    !isNaN(numLat) &&
    !isNaN(numLng) &&
    isFinite(numLat) &&
    isFinite(numLng) &&
    numLat >= -90 &&
    numLat <= 90 &&
    numLng >= -180 &&
    numLng <= 180 &&
    !(numLat === 0 && numLng === 0)
  );
}

const createCustomMarker = (color: string, label: string) => {
  return L.divIcon({
    className: 'custom-leaflet-marker',
    html: `<div style="
      background-color: ${color};
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: 2px solid white;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: 12px;">
      ${label}
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

interface ModularMapProps {
  center?: LocationCoordinates | null;
  zoom?: number;
  incidents?: Incident[];
  reports?: EmergencyReport[];
  vehicles?: Vehicle[];
  selectableLocation?: boolean;
  onLocationSelect?: (location: LocationCoordinates) => void;
  selectedLocationPin?: LocationCoordinates | null;
  height?: string;
  className?: string;
}

const LocationPickerMarker: React.FC<{ onSelect: (loc: LocationCoordinates) => void }> = ({ onSelect }) => {
  useMapEvents({
    click(e) {
      onSelect({
        latitude: e.latlng.lat,
        longitude: e.latlng.lng,
        address: `Selected Pin (${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)})`,
      });
    },
  });
  return null;
};

export const ModularMap: React.FC<ModularMapProps> = ({
  center,
  zoom = 13,
  incidents = [],
  reports = [],
  vehicles = [],
  selectableLocation = false,
  onLocationSelect,
  selectedLocationPin,
  height = '400px',
  className = '',
}) => {
  const safeCenter: [number, number] =
    center && isValidCoordinate(center.latitude, center.longitude)
      ? [Number(center.latitude), Number(center.longitude)]
      : DEFAULT_CENTER;

  const validPin =
    selectedLocationPin && isValidCoordinate(selectedLocationPin.latitude, selectedLocationPin.longitude)
      ? {
          lat: Number(selectedLocationPin.latitude),
          lng: Number(selectedLocationPin.longitude),
          address: selectedLocationPin.address || 'Selected Location',
        }
      : null;

  const validIncidents = (incidents || []).filter(
    (inc) => inc && inc.location && isValidCoordinate(inc.location.latitude, inc.location.longitude)
  );

  const validReports = (reports || []).filter(
    (rep) => rep && rep.location && isValidCoordinate(rep.location.latitude, rep.location.longitude)
  );

  const validVehicles = (vehicles || []).filter(
    (veh) =>
      veh && veh.current_location && isValidCoordinate(veh.current_location.latitude, veh.current_location.longitude)
  );

  return (
    <div style={{ height }} className={`relative overflow-hidden rounded-xl border border-slate-200 shadow-sm ${className}`}>
      <MapContainer center={safeCenter} zoom={zoom} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {selectableLocation && onLocationSelect && (
          <LocationPickerMarker onSelect={onLocationSelect} />
        )}

        {validPin && (
          <Marker
            position={[validPin.lat, validPin.lng]}
            icon={createCustomMarker('#ef4444', '📍')}
          >
            <Popup>
              <div className="p-1">
                <p className="font-semibold text-slate-900 text-xs">Selected Location</p>
                <p className="text-slate-600 text-xs">{validPin.address}</p>
              </div>
            </Popup>
          </Marker>
        )}

        {validIncidents.map((inc) => (
          <Marker
            key={inc.id}
            position={[Number(inc.location.latitude), Number(inc.location.longitude)]}
            icon={createCustomMarker(
              inc.priority === 'critical' ? '#dc2626' : inc.priority === 'high' ? '#f59e0b' : '#3b82f6',
              '🚨'
            )}
          >
            <Popup>
              <div className="p-2 space-y-1">
                <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded text-white ${
                  inc.priority === 'critical' ? 'bg-red-600' : 'bg-amber-600'
                }`}>
                  {String(inc.priority || 'medium').toUpperCase()} • {String(inc.emergency_type || 'emergency').toUpperCase()}
                </span>
                <h4 className="font-bold text-slate-900 text-sm">{inc.title || 'Incident'}</h4>
                <p className="text-xs text-slate-600">{inc.location.address || 'Location unavailable'}</p>
                <p className="text-xs text-slate-700 font-medium">Status: {String(inc.status || 'open').toUpperCase()}</p>
              </div>
            </Popup>
          </Marker>
        ))}

        {validReports.map((rep) => (
          <Marker
            key={rep.id}
            position={[Number(rep.location.latitude), Number(rep.location.longitude)]}
            icon={createCustomMarker('#6366f1', '📣')}
          >
            <Popup>
              <div className="p-2 space-y-1">
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
                  REPORT {rep.id ? rep.id.slice(0, 8) : ''}
                </span>
                <p className="text-xs font-bold text-slate-900">{rep.ai_summary || rep.raw_text || 'Report'}</p>
                <p className="text-xs text-slate-500">{rep.location.address || 'Location unavailable'}</p>
              </div>
            </Popup>
          </Marker>
        ))}

        {validVehicles.map((veh) => (
          <Marker
            key={veh.id}
            position={[Number(veh.current_location.latitude), Number(veh.current_location.longitude)]}
            icon={createCustomMarker(veh.status === 'en_route' ? '#10b981' : '#64748b', '🚒')}
          >
            <Popup>
              <div className="p-2 space-y-1">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded text-white ${
                  veh.status === 'en_route' ? 'bg-emerald-600' : 'bg-slate-700'
                }`}>
                  {veh.vehicle_code} • {String(veh.status || 'available').toUpperCase()}
                </span>
                <p className="text-xs font-bold text-slate-900">{veh.name}</p>
                <p className="text-xs text-slate-500">{veh.current_location.address || 'Fleet Location'}</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};
