'use client';

import { ConvexProvider, ConvexReactClient, useQuery } from 'convex/react';
import { anyApi } from 'convex/server';
import { useMemo, useState, useEffect } from 'react';

// --- Convex client (singleton) ---
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL ?? '';
const convex = CONVEX_URL ? new ConvexReactClient(CONVEX_URL) : null;

// Use anyApi to reference Convex functions without generated types
const api = anyApi;

// --- Event type icons + colors ---
const EVENT_STYLES: Record<string, { icon: string; color: string; bg: string }> = {
  task_started: { icon: '🚀', color: '#22d3ee', bg: 'rgba(34,211,238,0.1)' },
  task_completed: { icon: '✅', color: '#4ade80', bg: 'rgba(74,222,128,0.1)' },
  tool_used: { icon: '🔧', color: '#a78bfa', bg: 'rgba(167,139,250,0.1)' },
  call_made: { icon: '📞', color: '#fb923c', bg: 'rgba(251,146,60,0.1)' },
  workspace_completed: { icon: '🎉', color: '#facc15', bg: 'rgba(250,204,21,0.1)' },
};

const DEFAULT_STYLE = { icon: '📋', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' };

function getEventStyle(eventType: string) {
  return EVENT_STYLES[eventType] ?? DEFAULT_STYLE;
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ActivityEvent = { _id: string; agentName: string; eventType: string; detail: string; timestamp: number; [key: string]: any };

// --- Dashboard content (inside ConvexProvider) ---
function DashboardContent() {
  const [filter, setFilter] = useState<string>('all');
  const [, setTick] = useState(0);

  // Tick every 10s to update "time ago" labels
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(interval);
  }, []);

  // useQuery reactively subscribes — auto-updates on new events, no polling needed
  const events = useQuery(api.activity.listAll) as ActivityEvent[] | undefined;

  const filteredEvents = useMemo(() => {
    if (!events) return [];
    if (filter === 'all') return events;
    return events.filter((e) => e.eventType === filter);
  }, [events, filter]);

  const eventCounts = useMemo(() => {
    if (!events) return {};
    const counts: Record<string, number> = {};
    for (const e of events) {
      counts[e.eventType] = (counts[e.eventType] ?? 0) + 1;
    }
    return counts;
  }, [events]);

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a1a', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <header style={{ padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href="/" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: 14 }}>← Back to BossBot</a>
          <span style={{ color: '#334155' }}>|</span>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Activity Dashboard</h1>
          <span style={{
            fontSize: 10,
            background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
            padding: '2px 8px',
            borderRadius: 12,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            Powered by Convex
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: events !== undefined ? '#4ade80' : '#facc15',
            boxShadow: events !== undefined ? '0 0 8px rgba(74,222,128,0.5)' : '0 0 8px rgba(250,204,21,0.5)',
          }} />
          <span style={{ fontSize: 12, color: '#94a3b8' }}>
            {events !== undefined ? 'Live' : 'Connecting...'}
          </span>
        </div>
      </header>

      <div style={{ padding: '24px 32px', maxWidth: 960, margin: '0 auto' }}>
        {/* Stats cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
          {Object.entries(EVENT_STYLES).map(([type, style]) => (
            <button
              key={type}
              onClick={() => setFilter(filter === type ? 'all' : type)}
              style={{
                background: filter === type ? style.bg : 'rgba(255,255,255,0.03)',
                border: `1px solid ${filter === type ? style.color + '40' : 'rgba(255,255,255,0.06)'}`,
                borderRadius: 12,
                padding: '16px 16px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s',
                color: '#e2e8f0',
              }}
            >
              <div style={{ fontSize: 22, marginBottom: 4 }}>{style.icon}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: style.color }}>
                {eventCounts[type] ?? 0}
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'capitalize' }}>
                {type.replace(/_/g, ' ')}
              </div>
            </button>
          ))}
        </div>

        {/* Filter indicator */}
        {filter !== 'all' && (
          <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: '#94a3b8' }}>Filtering:</span>
            <span style={{
              fontSize: 12,
              background: getEventStyle(filter).bg,
              color: getEventStyle(filter).color,
              padding: '2px 10px',
              borderRadius: 8,
              border: `1px solid ${getEventStyle(filter).color}30`,
            }}>
              {getEventStyle(filter).icon} {filter.replace(/_/g, ' ')}
            </span>
            <button
              onClick={() => setFilter('all')}
              style={{ fontSize: 12, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
            >
              clear
            </button>
          </div>
        )}

        {/* Event feed */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {events === undefined && (
            <div style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
              <div>Connecting to Convex...</div>
            </div>
          )}

          {events !== undefined && filteredEvents.length === 0 && (
            <div style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
              <div>No activity events yet</div>
              <div style={{ fontSize: 13, marginTop: 8 }}>Events will appear here in real-time as agents work</div>
            </div>
          )}

          {filteredEvents.map((event) => {
            const style = getEventStyle(event.eventType);
            return (
              <div
                key={event._id}
                style={{
                  background: style.bg,
                  border: `1px solid ${style.color}15`,
                  borderRadius: 10,
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  animation: 'fadeIn 0.3s ease',
                }}
              >
                <span style={{ fontSize: 18, flexShrink: 0, marginTop: 2 }}>{style.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{ fontWeight: 600, fontSize: 14, color: style.color }}>
                      {event.agentName}
                    </span>
                    <span style={{ fontSize: 12, color: '#64748b', textTransform: 'capitalize' }}>
                      {event.eventType.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.4 }}>
                    {event.detail.length > 200 ? event.detail.slice(0, 200) + '...' : event.detail}
                  </div>
                </div>
                <span style={{ fontSize: 11, color: '#475569', flexShrink: 0, whiteSpace: 'nowrap' }}>
                  {timeAgo(event.timestamp)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Inline animation styles */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// --- Fallback when Convex is not configured ---
function NoDashboard() {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a1a', color: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
        <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Activity Dashboard</h1>
        <p style={{ color: '#94a3b8', lineHeight: 1.6, fontSize: 14 }}>
          Set <code style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 4 }}>NEXT_PUBLIC_CONVEX_URL</code> to enable the real-time activity dashboard powered by Convex.
        </p>
        <a href="/" style={{ color: '#8b5cf6', textDecoration: 'none', fontSize: 14, marginTop: 16, display: 'inline-block' }}>← Back to BossBot</a>
      </div>
    </div>
  );
}

// --- Page wrapper ---
export default function DashboardPage() {
  if (!convex) return <NoDashboard />;

  return (
    <ConvexProvider client={convex}>
      <DashboardContent />
    </ConvexProvider>
  );
}
