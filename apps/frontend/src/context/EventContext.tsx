import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';

type EventCallback = (data: any) => void;

interface EventContextValue {
  connected: boolean;
  activeModules: number;
  activePlugins: string[];
  isPluginActive: (name: string) => boolean;
  refreshActivePlugins: () => Promise<void>;
  subscribe: (callback: EventCallback) => () => void;
}

const EventContext = createContext<EventContextValue | null>(null);

const API_BASE = '/yeti/api';

export const EventProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [connected, setConnected] = useState(false);
  const [activeModules, setActiveModules] = useState(0);
  const [activePlugins, setActivePlugins] = useState<string[]>([]);
  const subscribersRef = useRef<Set<EventCallback>>(new Set());

  // Registrierung für Event-Listener
  const subscribe = useCallback((callback: EventCallback) => {
    subscribersRef.current.add(callback);
    return () => {
      subscribersRef.current.delete(callback);
    };
  }, []);

  const refreshActivePlugins = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/system/plugins/active`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const names = json.data.map((p: any) => p.name);
        setActivePlugins(names);
        setActiveModules(names.length);
      }
    } catch (err) {
      console.warn('Aktive Plugins konnten nicht geladen werden:', err);
    }
  }, []);

  // Initialer Modul-Status
  useEffect(() => {
    refreshActivePlugins();
  }, [refreshActivePlugins]);

  const isPluginActive = useCallback((name: string) => {
    return activePlugins.includes(name);
  }, [activePlugins]);

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
          } else if (data.type === 'PLUGIN_UPDATE') {
            if (typeof data.activeCount === 'number') {
              setActiveModules(data.activeCount);
            }
            refreshActivePlugins();
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
          // Heartbeat ping oder non-JSON ignoriert
        }
      };

      eventSource.onerror = () => {
        setConnected(false);
      };
    };

    connect();

    const handleBeforeUnload = () => {
      if (eventSource) {
        eventSource.close();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      isDisposed = true;
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [refreshActivePlugins]);

  return (
    <EventContext.Provider value={{ connected, activeModules, activePlugins, isPluginActive, refreshActivePlugins, subscribe }}>
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
