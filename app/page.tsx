'use client';

import { useState, useEffect, useRef } from 'react';
import * as exifr from 'exifr';
import Map from 'ol/Map.js';
import View from 'ol/View.js';
import TileLayer from 'ol/layer/Tile.js';
import OSM from 'ol/source/OSM.js';
import { fromLonLat } from 'ol/proj.js';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import { Icon, Style } from 'ol/style.js';

export default function Home() {
  const [metadata, setMetadata] = useState<Record<string, any>>({});
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [gpsData, setGpsData] = useState<{ latitude: number; longitude: number } | null>(null);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<Map | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const imageUrl = URL.createObjectURL(file);
    setImageSrc(imageUrl);

    try {
      const allMetaData = await exifr.parse(file,
        { tiff: true, gps: true, xmp: true , jfif: true,  }
      );
      console.log('All EXIF Metadata:', allMetaData);
      const gpsMetaData = await exifr.gps(file);  

      const filtered = Object.fromEntries(
        Object.entries(allMetaData || {}).filter(
          ([key]) => key !== 'MakerNote' && key !== 'thumbnail'
        )
      );

      setMetadata(filtered);

      // Set GPS data if available
      if (gpsMetaData && gpsMetaData.latitude && gpsMetaData.longitude) {
        setGpsData({
          latitude: gpsMetaData.latitude,
          longitude: gpsMetaData.longitude,
        });
      } else {
        setGpsData(null);
      }
    } catch (err) {
      console.error('Failed to parse EXIF:', err);
      setMetadata({ error: 'Failed to read EXIF metadata' });
      setGpsData(null);
    }
  };

  // Initialize map when gpsData changes
  useEffect(() => {
    if (gpsData && mapRef.current) {
      // Create a vector source and layer for the marker
      const marker = new Feature({
        geometry: new Point(fromLonLat([gpsData.longitude, gpsData.latitude])),
      });

      const markerStyle = new Style({
        image: new Icon({
          anchor: [0.5, 1],
          src: '/marker-icon.png', // Place a marker icon in public/marker-icon.png
        }),
      });
      marker.setStyle(markerStyle);

      const vectorSource = new VectorSource({
        features: [marker],
      });

      const vectorLayer = new VectorLayer({
        source: vectorSource,
      });

      // Initialize the map
      mapInstance.current = new Map({
        target: mapRef.current,
        layers: [
          new TileLayer({
            source: new OSM(), // OpenStreetMap tiles (no API key)
          }),
          vectorLayer,
        ],
        view: new View({
          center: fromLonLat([gpsData.longitude, gpsData.latitude]),
          zoom: 13,
        }),
      });

      // Cleanup map on component unmount or gpsData change
      return () => {
        if (mapInstance.current) {
          mapInstance.current.setTarget(undefined);
          mapInstance.current = null;
        }
      };
    }
  }, [gpsData]);

  return (
    <main className="min-h-screen bg-gray-100 text-gray-900 p-6">
      <div className="max-w-2xl mx-auto bg-white p-6 rounded-xl shadow-md">
        <h1 className="text-3xl font-bold mb-6 text-center">📷 EXIF Metadata Viewer</h1>

        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="mb-4 block w-full border border-gray-300 rounded-lg shadow-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />

        {imageSrc && (
          <div className="mb-6">
            <img
              src={imageSrc}
              alt="Uploaded preview"
              className="max-w-full rounded-lg shadow-sm"
            />
          </div>
        )}

        {gpsData && (
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">Location:</h2>
            <div ref={mapRef} className="h-64 w-full rounded-lg shadow-sm"></div>
          </div>
        )}

        {Object.keys(metadata).length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-2">Metadata:</h2>
            <ul className="text-sm bg-gray-50 rounded-lg p-4 space-y-2 max-h-[400px] overflow-auto border">
              {Object.entries(metadata).map(([key, value]) => (
                <li key={key}>
                  <strong>{key}:</strong>{' '}
                  {typeof value === 'object' && value !== null
                    ? JSON.stringify(value, null, 2)
                    : String(value)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}