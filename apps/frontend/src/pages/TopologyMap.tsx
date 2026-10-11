import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  Edge, 
  Node, 
  ConnectionLineType,
  useNodesState,
  useEdgesState,
  NodeMouseHandler,
  ReactFlowInstance,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { CustomNode, CustomNodeData, ComponentCategory } from '../components/topology/CustomNode';
import { InfoPanel } from '../components/topology/InfoPanel';
import { getLayoutedElements } from '../components/topology/layout';
import { useKernelEvents } from '../context/EventContext';
import { getPluginArchitecture } from '../components/topology/plugin-architecture-definitions';

interface PluginRoute {
  name: string;
  path: string;
}

interface ActivePlugin {
  name: string;
  version: string;
  description?: string;
  author?: string;
  icon?: string;
  category?: string;
  dependencies?: { id: string; name: string }[];
  routes?: PluginRoute[];
}

interface AvailablePlugin {
  name: string;
  version: string;
  description?: string;
  author?: string;
  icon?: string;
  category?: string;
  dependencies?: { id: string; name: string }[];
  routes?: PluginRoute[];
  installed: boolean;
}

type FilterCategory = 'all' | 'clinical' | 'active' | 'infra';

const API_BASE = '/yeti/api';

export const TopologyMap: React.FC = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeData, setSelectedNodeData] = useState<CustomNodeData | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Zustand für aufgeklappte Plugins (welche Sub-Komponenten UI, API, Data, Lifecycle anzeigen)
  const [expandedPluginIds, setExpandedPluginIds] = useState<Set<string>>(new Set(['patient-onboarding']));
  
  // Ansichts-Filter & Suchbegriff
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Cache der Rohdaten
  const [activePluginsList, setActivePluginsList] = useState<ActivePlugin[]>([]);
  const [availablePluginsList, setAvailablePluginsList] = useState<AvailablePlugin[]>([]);

  const reactFlowInstanceRef = useRef<ReactFlowInstance | null>(null);

  const nodeTypes = useMemo(() => ({ custom: CustomNode }), []);

  // Handler zum Umschalten des Aufklapp-Status eines Plugins
  const togglePluginExpand = useCallback((pluginId: string) => {
    setExpandedPluginIds((prev) => {
      const next = new Set(prev);
      if (next.has(pluginId)) {
        next.delete(pluginId);
      } else {
        next.add(pluginId);
      }
      return next;
    });
  }, []);

  const expandAllPlugins = useCallback(() => {
    const allIds = new Set<string>();
    activePluginsList.forEach((p) => allIds.add(p.name));
    availablePluginsList.forEach((p) => allIds.add(p.name));
    setExpandedPluginIds(allIds);
  }, [activePluginsList, availablePluginsList]);

  const collapseAllPlugins = useCallback(() => {
    setExpandedPluginIds(new Set());
  }, []);

  // Dynamischer Graph-Builder
  const buildGraph = useCallback((
    active: ActivePlugin[], 
    available: AvailablePlugin[], 
    expanded: Set<string>,
    filter: FilterCategory,
    search: string
  ) => {
    const rawNodes: Node<CustomNodeData>[] = [];
    const rawEdges: Edge[] = [];

    const isMatch = (text: string) => {
      if (!search.trim()) return true;
      return text.toLowerCase().includes(search.toLowerCase());
    };

    // ─────────────────────────────────────────────────────────────
    // 1. ZENTRALER MICROKERNEL CORE
    // ─────────────────────────────────────────────────────────────
    if (filter === 'all' || filter === 'infra' || filter === 'active' || filter === 'clinical') {
      rawNodes.push({
        id: 'kernel-core',
        type: 'custom',
        position: { x: 0, y: 0 },
        data: {
          label: 'Microkernel Core',
          status: 'kernel',
          icon: '🏔️',
          description: 'Zentraler Event-Bus, Service-Registry und Sicherheits-Sandbox.',
          concept: 'Der Kernel isoliert Module über Proxies, friert Kontexte ein (Object.freeze) und garantiert dynamisches Hot-Swapping ohne Server-Neustart.',
          technicalId: 'medos-microkernel-core',
          version: '2.4.0',
        },
      });
    }

    // ─────────────────────────────────────────────────────────────
    // 2. KERN-INFRASTRUKTUR (Datenbank, Nginx Gateway, Terminals)
    // ─────────────────────────────────────────────────────────────
    if (filter === 'all' || filter === 'infra' || filter === 'active') {
      // a) Zentrale Datenbank (Löst die 'database-core' Dependency real & fehlerfrei auf!)
      rawNodes.push({
        id: 'database-core',
        type: 'custom',
        position: { x: 0, y: 0 },
        data: {
          label: 'Zentrale Datenbank (Prisma)',
          status: 'infrastructure',
          icon: '💾',
          description: 'Prisma ORM mit SQLite/PostgreSQL Engine. Scoped Data Partitioning pro Plugin.',
          concept: 'Sichert Tabellen und den PluginData Key-Value Store. Plugins greifen ausschließlich über den gehärteten PluginDBProxy isoliert auf eigene Namespaces zu.',
          technicalId: 'database-core',
          version: 'Prisma 6.4',
        },
      });

      rawEdges.push({
        id: 'edge-kernel-db',
        source: 'kernel-core',
        target: 'database-core',
        animated: true,
        style: { stroke: '#06b6d4', strokeWidth: 2 },
      });

      // b) Nginx Reverse Proxy & Gateway
      rawNodes.push({
        id: 'nginx-gateway',
        type: 'custom',
        position: { x: 0, y: 0 },
        data: {
          label: 'Nginx Gateway & Proxy',
          status: 'infrastructure',
          icon: '🌐',
          description: 'SSL/TLS 1.3, HTTP/2 Terminierung, SSE-Keep-Alive Streaming & Pfad-Multiplexing.',
          concept: 'Schützt interne Kernel-Ports, verhindert Socket-Exhaustion und leitet /yeti/ und /yeti/api/ Anfragen transparent weiter.',
          technicalId: 'nginx-gateway',
          version: '1.24 SSL',
        },
      });

      rawEdges.push({
        id: 'edge-kernel-nginx',
        source: 'kernel-core',
        target: 'nginx-gateway',
        animated: true,
        style: { stroke: '#3b82f6', strokeWidth: 1.8 },
      });

      // c) Klinische Terminals & Web-App
      rawNodes.push({
        id: 'frontend-spa',
        type: 'custom',
        position: { x: 0, y: 0 },
        data: {
          label: 'Klinische Terminals & SPA',
          status: 'infrastructure',
          icon: '🖥️',
          description: 'React 18 Single-Page-Applikation mit persistentem EventContext & Manchester-Triage Flow.',
          concept: 'Verbindet Empfangsterminals, Stations-PCs und mobile Notaufnahme-Pads reaktiv über eine persistente SSE-Pipeline.',
          technicalId: 'frontend-spa',
          version: 'React 18.3',
        },
      });

      rawEdges.push({
        id: 'edge-nginx-frontend',
        source: 'nginx-gateway',
        target: 'frontend-spa',
        animated: false,
        style: { stroke: '#8b5cf6', strokeWidth: 1.8 },
      });

      rawEdges.push({
        id: 'edge-frontend-kernel',
        source: 'frontend-spa',
        target: 'kernel-core',
        animated: true,
        style: { stroke: '#10b981', strokeWidth: 1.5, strokeDasharray: '3 3' },
      });
    }

    const activeNames = new Set(active.map((p) => p.name));
    const availableMap = new Map(available.map((p) => [p.name, p]));

    // ─────────────────────────────────────────────────────────────
    // 3. AKTIVE PLUGINS & DEREN AUFGEKLAPPTE KOMPONENTEN
    // ─────────────────────────────────────────────────────────────
    if (filter === 'all' || filter === 'clinical' || filter === 'active') {
      active.forEach((plugin) => {
        const pluginNodeId = `plugin-${plugin.name}`;
        const isExpanded = expanded.has(plugin.name);
        const arch = getPluginArchitecture(plugin.name, plugin.name, plugin.routes);

        rawNodes.push({
          id: pluginNodeId,
          type: 'custom',
          position: { x: 0, y: 0 },
          data: {
            label: plugin.name,
            icon: plugin.icon || arch.icon || '🧩',
            status: 'active',
            description: plugin.description || arch.tagline,
            technicalId: plugin.name,
            version: plugin.version,
            routes: plugin.routes,
            isPlugin: true,
            pluginId: plugin.name,
            isExpanded,
            onToggleExpand: togglePluginExpand,
            concept: plugin.category 
              ? `Kategorie: ${plugin.category} | Version: v${plugin.version}` 
              : `Version: v${plugin.version}`,
          },
        });

        // Kante vom Microkernel zum aktiven Plugin
        rawEdges.push({
          id: `edge-core-${plugin.name}`,
          source: 'kernel-core',
          target: pluginNodeId,
          animated: true,
          style: { stroke: '#10b981', strokeWidth: 2.2 },
        });

        // Abhängigkeit zur Zentralen Datenbank (Prisma Layer) auflösen
        rawEdges.push({
          id: `edge-${plugin.name}-db`,
          source: pluginNodeId,
          target: 'database-core',
          animated: false,
          style: { stroke: '#059669', strokeWidth: 1.5 },
        });

        // AUFGEKLAPPTER AUFBAU: 4 spezialisierte Komponenten-Knoten einblenden
        if (isExpanded) {
          const compConfigs: { cat: ComponentCategory; id: string; label: string; badge: string; desc: string; summary: string; stroke: string }[] = [
            {
              cat: 'ui',
              id: `${plugin.name}__comp_ui`,
              label: `${plugin.name} Screens`,
              badge: 'UI-Schicht',
              desc: arch.ui.summary,
              summary: `${arch.ui.components.length} Screen${arch.ui.components.length > 1 ? 's' : ''}`,
              stroke: '#6366f1',
            },
            {
              cat: 'api',
              id: `${plugin.name}__comp_api`,
              label: `${plugin.name} API`,
              badge: 'REST-Endpunkte',
              desc: arch.api.summary,
              summary: `${arch.api.endpoints.length} Route${arch.api.endpoints.length > 1 ? 'n' : ''}`,
              stroke: '#0284c7',
            },
            {
              cat: 'data',
              id: `${plugin.name}__comp_data`,
              label: `${plugin.name} Storage`,
              badge: 'Datenmodell',
              desc: arch.data.summary,
              summary: `${arch.data.schemas.length} Schemata`,
              stroke: '#d97706',
            },
            {
              cat: 'lifecycle',
              id: `${plugin.name}__comp_lifecycle`,
              label: `${plugin.name} Events`,
              badge: 'Lifecycle',
              desc: arch.lifecycle.summary,
              summary: `${arch.lifecycle.eventsProduced.length} SSE-Events`,
              stroke: '#059669',
            },
          ];

          compConfigs.forEach((comp) => {
            rawNodes.push({
              id: comp.id,
              type: 'custom',
              position: { x: 0, y: 0 },
              data: {
                label: comp.label,
                status: 'component',
                description: comp.desc,
                componentCategory: comp.cat,
                componentBadge: comp.badge,
                parentPluginTitle: plugin.name,
                componentItemsSummary: comp.summary,
                pluginId: plugin.name,
              },
            });

            // Farbige Kante vom Parent-Plugin zur Sub-Komponente
            rawEdges.push({
              id: `edge-comp-${plugin.name}-${comp.cat}`,
              source: pluginNodeId,
              target: comp.id,
              animated: true,
              style: { stroke: comp.stroke, strokeWidth: 1.8, strokeDasharray: '4 2' },
            });
          });
        }
      });
    }

    // ─────────────────────────────────────────────────────────────
    // 4. VERFÜGBARE STORE-PLUGINS (Uninstalled oder im Katalog)
    // ─────────────────────────────────────────────────────────────
    if (filter === 'all' || filter === 'clinical') {
      available.forEach((storePlugin) => {
        // Nur anzeigen, falls nicht ohnehin bereits als aktives Plugin geladen
        if (activeNames.has(storePlugin.name)) return;

        const storeNodeId = `store-${storePlugin.name}`;
        const isExpanded = expanded.has(storePlugin.name);
        const arch = getPluginArchitecture(storePlugin.name, storePlugin.name, storePlugin.routes);

        rawNodes.push({
          id: storeNodeId,
          type: 'custom',
          position: { x: 0, y: 0 },
          data: {
            label: storePlugin.name,
            icon: storePlugin.icon || arch.icon || '🛒',
            status: 'store-available',
            description: storePlugin.description || arch.tagline,
            technicalId: storePlugin.name,
            version: storePlugin.version,
            routes: storePlugin.routes,
            concept: `Verfügbare Erweiterung im Plugin-Store. Kategorie: ${storePlugin.category || 'Klinisch'}.`,
            storePluginId: storePlugin.name,
            isPlugin: true,
            pluginId: storePlugin.name,
            isExpanded,
            onToggleExpand: togglePluginExpand,
          },
        });

        // Gestrichelte Kante zum Kernel
        rawEdges.push({
          id: `edge-core-store-${storePlugin.name}`,
          source: 'kernel-core',
          target: storeNodeId,
          animated: false,
          style: { stroke: '#94a3b8', strokeWidth: 1.5, strokeDasharray: '4 4' },
        });

        // AUFGEKLAPPTER AUFBAU FÜR STORE-MODULE
        if (isExpanded) {
          const compConfigs: { cat: ComponentCategory; id: string; label: string; badge: string; desc: string; summary: string; stroke: string }[] = [
            {
              cat: 'ui',
              id: `${storePlugin.name}__comp_ui`,
              label: `${storePlugin.name} Screens`,
              badge: 'UI-Schicht',
              desc: arch.ui.summary,
              summary: `${arch.ui.components.length} Views`,
              stroke: '#6366f1',
            },
            {
              cat: 'api',
              id: `${storePlugin.name}__comp_api`,
              label: `${storePlugin.name} API`,
              badge: 'REST-Endpunkte',
              desc: arch.api.summary,
              summary: `${arch.api.endpoints.length} Endpunkte`,
              stroke: '#0284c7',
            },
            {
              cat: 'data',
              id: `${storePlugin.name}__comp_data`,
              label: `${storePlugin.name} Storage`,
              badge: 'Datenmodell',
              desc: arch.data.summary,
              summary: `${arch.data.schemas.length} Schemata`,
              stroke: '#d97706',
            },
            {
              cat: 'lifecycle',
              id: `${storePlugin.name}__comp_lifecycle`,
              label: `${storePlugin.name} Events`,
              badge: 'Lifecycle',
              desc: arch.lifecycle.summary,
              summary: `${arch.lifecycle.eventsProduced.length} Events`,
              stroke: '#059669',
            },
          ];

          compConfigs.forEach((comp) => {
            rawNodes.push({
              id: comp.id,
              type: 'custom',
              position: { x: 0, y: 0 },
              data: {
                label: comp.label,
                status: 'component',
                description: comp.desc,
                componentCategory: comp.cat,
                componentBadge: comp.badge,
                parentPluginTitle: storePlugin.name,
                componentItemsSummary: comp.summary,
                pluginId: storePlugin.name,
              },
            });

            rawEdges.push({
              id: `edge-comp-store-${storePlugin.name}-${comp.cat}`,
              source: storeNodeId,
              target: comp.id,
              animated: true,
              style: { stroke: comp.stroke, strokeWidth: 1.8, strokeDasharray: '4 2' },
            });
          });
        }
      });
    }

    // Filter nach Suchbegriff
    const filteredNodes = search.trim()
      ? rawNodes.filter((n) => isMatch(n.data.label) || isMatch(n.data.description || '') || isMatch(n.data.technicalId || ''))
      : rawNodes;

    const validNodeIds = new Set(filteredNodes.map((n) => n.id));
    const filteredEdges = rawEdges.filter((e) => validNodeIds.has(e.source) && validNodeIds.has(e.target));

    // Automatisches hierarchisches Layouting mit Dagre
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(filteredNodes, filteredEdges, 'TB');
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
    setLoading(false);
  }, [togglePluginExpand, setNodes, setEdges]);

  // Lädt aktive und im Store verfügbare Plugins
  const fetchTopologyData = useCallback(async () => {
    try {
      const [resActive, resAvailable] = await Promise.all([
        fetch(`${API_BASE}/system/plugins/active`),
        fetch(`${API_BASE}/system/plugins/available`),
      ]);

      const jsonActive = await resActive.json();
      const jsonAvailable = await resAvailable.json();

      const activeList: ActivePlugin[] = jsonActive.success ? jsonActive.data : [];
      const availableList: AvailablePlugin[] = jsonAvailable.success ? jsonAvailable.data : [];

      setActivePluginsList(activeList);
      setAvailablePluginsList(availableList);

      buildGraph(activeList, availableList, expandedPluginIds, activeFilter, searchTerm);
    } catch (err) {
      console.error('Fehler beim Laden der Topologie-Daten:', err);
      buildGraph([], [], expandedPluginIds, activeFilter, searchTerm);
    }
  }, [buildGraph, expandedPluginIds, activeFilter, searchTerm]);

  useEffect(() => {
    fetchTopologyData();
  }, [fetchTopologyData]);

  // Zentrieren des Graphen bei Panel-Öffnung oder Layout-Wechseln
  useEffect(() => {
    if (reactFlowInstanceRef.current) {
      const timer = setTimeout(() => {
        reactFlowInstanceRef.current?.fitView({ duration: 400, padding: 0.2 });
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [selectedNodeData, expandedPluginIds, activeFilter]);

  // Live-Synchronisation über zentralen SSE-Stream
  useKernelEvents(useCallback((data: any) => {
    if (data.type === 'PLUGIN_UPDATE') {
      if (
        data.action === 'LOAD' || 
        data.action === 'UNLOAD' || 
        data.action === 'INSTALL_COMPLETE' || 
        data.action === 'UNINSTALL_COMPLETE'
      ) {
        fetchTopologyData();
      }
    }
  }, [fetchTopologyData]));

  const onNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    setSelectedNodeData(node.data as CustomNodeData);
    
    // Highlight verbundener Kanten
    setEdges((eds) => 
      eds.map((edge) => {
        if (edge.source === node.id || edge.target === node.id) {
          return { ...edge, style: { stroke: '#f59e0b', strokeWidth: 2.8 }, animated: true };
        }
        return { ...edge, style: { stroke: '#d6d3d1', strokeWidth: 1 }, animated: false };
      })
    );
  }, [setEdges]);

  const onPaneClick = useCallback(() => {
    setSelectedNodeData(null);
    setEdges((eds) => 
      eds.map((edge) => ({ ...edge, style: { stroke: '#d6d3d1', strokeWidth: 1 }, animated: false }))
    );
  }, [setEdges]);

  return (
    <div className="relative w-full h-full min-h-[650px] bg-[#fcfbf9] rounded-3xl overflow-hidden border border-stone-200 shadow-sm flex flex-col">
      {/* Kopfbereich & Filter-Werkzeugleiste */}
      <div className="p-6 pb-4 bg-white/70 backdrop-blur-md border-b border-stone-200/70 z-10 flex flex-col gap-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-xl">🏔️</span>
              <h2 className="text-2xl font-serif text-stone-900 leading-tight">MedOS System-Topologie</h2>
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold border border-emerald-200">
                Live SSE aktiv
              </span>
            </div>
            <p className="text-stone-500 text-xs mt-1">
              Vollständige Visualisierung von Microkernel, Infrastruktur, Plugins und deren internem Architektur-Aufbau
            </p>
          </div>

          {/* Globale Aufklapp-Aktionen */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={expandAllPlugins}
              className="px-3 py-1.5 rounded-xl text-xs font-medium bg-stone-100 hover:bg-stone-200 text-stone-700 transition-all active:scale-95 flex items-center gap-1.5"
            >
              <span>⊞</span>
              <span>Alle Plugins aufklappen</span>
            </button>
            <button
              type="button"
              onClick={collapseAllPlugins}
              className="px-3 py-1.5 rounded-xl text-xs font-medium bg-stone-100 hover:bg-stone-200 text-stone-700 transition-all active:scale-95 flex items-center gap-1.5"
            >
              <span>⊟</span>
              <span>Alle einklappen</span>
            </button>
            <button
              type="button"
              onClick={() => reactFlowInstanceRef.current?.fitView({ duration: 500, padding: 0.2 })}
              className="px-3 py-1.5 rounded-xl text-xs font-medium bg-stone-900 hover:bg-stone-800 text-stone-50 transition-all active:scale-95 flex items-center gap-1.5"
            >
              <span>⛶</span>
              <span>Ansicht zentrieren</span>
            </button>
          </div>
        </div>

        {/* Filter-Kacheln & Live-Suche */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${activeFilter === 'all' ? 'bg-stone-900 text-stone-50' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
            >
              Alle Komponenten ({nodes.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('clinical')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${activeFilter === 'clinical' ? 'bg-emerald-700 text-white' : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'}`}
            >
              <span>🏥</span>
              <span>Klinische Module</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('active')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${activeFilter === 'active' ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
            >
              <span>⚡</span>
              <span>Nur Aktive</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('infra')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${activeFilter === 'infra' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              <span>💾</span>
              <span>Infrastruktur & Core</span>
            </button>
          </div>

          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Komponente suchen..."
              className="w-48 sm:w-60 px-3 py-1 text-xs bg-white rounded-lg border border-stone-200 focus:outline-none focus:border-stone-400 font-sans"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1 text-xs text-stone-400 hover:text-stone-600"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Legende */}
        <div className="flex flex-wrap items-center gap-4 text-[11px] text-stone-500 pt-1 border-t border-stone-100">
          <span className="font-semibold text-stone-700">Legende:</span>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-stone-900 border border-amber-400" />
            <span>Microkernel</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-slate-800 border border-cyan-400" />
            <span>Infrastruktur (DB, Gateway, Client)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Aktives Plugin</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-stone-400 border border-dashed border-stone-600" />
            <span>Verfügbares Store-Plugin</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded bg-indigo-500" />
            <span>UI-Schicht</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded bg-sky-500" />
            <span>REST-API</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded bg-amber-500" />
            <span>Datenmodell</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded bg-emerald-500" />
            <span>Lifecycle</span>
          </div>
        </div>
      </div>

      {loading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/50 backdrop-blur-sm">
          <div className="w-8 h-8 border-2 border-stone-300 border-t-stone-700 rounded-full animate-spin" />
        </div>
      )}

      {/* Haupt-Canvas */}
      <div className="flex-1 w-full relative overflow-hidden">
        <div 
          className={`
            w-full h-full transition-[margin-right] duration-500 ease-out
            ${selectedNodeData ? 'mr-0 lg:mr-[30rem]' : 'mr-0'}
          `}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            connectionLineType={ConnectionLineType.SmoothStep}
            onInit={(instance) => {
              reactFlowInstanceRef.current = instance;
            }}
            fitView
            className="bg-transparent"
          >
            <Background color="#e7e5e4" gap={24} size={1} />
            <Controls className="!bg-white !border-stone-200 !shadow-sm fill-stone-600 !rounded-xl overflow-hidden" showInteractive={false} />
          </ReactFlow>
        </div>
        
        {/* Detail-Panel auf der rechten Seite */}
        <InfoPanel 
          nodeData={selectedNodeData} 
          onClose={() => {
            setSelectedNodeData(null);
            setEdges((eds) => 
              eds.map((edge) => ({ ...edge, style: { stroke: '#d6d3d1', strokeWidth: 1 }, animated: false }))
            );
          }}
          onToggleExpand={togglePluginExpand}
          isExpanded={selectedNodeData ? expandedPluginIds.has(selectedNodeData.technicalId || selectedNodeData.pluginId || '') : false}
        />
      </div>
    </div>
  );
};
