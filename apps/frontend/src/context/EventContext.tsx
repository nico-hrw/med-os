import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';

type EventCallback = (data: any) => void;

interface EventContextValue {
  connected: boolean;
  activeModules: number;
  subscribe: (callback: EventCallback) => () => void;
}

const EventContext = createContext<EventContextValue | null>(null);

const API_BASE = '/yeti/api';

export const EventProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [connected, setConnected] = useState(false);
  const [activeModules, setActiveModules] = useState(0);
  const subscribersRef = useRef<Set<EventCallback>>(new Set());

  // Registrierung für Event-Listener
  const subscribe = useCallback((callback: EventCallback) => {
    subscribersRef.current.add(callback);
    return () => {
      subscribersRef.current.delete(callback);
    };
  }, []);

  // Initialen Zähler für aktive Module laden
  useEffect(() => {
    fetch(`${API_BASE}/system/plugins/active`)
      .then(res => res.json())
      .then(json => {
        if (json.success && Array.isArray(json.data)) {
          setActiveModules(json.data.length);
        }
      })
      .catch((err) => {
        console.warn('Initialer Modul-Status konnte nicht geladen werden:', err);
      });
  }, []);

  // Einzige persistente SSE-Verbindung für die gesamte App-Lebensdauer
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let isDisposed = false;

    const connect = () => {
      if (isDisposed) return;
      eventSource = new EventSource(`${API_BASE}/events`);

      eventSource.onopen = () => {
        setConnected(true);
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'CONNECTED') {
            setConnected(true);
          } else if (data.type === 'PLUGIN_UPDATE' && typeof data.activeCount === 'number') {
            setActiveModules(data.activeCount);
          }

          // An alle registrierten Komponenten weiterleiten
          subscribersRef.current.forEach((cb) => {
            try {
              cb(data);
            } catch (err) {
              console.error('Fehler im Event-Subscriber:', err);
            }
          });
        } catch (err) {
          console.error('SSE JSON-Parse-Fehler:', err);
        }
      };

      eventSource.onerror = () => {
        setConnected(false);
      };
    };

    connect();

    return () => {
      isDisposed = true;
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);

  return (
    <EventContext.Provider value={{ connected, activeModules, subscribe }}>
      {children}
    </EventContext.Provider>
  );
};

export function useKernelEvents(callback?: EventCallback) {
  const ctx = useContext(EventContext);
  if (!ctx) {
    throw new Error('useKernelEvents muss innerhalb eines EventProviders verwendet werden.');
  }

  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!callback) return;
    const unsub = ctx.subscribe((data) => {
      if (callbackRef.current) {
        callbackRef.current(data);
      }
    });
    return unsub;
  }, [ctx, callback]);

  return ctx;
}
