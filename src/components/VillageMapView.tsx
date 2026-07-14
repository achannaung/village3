import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import { Village, FlaggedVillage } from '../types';
import { 
  Globe, 
  Map as MapIcon, 
  Plus, 
  Minus, 
  Maximize2, 
  AlertTriangle,
  Layers,
  Sparkles,
  Info
} from 'lucide-react';

interface VillageMapViewProps {
  villages: Village[];
  flaggedStates: Record<string, FlaggedVillage>;
  onSelectVillage: (village: Village) => void;
}

export default function VillageMapView({
  villages,
  flaggedStates,
  onSelectVillage,
}: VillageMapViewProps) {
  const [mapStyle, setMapStyle] = useState<'street' | 'satellite'>('satellite');
  const [mapZoom, setMapZoom] = useState(6);
  
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerGroupRef = useRef<L.FeatureGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const labelsLayerRef = useRef<L.TileLayer | null>(null);

  // Constants
  const MAX_MAP_MARKERS = 3000;
  const isClipped = villages.length > MAX_MAP_MARKERS;
  
  const mapVillages = useMemo(() => {
    if (isClipped) {
      return villages.slice(0, MAX_MAP_MARKERS);
    }
    return villages;
  }, [villages, isClipped]);

  // Inject Leaflet CSS stylesheet if not already present
  useEffect(() => {
    const cssId = 'leaflet-css';
    if (!document.getElementById(cssId)) {
      const link = document.createElement('link');
      link.id = cssId;
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
  }, []);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Default center of Myanmar
    const initialCenter: [number, number] = [21.9162, 95.9560];
    const initialZoom = 6;

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: initialZoom,
      zoomControl: false,
      attributionControl: false,
    });

    // Satellite layer default
    const tiles = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
    }).addTo(map);

    // Labels layer for satellite
    const labels = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
    }).addTo(map);

    const markerGroup = L.featureGroup().addTo(map);

    mapRef.current = map;
    tileLayerRef.current = tiles;
    labelsLayerRef.current = labels;
    markerGroupRef.current = markerGroup;

    // Scale Control
    L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);

    map.on('zoomend', () => {
      setMapZoom(map.getZoom());
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        tileLayerRef.current = null;
        labelsLayerRef.current = null;
        markerGroupRef.current = null;
      }
    };
  }, []);

  // Keep Map Tile Style Sync
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      let tileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      if (mapStyle === 'street') {
        tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
        if (labelsLayerRef.current && map.hasLayer(labelsLayerRef.current)) {
          map.removeLayer(labelsLayerRef.current);
        }
      } else {
        if (!labelsLayerRef.current) {
          labelsLayerRef.current = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 19,
          });
        }
        if (!map.hasLayer(labelsLayerRef.current)) {
          labelsLayerRef.current.addTo(map);
        }
      }
      tileLayerRef.current.setUrl(tileUrl);
    }
  }, [mapStyle]);

  // Update Markers when villages list changes
  useEffect(() => {
    const map = mapRef.current;
    const markerGroup = markerGroupRef.current;
    if (!map || !markerGroup) return;

    // Clear existing markers
    markerGroup.clearLayers();

    if (mapVillages.length === 0) return;

    // Add new markers
    mapVillages.forEach((village) => {
      const { id, latitude, longitude, nameEn, nameMm, townshipEn, stateEn, pcode } = village;
      if (!latitude || !longitude) return;

      // Standard color and size for all points on the map
      const color = '#6366f1'; // Indigo

      // Create high-performance circle marker
      const marker = L.circleMarker([latitude, longitude], {
        radius: 5,
        fillColor: color,
        color: '#ffffff',
        weight: 1.2,
        opacity: 0.9,
        fillOpacity: 0.85,
      });

      // HTML Content for the Leaflet Popup with copyable coordinates
      const popupContainer = document.createElement('div');
      popupContainer.className = 'custom-leaflet-popup';
      popupContainer.innerHTML = `
        <div class="font-sans text-xs min-w-[200px] text-slate-100 p-1">
          <div class="flex items-center justify-between mb-1.5 pb-1 border-b border-slate-800">
            <span class="text-[9px] uppercase tracking-wider font-bold text-indigo-400 font-mono">P-CODE: ${pcode}</span>
          </div>
          <div class="font-bold text-sm text-white mb-0.5 leading-snug">${nameEn}</div>
          <div class="text-base text-indigo-200 font-semibold mb-1.5 font-sans">${nameMm}</div>
          <div class="text-[11px] text-slate-400 space-y-0.5 mb-2.5">
            <div><strong class="text-slate-300 font-medium">Township:</strong> ${townshipEn}</div>
            <div><strong class="text-slate-300 font-medium">State / Region:</strong> ${stateEn}</div>
          </div>
          
          <div class="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between gap-1.5 bg-slate-900/60 rounded-lg p-1.5 border border-slate-800">
            <div class="flex flex-col">
              <span class="text-[8px] uppercase font-bold text-slate-500 tracking-wider">Coordinates</span>
              <span class="text-[10px] font-mono text-slate-300">${latitude.toFixed(5)}, ${longitude.toFixed(5)}</span>
            </div>
            <button id="map-popup-copy-${id}" class="text-[10px] font-semibold bg-indigo-600 hover:bg-indigo-500 text-white py-1 px-2.5 rounded-md cursor-pointer transition duration-150 active:scale-95 shadow-md flex items-center gap-1 shrink-0">
              <span>Copy</span>
            </button>
          </div>
        </div>
      `;

      // Attach copy event listener inside popup
      const copyBtn = popupContainer.querySelector(`#map-popup-copy-${id}`);
      if (copyBtn) {
        copyBtn.addEventListener('click', (e) => {
          e.preventDefault();
          navigator.clipboard.writeText(`${latitude}, ${longitude}`);
          const btnSpan = copyBtn.querySelector('span');
          if (btnSpan) {
            btnSpan.textContent = 'Copied!';
            copyBtn.classList.remove('bg-indigo-600', 'hover:bg-indigo-500');
            copyBtn.classList.add('bg-emerald-600', 'hover:bg-emerald-500');
            setTimeout(() => {
              btnSpan.textContent = 'Copy';
              copyBtn.classList.remove('bg-emerald-600', 'hover:bg-emerald-500');
              copyBtn.classList.add('bg-indigo-600', 'hover:bg-indigo-500');
            }, 1500);
          }
        });
      }

      marker.bindPopup(popupContainer, {
        closeButton: false,
        maxWidth: 240,
        className: 'dark-leaflet-popup'
      });

      // Add to feature group
      markerGroup.addLayer(marker);
    });

    // Fit map to markers bounds
    try {
      const bounds = markerGroup.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
      }
    } catch (e) {
      console.warn("Failed to zoom to points bounds:", e);
    }

  }, [mapVillages, flaggedStates]);

  // Controls Handlers
  const handleZoomIn = () => mapRef.current?.zoomIn();
  const handleZoomOut = () => mapRef.current?.zoomOut();
  const handleFitBounds = () => {
    const markerGroup = markerGroupRef.current;
    const map = mapRef.current;
    if (!map || !markerGroup) return;
    try {
      const bounds = markerGroup.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40] });
      }
    } catch (e) {
      console.warn("Could not fit map bounds:", e);
    }
  };

  const handleToggleStyle = () => {
    setMapStyle(current => (current === 'satellite' ? 'street' : 'satellite'));
  };

  return (
    <div className="relative w-full h-[550px] bg-slate-950 flex flex-col overflow-hidden">
      {/* HUD Banner overlay for clipped list warning */}
      {isClipped && (
        <div className="absolute top-3 left-3 z-10 bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs px-3 py-2 rounded-xl shadow-xl flex items-center gap-2 max-w-sm backdrop-blur-md" style={{ zIndex: 1000 }}>
          <AlertTriangle size={14} className="shrink-0 text-amber-400" />
          <span>
            Showing first <strong className="font-semibold">{MAX_MAP_MARKERS}</strong> of <strong className="font-semibold">{villages.length.toLocaleString()}</strong> villages on map. Narrow down with search filters to see specific records.
          </span>
        </div>
      )}

      {/* Floating map counts HUD */}
      {!isClipped && villages.length > 0 && (
        <div className="absolute top-3 left-3 z-10 bg-slate-950/90 border border-slate-800 text-[11px] px-3 py-1.5 rounded-xl shadow-xl flex items-center gap-2 backdrop-blur-md text-slate-300" style={{ zIndex: 1000 }}>
          <Sparkles size={12} className="text-indigo-400" />
          <span>Rendering <strong className="text-white font-semibold">{villages.length}</strong> points</span>
        </div>
      )}

      {/* Empty State Overlay */}
      {villages.length === 0 && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm text-center px-4">
          <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center border border-slate-800 text-slate-500 mb-4 shadow-xl">
            <MapIcon size={28} />
          </div>
          <h4 className="text-lg font-bold text-white font-serif">No Spatial Points to Plot</h4>
          <p className="text-sm text-slate-400 max-w-sm mt-1.5">
            Select a State/Region or Township spelling inside the filters and click search to view and interact with GIS village points.
          </p>
        </div>
      )}

      {/* Actual Map Canvas Div */}
      <div ref={mapContainerRef} className="w-full h-full" style={{ zIndex: 1 }} />



      {/* Floating Custom HUD Controls overlay */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5" style={{ zIndex: 1000 }}>
        {/* Zoom In */}
        <button
          onClick={handleZoomIn}
          className="w-8 h-8 rounded-lg bg-slate-950/90 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-900 transition flex items-center justify-center shadow-lg cursor-pointer"
          title="Zoom In"
        >
          <Plus size={16} />
        </button>
        
        {/* Zoom Out */}
        <button
          onClick={handleZoomOut}
          className="w-8 h-8 rounded-lg bg-slate-950/90 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-900 transition flex items-center justify-center shadow-lg cursor-pointer"
          title="Zoom Out"
        >
          <Minus size={16} />
        </button>

        {/* Fit Bounds */}
        <button
          onClick={handleFitBounds}
          className="w-8 h-8 rounded-lg bg-indigo-600/90 border border-indigo-500/40 text-white hover:bg-indigo-500 transition flex items-center justify-center shadow-lg cursor-pointer"
          title="Fit All Points in View"
        >
          <Maximize2 size={13} />
        </button>

        {/* Style Toggle */}
        <button
          onClick={handleToggleStyle}
          className={`w-8 h-8 rounded-lg border transition flex items-center justify-center shadow-lg cursor-pointer ${
            mapStyle === 'satellite' 
              ? 'bg-indigo-600/90 border-indigo-500/40 text-white hover:bg-indigo-500' 
              : 'bg-slate-950/90 border-slate-800 text-slate-300 hover:text-white'
          }`}
          title={`Active View: ${mapStyle === 'satellite' ? 'Satellite (Default)' : 'Street'}. Click to switch.`}
        >
          {mapStyle === 'satellite' ? <Globe size={14} /> : <MapIcon size={14} />}
        </button>
      </div>

      {/* Small floating HUD banner for active map settings */}
      {villages.length > 0 && (
        <div className="absolute bottom-4 right-4 z-10 bg-slate-950/90 border border-slate-800 text-[10px] px-2.5 py-1.5 rounded-xl shadow-xl flex items-center gap-1.5 backdrop-blur-md pointer-events-none text-slate-400" style={{ zIndex: 1000 }}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>Zoom: <strong className="text-white font-mono">{mapZoom}</strong></span>
          <span className="text-slate-650">|</span>
          <span>Layer: <strong className="text-white font-mono uppercase">{mapStyle}</strong></span>
        </div>
      )}
    </div>
  );
}
