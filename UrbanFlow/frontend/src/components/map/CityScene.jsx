/**
 * CityScene — React Three Fiber component that renders the 3D city.
 * Roads are colored by traffic density. Buildings are extruded polygons.
 */

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../../store/Store';

// Geo projection: convert lat/lng to local 3D coords (meters from center)
const CENTER_LAT = 40.7484;
const CENTER_LNG = -73.9857;
const DEG_TO_M_LAT = 111320;
const DEG_TO_M_LNG = 111320 * Math.cos(CENTER_LAT * Math.PI / 180);
const SCALE = 0.03; // scale down for Three.js units

function geoToLocal(lng, lat) {
  const x = (lng - CENTER_LNG) * DEG_TO_M_LNG * SCALE;
  const z = -(lat - CENTER_LAT) * DEG_TO_M_LAT * SCALE; // negative Z = north
  return [x, z];
}

// Traffic color mapping
function getTrafficColor(status) {
  switch (status) {
    case 'green': return new THREE.Color(0x22c55e);
    case 'yellow': return new THREE.Color(0xeab308);
    case 'red': return new THREE.Color(0xef4444);
    default: return new THREE.Color(0x64748b);
  }
}

// =========================================
// Road Segments
// =========================================
function RoadNetwork() {
  const { state } = useStore();
  const meshRef = useRef();
  const colorsRef = useRef();

  const { geometry, segmentIds, segmentCount } = useMemo(() => {
    if (!state.roads || !state.roads.features) return { geometry: null, segmentIds: [], segmentCount: 0 };

    const features = state.roads.features;
    const positions = [];
    const colors = [];
    const ids = [];

    features.forEach((feature) => {
      const coords = feature.geometry.coordinates;
      const segId = feature.properties.id;
      const lanes = feature.properties.lanes || 2;
      const width = lanes * 0.04;

      for (let i = 0; i < coords.length - 1; i++) {
        const [x1, z1] = geoToLocal(coords[i][0], coords[i][1]);
        const [x2, z2] = geoToLocal(coords[i + 1][0], coords[i + 1][1]);

        // Road direction and perpendicular
        const dx = x2 - x1;
        const dz = z2 - z1;
        const len = Math.sqrt(dx * dx + dz * dz);
        if (len < 0.001) return;

        const nx = -dz / len * width / 2;
        const nz = dx / len * width / 2;

        // Two triangles to form a road quad
        const y = 0.02; // slightly above ground

        // Triangle 1
        positions.push(x1 + nx, y, z1 + nz);
        positions.push(x1 - nx, y, z1 - nz);
        positions.push(x2 + nx, y, z2 + nz);

        // Triangle 2
        positions.push(x2 + nx, y, z2 + nz);
        positions.push(x1 - nx, y, z1 - nz);
        positions.push(x2 - nx, y, z2 - nz);

        // Initial colors (gray)
        for (let j = 0; j < 6; j++) {
          colors.push(0.4, 0.45, 0.55);
          ids.push(segId);
        }
      }
    });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    return { geometry: geo, segmentIds: ids, segmentCount: features.length };
  }, [state.roads]);

  // Update colors based on live traffic
  useFrame(() => {
    if (!geometry || !state.trafficData) return;

    const colorAttr = geometry.getAttribute('color');
    if (!colorAttr) return;

    const trafficData = state.trafficData;
    const colors = colorAttr.array;

    for (let i = 0; i < segmentIds.length; i++) {
      const segId = segmentIds[i];
      const traffic = trafficData[segId];
      if (traffic) {
        const color = getTrafficColor(traffic.status);
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
      }
    }

    colorAttr.needsUpdate = true;
  });

  if (!geometry) return null;

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshStandardMaterial
        vertexColors
        roughness={0.6}
        metalness={0.2}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// Building colors per theme
const BUILDING_COLORS = {
  dark: { commercial: '#1e3a5f', office: '#1a2744', residential: '#1e293b', retail: '#2d1b4e' },
  light: { commercial: '#b0c4de', office: '#a8b8cb', residential: '#c5d0dc', retail: '#b8b0cc' },
};

// =========================================
// Buildings
// =========================================
function Buildings({ theme = 'dark' }) {
  const { state } = useStore();
  const palette = BUILDING_COLORS[theme] || BUILDING_COLORS.dark;

  const buildingMeshes = useMemo(() => {
    if (!state.buildings || !state.buildings.features) return null;

    const meshes = [];
    const features = state.buildings.features;

    features.forEach((feature, idx) => {
      const coords = feature.geometry.coordinates[0];
      const height = (feature.properties.height || 15) * SCALE;
      const type = feature.properties.type;

      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      coords.forEach(([lng, lat]) => {
        const [x, z] = geoToLocal(lng, lat);
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minZ = Math.min(minZ, z);
        maxZ = Math.max(maxZ, z);
      });

      const cx = (minX + maxX) / 2;
      const cz = (minZ + maxZ) / 2;
      const w = Math.max(0.02, maxX - minX);
      const d = Math.max(0.02, maxZ - minZ);

      const color = palette[type] || palette.residential;

      meshes.push(
        <mesh key={idx} position={[cx, height / 2, cz]}>
          <boxGeometry args={[w, height, d]} />
          <meshStandardMaterial
            color={color}
            roughness={theme === 'light' ? 0.5 : 0.3}
            metalness={theme === 'light' ? 0.2 : 0.6}
            transparent
            opacity={theme === 'light' ? 0.92 : 0.85}
          />
        </mesh>
      );
    });

    return meshes;
  }, [state.buildings, palette, theme]);

  return <group>{buildingMeshes}</group>;
}

// =========================================
// Emergency Route Path
// =========================================
function EmergencyRoute() {
  const { state } = useStore();
  const lineRef = useRef();
  const glowRef = useRef();
  const timeRef = useRef(0);

  const points = useMemo(() => {
    if (!state.routeResult || !state.routeResult.coordinates) return null;

    return state.routeResult.coordinates.map(({ lat, lng }) => {
      const [x, z] = geoToLocal(lng, lat);
      return new THREE.Vector3(x, 0.08, z);
    });
  }, [state.routeResult]);

  // Animate the route path
  useFrame((_, delta) => {
    if (lineRef.current) {
      timeRef.current += delta;
      lineRef.current.material.dashOffset = -timeRef.current * 2;
    }
    if (glowRef.current) {
      const pulse = 0.5 + Math.sin(timeRef.current * 4) * 0.3;
      glowRef.current.material.opacity = pulse;
    }
  });

  if (!points || points.length < 2) return null;

  const curve = new THREE.CatmullRomCurve3(points);
  const tubePoints = curve.getPoints(100);

  return (
    <group>
      {/* Main route line */}
      <line ref={lineRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={tubePoints.length}
            array={new Float32Array(tubePoints.flatMap(p => [p.x, p.y, p.z]))}
            itemSize={3}
          />
        </bufferGeometry>
        <lineDashedMaterial
          color="#ef4444"
          linewidth={3}
          dashSize={0.15}
          gapSize={0.08}
        />
      </line>

      {/* Glow tube */}
      <mesh ref={glowRef}>
        <tubeGeometry args={[curve, 64, 0.03, 8, false]} />
        <meshBasicMaterial
          color="#ef4444"
          transparent
          opacity={0.3}
        />
      </mesh>

      {/* Origin marker */}
      <mesh position={points[0]}>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshBasicMaterial color="#22c55e" />
      </mesh>

      {/* Destination marker */}
      <mesh position={points[points.length - 1]}>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshBasicMaterial color="#ef4444" />
      </mesh>
    </group>
  );
}

// =========================================
// Ground Plane
// =========================================
function Ground({ theme = 'dark' }) {
  const color = theme === 'light' ? '#c8d6e5' : '#0d1117';
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
      <planeGeometry args={[50, 50]} />
      <meshStandardMaterial
        color={color}
        roughness={0.9}
        metalness={0.1}
      />
    </mesh>
  );
}

// =========================================
// Grid Helper
// =========================================
function CityGrid({ theme = 'dark' }) {
  const major = theme === 'light' ? '#b0bec5' : '#1a2332';
  const minor = theme === 'light' ? '#cfd8dc' : '#111827';
  return (
    <gridHelper
      args={[50, 100, major, minor]}
      position={[0, 0.001, 0]}
    />
  );
}

// =========================================
// Accident Markers
// =========================================
function AccidentMarkers() {
  const { state } = useStore();
  const markersRef = useRef([]);

  const markers = useMemo(() => {
    if (!state.events || !state.roads) return [];

    return state.events
      .filter(e => e.type === 'accident' || e.event_type === 'accident')
      .slice(0, 10)
      .map((event, idx) => {
        const segId = event.segment_id || event.payload?.segment_id;
        if (!segId || !state.roads.features) return null;

        const feature = state.roads.features.find(f => f.properties.id === segId);
        if (!feature) return null;

        const coords = feature.geometry.coordinates;
        const midIdx = Math.floor(coords.length / 2);
        const [x, z] = geoToLocal(coords[midIdx][0], coords[midIdx][1]);

        return { x, z, severity: event.severity || event.payload?.severity || 'moderate', key: idx };
      })
      .filter(Boolean);
  }, [state.events, state.roads]);

  return (
    <group>
      {markers.map((m) => (
        <group key={m.key} position={[m.x, 0.15, m.z]}>
          {/* Warning ring */}
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.06, 0.08, 32]} />
            <meshBasicMaterial color="#ef4444" transparent opacity={0.7} side={THREE.DoubleSide} />
          </mesh>
          {/* Pulsing sphere */}
          <mesh>
            <sphereGeometry args={[0.04, 16, 16]} />
            <meshBasicMaterial color={m.severity === 'critical' ? '#ef4444' : '#f97316'} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// =========================================
// Export Scene
// =========================================
export default function CityScene({ theme = 'dark' }) {
  return (
    <>
      <Ground theme={theme} />
      <CityGrid theme={theme} />
      <RoadNetwork />
      <Buildings theme={theme} />
      <EmergencyRoute />
      <AccidentMarkers />
    </>
  );
}
