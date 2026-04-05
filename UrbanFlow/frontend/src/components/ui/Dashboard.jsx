/**
 * Dashboard — Glassmorphism overlay UI with stats, controls, and event feed.
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useStore } from '../../store/Store';

// =========================================
// Theme Hook
// =========================================
function useTheme() {
  const [theme, setThemeState] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('uf-theme') || 'dark';
    }
    return 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('uf-theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    // Add transition class for smooth change
    document.documentElement.classList.add('theme-transitioning');
    setThemeState(prev => prev === 'dark' ? 'light' : 'dark');
    setTimeout(() => {
      document.documentElement.classList.remove('theme-transitioning');
    }, 500);
  }, []);

  return { theme, toggleTheme };
}

// =========================================
// Header Bar
// =========================================
function HeaderBar() {
  const { state } = useStore();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="header-bar" id="header-bar">
      <div className="brand">
        <div className="brand-logo">UF</div>
        <div className="brand-text">
          <h1>UrbanFlow</h1>
          <span>Smart Traffic Digital Twin</span>
        </div>
      </div>
      <div className="header-status">
        <div className="status-indicator">
          <div className={`status-dot ${state.connected ? 'live' : 'warning'}`} />
          {state.demoMode ? 'Demo Mode' : state.connected ? 'Live Stream' : 'Connecting...'}
        </div>
        <div className="status-indicator" style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
          T+{state.tick}
        </div>
        <button
          className="theme-toggle"
          id="theme-toggle"
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          aria-label="Toggle theme"
        >
          <span className="icon spin-in" key={theme}>
            {theme === 'dark' ? '☀️' : '🌙'}
          </span>
        </button>
      </div>
    </header>
  );
}

// =========================================
// Stats Panel (Left Side)
// =========================================
function StatsPanel() {
  const { state } = useStore();
  const { stats, trafficData } = state;
  const total = stats.total_segments || Object.keys(trafficData).length || 0;

  const greenPct = total ? ((stats.green / total) * 100).toFixed(0) : 0;
  const yellowPct = total ? ((stats.yellow / total) * 100).toFixed(0) : 0;
  const redPct = total ? ((stats.red / total) * 100).toFixed(0) : 0;

  return (
    <div className="stats-panel" id="stats-panel">
      <div className="glass-panel stat-card">
        <span className="stat-label">Total Segments</span>
        <span className="stat-value cyan">{total}</span>
        <span className="stat-sub">Active road segments</span>
      </div>

      <div className="glass-panel stat-card">
        <span className="stat-label">Avg. Density</span>
        <span className={`stat-value ${stats.avg_density > 0.6 ? 'red' : stats.avg_density > 0.35 ? 'yellow' : 'green'}`}>
          {(stats.avg_density * 100).toFixed(1)}%
        </span>
        <span className="stat-sub">Network load</span>
      </div>

      <div className="glass-panel stat-card">
        <span className="stat-label">Avg. Speed</span>
        <span className="stat-value purple">{stats.avg_speed_mph || 0}</span>
        <span className="stat-sub">mph across network</span>
      </div>

      <div className="glass-panel traffic-bar-container">
        <span className="stat-label" style={{ display: 'block', marginBottom: '8px' }}>Traffic Distribution</span>
        <div className="traffic-bar">
          <div className="bar-segment green" style={{ width: `${greenPct}%` }} />
          <div className="bar-segment yellow" style={{ width: `${yellowPct}%` }} />
          <div className="bar-segment red" style={{ width: `${redPct}%` }} />
        </div>
        <div className="traffic-bar-labels">
          <span>🟢 {greenPct}%</span>
          <span>🟡 {yellowPct}%</span>
          <span>🔴 {redPct}%</span>
        </div>
      </div>
    </div>
  );
}

// =========================================
// Control Panel (Right Side)
// =========================================
function ControlPanel() {
  const { state, requestRouteREST } = useStore();
  const [origin, setOrigin] = useState('n_0_0');
  const [destination, setDestination] = useState('n_8_12');

  // Generate node list for dropdowns
  const nodeOptions = useMemo(() => {
    const nodes = [];
    for (let r = 0; r <= 8; r++) {
      for (let c = 0; c <= 12; c++) {
        nodes.push(`n_${r}_${c}`);
      }
    }
    return nodes;
  }, []);

  const handleRoute = () => {
    if (origin && destination && origin !== destination) {
      requestRouteREST(origin, destination);
    }
  };

  return (
    <div className="control-panel" id="control-panel">
      <div className="glass-panel">
        <div className="panel-title">🚨 Emergency Router</div>
        <div className="route-controls">
          <div className="route-select">
            <label htmlFor="origin-select">Origin Node</label>
            <select
              id="origin-select"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
            >
              {nodeOptions.map(n => (
                <option key={n} value={n}>{n.replace(/_/g, ' ').toUpperCase()}</option>
              ))}
            </select>
          </div>
          <div className="route-select">
            <label htmlFor="dest-select">Destination Node</label>
            <select
              id="dest-select"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            >
              {nodeOptions.map(n => (
                <option key={n} value={n}>{n.replace(/_/g, ' ').toUpperCase()}</option>
              ))}
            </select>
          </div>
          <button
            className="btn-emergency"
            id="btn-dispatch"
            onClick={handleRoute}
            disabled={state.routeLoading || origin === destination}
          >
            {state.routeLoading ? '⏳ Computing...' : '🚑 Dispatch Emergency Route'}
          </button>
        </div>
      </div>

      {state.routeResult && (
        <div className="glass-panel route-result">
          <h4>📍 Route Calculated</h4>
          <div className="route-stat">
            <span>Path Length</span>
            <span>{state.routeResult.path?.length || 0} nodes</span>
          </div>
          <div className="route-stat">
            <span>Total Cost</span>
            <span>{state.routeResult.total_cost?.toFixed(0) || 'N/A'} ft</span>
          </div>
          <div className="route-stat">
            <span>Est. Time</span>
            <span>{state.routeResult.estimated_time_minutes || 'N/A'} min</span>
          </div>
          <div className="route-stat">
            <span>Nodes Explored</span>
            <span>{state.routeResult.nodes_visited || 'N/A'}</span>
          </div>
        </div>
      )}

      <div className="glass-panel">
        <div className="panel-title">📡 Live Events</div>
        <EventFeed />
      </div>
    </div>
  );
}

// =========================================
// Event Feed
// =========================================
function EventFeed() {
  const { state } = useStore();

  const displayEvents = state.events.slice(0, 15);

  return (
    <div className="event-feed" id="event-feed">
      {displayEvents.length === 0 && (
        <div style={{ color: 'var(--text-muted)', fontSize: '12px', padding: '8px 0' }}>
          Waiting for events...
        </div>
      )}
      {displayEvents.map((event, idx) => {
        const isAccident = event.type === 'accident' || event.event_type === 'accident';
        const severity = event.severity || event.payload?.severity || 'unknown';
        const segId = event.segment_id || event.payload?.segment_id || 'N/A';

        return (
          <div key={idx} className="event-item">
            <div className={`event-icon ${isAccident ? 'accident' : 'route'}`}>
              {isAccident ? '⚠️' : '🛣️'}
            </div>
            <div className="event-details">
              <div className="event-title">
                {isAccident ? 'Accident Detected' : 'Route Event'}
                {' '}
                <span className={`severity-badge ${severity}`}>{severity}</span>
              </div>
              <div className="event-meta">{segId}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// =========================================
// Bottom Bar
// =========================================
function BottomBar() {
  const { state } = useStore();
  const { predictions } = state;
  const predictionEntries = Object.entries(predictions).slice(0, 3);

  return (
    <div className="bottom-bar" id="bottom-bar">
      <div className="glass-panel mini-stat">
        <div className="mini-icon cyan">🧠</div>
        <div className="mini-info">
          <span className="mini-value" style={{ color: 'var(--accent-cyan)' }}>LSTM</span>
          <span className="mini-label">Traffic AI</span>
        </div>
      </div>

      <div className="glass-panel mini-stat">
        <div className="mini-icon purple">🌐</div>
        <div className="mini-info">
          <span className="mini-value" style={{ color: 'var(--accent-purple)' }}>Dijkstra</span>
          <span className="mini-label">Route Engine</span>
        </div>
      </div>

      {predictionEntries.map(([segId, pred]) => (
        <div key={segId} className="glass-panel mini-stat">
          <div className="mini-icon green">📊</div>
          <div className="mini-info">
            <span className="mini-value" style={{ color: pred > 0.6 ? 'var(--accent-red)' : pred > 0.35 ? 'var(--accent-yellow)' : 'var(--accent-green)' }}>
              {(pred * 100).toFixed(0)}%
            </span>
            <span className="mini-label">{segId} (predicted)</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// =========================================
// Loading Screen
// =========================================
export function LoadingScreen() {
  return (
    <div className="loading-screen" id="loading-screen">
      <div className="loading-spinner" />
      <div className="loading-text">
        <h2>UrbanFlow</h2>
        <p>Initializing Smart Traffic Digital Twin...</p>
      </div>
    </div>
  );
}

// =========================================
// Export Dashboard
// =========================================
export default function Dashboard() {
  return (
    <>
      <HeaderBar />
      <StatsPanel />
      <ControlPanel />
      <BottomBar />
    </>
  );
}
