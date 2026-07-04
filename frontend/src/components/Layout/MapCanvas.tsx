import React from 'react';
import { default as BaseMap } from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

interface MapCanvasProps {
    mapRef: React.RefObject<any>;
    isMainMapPage: boolean;
    mapStyleUrl: string;
}

export const MapCanvas: React.FC<MapCanvasProps> = ({ mapRef, isMainMapPage, mapStyleUrl }) => {
    return (
        <div className={`h-full w-full ${isMainMapPage ? 'block' : 'hidden'}`}>
            {
               /*

         <BaseMap
                ref={mapRef}
                mapLib={maplibregl}
                initialViewState={{
                    latitude: 14.599710314289638,
                    longitude: 120.9736820397427,
                    zoom: 12.8
                }}
                mapStyle={mapStyleUrl}
                attributionControl={false}
                style={{ width: '100%', height: '100%' }}
            />

               */
            }
   
        </div>
    );
};
