import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  Edge, 
  Node, 
  NodeChange,
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
  const [nodes, setNodes, onNodesChange] = useNodesState<CustomNodeData>([]);
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
  const initialCenteredRef = useRef<boolean>(false);

  const nodeTypes = useMemo(() => ({ custom: CustomNode }), []);

  // Filtert versehentliche 'position' Änderungen heraus, damit Tastatur oder Dragging Knoten nie verschiebt
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const filtered = changes.filter((c) => c.type !== 'position');
      if (filtered.length > 0) {
        onNodesChange(filtered);
      }
    },
    [onNodesChange]
  );

  // Zentriert die Ansicht komfortabel auf einen Knoten – genau im sichtbaren Bereich neben dem Info-Panel!
  const centerOnNode = useCallback((
    nodeId: string, 
    customZoom = 0.95, 
    isPanelOpen?: boolean, 
    duration = 350
  ) => {
    if (!reactFlowInstanceRef.current) return;
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    const isComp = node.data?.status === 'component';
    const width = isComp ? 260 : 280;
    const height = isComp ? 125 : 145;

    const cx = node.position.x + width / 2;
    const cy = node.position.y + height / 2;

    // Auf Desktops (lg, >= 1024px) nimmt der Info-Slider rechts 30rem (480px) ein.
    // Um den Knoten genau im freien linken Bereich (zwischen Sidebar und Slider) zentriert anzuzeigen:
    // Verschieben wir den Fokuspunkt um 240px / zoom nach rechts, sodass der Knoten um 240px nach links rückt!
    const panelVisible = isPanelOpen !== undefined ? isPanelOpen : Boolean(selectedNodeData);
    const isLargeScreen = typeof window !== 'undefined' && window.innerWidth >= 1024;
    const offsetX = isLargeScreen && panelVisible ? (240 / customZoom) : 0;

    reactFlowInstanceRef.current.setCenter(cx + offsetX, cy, { zoom: customZoom, duration });
  }, [nodes, selectedNodeData]);

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

  // Dynamischer Graph-Builder mit schmaler, vertikaler Mehrspalten-Architektur
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
    // 2. KERN-INFRASTRUKTUR (Linke Spalte, vertikal nach unten)
    // ─────────────────────────────────────────────────────────────
    if (filter === 'all' || filter === 'infra' || filter === 'active') {
      // a) Zentrale Datenbank (Löst 'database-core' Dependency real & fehlerfrei auf)
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
        type: 'smoothstep',
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
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#3b82f6', strokeWidth: 1.8 },
      });

      rawEdges.push({
        id: 'edge-db-nginx',
        source: 'database-core',
        target: 'nginx-gateway',
        type: 'smoothstep',
        animated: false,
        style: { stroke: '#64748b', strokeWidth: 1.5, strokeDasharray: '3 3' },
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
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#8b5cf6', strokeWidth: 1.8 },
      });
    }

    const activeNames = new Set(active.map((p) => p.name));

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
            icon: plugin.icon || arch.icon || '🏥',
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
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#10b981', strokeWidth: 2.2 },
        });

        // Horizontale Verknüpfung zur Zentralen Datenbank (Prisma Layer)
        if (rawNodes.some((n) => n.id === 'database-core')) {
          rawEdges.push({
            id: `edge-${plugin.name}-db`,
            source: pluginNodeId,
            target: 'database-core',
            type: 'smoothstep',
            animated: false,
            style: { stroke: '#059669', strokeWidth: 1.5, strokeDasharray: '4 4' },
          });
        }

        // AUFGEKLAPPTER AUFBAU: 4 spezialisierte Komponenten-Knoten schmal nach unten gestapelt
        if (isExpanded) {
          const compConfigs: { cat: ComponentCategory; id: string; label: string; badge: string; desc: string; summary: string; stroke: string }[] = [
            {
              cat: 'ui',
              id: `${plugin.name}__comp_ui`,
              label: `${plugin.name} Screens`,
              badge: 'UI-Schicht',
              desc: arch.ui.summary,
              summary: `${arch.ui.components.length} View${arch.ui.components.length > 1 ? 's' : ''}`,
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
                parentPluginTitle: plugin.name,
                componentItemsSummary: comp.summary,
                pluginId: plugin.name,
              },
            });

            // Farbiger Ast vom Parent-Plugin zur Sub-Komponente
            rawEdges.push({
              id: `edge-comp-${plugin.name}-${comp.cat}`,
              source: pluginNodeId,
              target: comp.id,
              type: 'smoothstep',
              animated: true,
              style: { stroke: comp.stroke, strokeWidth: 2 },
            });
          });
        }
      });
    }

    // ─────────────────────────────────────────────────────────────
    // 4. VERFÜGBARE STORE-PLUGINS (Rechte Spalte, unter den aktiven)
    // ─────────────────────────────────────────────────────────────
    if (filter === 'all' || filter === 'clinical') {
      available.forEach((storePlugin) => {
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
          type: 'smoothstep',
          animated: false,
          style: { stroke: '#94a3b8', strokeWidth: 1.5, strokeDasharray: '4 4' },
        });

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
              type: 'smoothstep',
              animated: true,
              style: { stroke: comp.stroke, strokeWidth: 2 },
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

    // Deterministisches, ausgewogenes 3-Spalten-Layout (verhindert endlose vertikale Liste)
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(filteredNodes, filteredEdges, 'TB');
    
    // Aktive Selektion in den Layout-Knoten beibehalten
    const layoutedNodesWithSelection = layoutedNodes.map((n) => {
      const isMatch = selectedNodeData 
        ? (n.id === selectedNodeData.technicalId || n.data.technicalId === selectedNodeData.technicalId || n.data.label === selectedNodeData.label)
        : false;
      return {
        ...n,
        selected: isMatch,
        data: {
          ...n.data,
          isSelected: isMatch,
        },
      };
    });

    setNodes(layoutedNodesWithSelection);
    setEdges(layoutedEdges);
    setLoading(false);
  }, [togglePluginExpand, setNodes, setEdges, selectedNodeData]);

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

  // Zustand für Mehrfachauswahl bei Tastatur-Navigation
  const [candidates, setCandidates] = useState<{
    nodes: Node<CustomNodeData>[];
    currentIndex: number;
    direction: string;
  } | null>(null);

  // Wählt einen Knoten aus, hebt ihn unübersehbar hervor und zentriert die Ansicht
  const selectAndFocusNode = useCallback((
    node: Node<CustomNodeData>, 
    zoom = 0.95, 
    customCandidates?: { nodes: Node<CustomNodeData>[]; currentIndex: number; direction: string } | null
  ) => {
    setSelectedNodeData(node.data);

    // Synchronisiere ReactFlow node.selected und node.data.isSelected
    setNodes((prevNodes) =>
      prevNodes.map((n) => {
        const isMatch = n.id === node.id;
        if (n.selected === isMatch && n.data?.isSelected === isMatch) return n;
        return {
          ...n,
          selected: isMatch,
          data: {
            ...n.data,
            isSelected: isMatch,
          },
        };
      })
    );

    // Kanten-Hervorhebung
    setEdges((eds) =>
      eds.map((edge) => {
        if (edge.source === node.id || edge.target === node.id) {
          return { ...edge, style: { stroke: '#f59e0b', strokeWidth: 3 }, animated: true };
        }
        return { ...edge, style: { stroke: '#d6d3d1', strokeWidth: 1 }, animated: false };
      })
    );

    if (customCandidates !== undefined) {
      setCandidates(customCandidates);
    }

    centerOnNode(node.id, zoom, true, 350);
  }, [centerOnNode, setNodes, setEdges]);

  // Selektion zurücksetzen
  const clearSelection = useCallback(() => {
    setSelectedNodeData(null);
    setCandidates(null);
    setNodes((prevNodes) =>
      prevNodes.map((n) => {
        if (!n.selected && !n.data?.isSelected) return n;
        return {
          ...n,
          selected: false,
          data: { ...n.data, isSelected: false },
        };
      })
    );
    setEdges((eds) =>
      eds.map((edge) => ({ ...edge, style: { stroke: '#d6d3d1', strokeWidth: 1 }, animated: false }))
    );
  }, [setNodes, setEdges]);

  // Initiales Fokussieren: Startet direkt herangezoomt auf ein Kern-Modul
  useEffect(() => {
    if (!initialCenteredRef.current && nodes.length > 0 && reactFlowInstanceRef.current) {
      const target = nodes.find((n) => n.id === 'plugin-patient-onboarding') || nodes.find((n) => n.id === 'kernel-core') || nodes[0];
      if (target) {
        initialCenteredRef.current = true;
        selectAndFocusNode(target, 0.95, null);
      }
    }
  }, [nodes, selectAndFocusNode]);

  // ─────────────────────────────────────────────────────────────
  // PFEILTASTEN-NAVIGATION & MEHRFACHAUSWAHL (Point 3)
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' ', 'Escape'];
      if (!keys.includes(e.key)) return;

      e.preventDefault();
      e.stopPropagation();

      if (nodes.length === 0) return;

      if (e.key === 'Escape') {
        setCandidates(null);
        return;
      }

      // Ermittle den aktuellen Knoten
      let current = selectedNodeData 
        ? nodes.find((n) => n.data.technicalId === selectedNodeData.technicalId || n.id === selectedNodeData.technicalId || n.data.label === selectedNodeData.label)
        : null;

      if (!current) {
        const fallback = nodes.find((n) => n.id === 'plugin-patient-onboarding') || nodes[0];
        if (fallback) {
          selectAndFocusNode(fallback, 0.95, null);
        }
        return;
      }

      // Enter / Leertaste: Plugin-Aufbau aufklappen / einklappen oder Kandidaten bestätigen
      if (e.key === 'Enter' || e.key === ' ') {
        if (candidates) {
          setCandidates(null);
        }
        if (current.data.isPlugin && (current.data.technicalId || current.data.pluginId)) {
          togglePluginExpand((current.data.technicalId || current.data.pluginId)!);
        }
        return;
      }

      // Prüfe, ob aktuell bereits ein Kandidaten-Menü für dieselbe Pfeilrichtung aktiv ist
      // Wenn ja, schaltet erneutes Drücken der Pfeiltaste zyklisch durch die Treffer!
      if (candidates && candidates.direction === e.key && candidates.nodes.length > 1) {
        const nextIdx = (candidates.currentIndex + 1) % candidates.nodes.length;
        const nextCandidate = candidates.nodes[nextIdx];
        selectAndFocusNode(nextCandidate, 0.95, {
          ...candidates,
          currentIndex: nextIdx,
        });
        return;
      }

      // Spalten definieren anhand der X-Position
      // Col 1: Infrastruktur (< 200px)
      // Col 2: Aktive Plugins & Komponenten (200px - 550px)
      // Col 3: Store-Erweiterungen (>= 550px)
      const col1Nodes = nodes.filter((n) => n.id !== 'kernel-core' && n.position.x < 200);
      const col2Nodes = nodes.filter((n) => n.id !== 'kernel-core' && n.position.x >= 200 && n.position.x < 550);
      const col3Nodes = nodes.filter((n) => n.id !== 'kernel-core' && n.position.x >= 550);

      const isKernel = current.id === 'kernel-core' || current.data.status === 'kernel';

      // ─────────────────────────────────────────────────────────
      // Navigation vom Microkernel aus
      // ─────────────────────────────────────────────────────────
      if (isKernel) {
        if (e.key === 'ArrowDown') {
          // Springt in Spalte 2 (Aktive Plugins)
          const targets = col2Nodes.filter((n) => n.data.status === 'active').sort((a, b) => a.position.y - b.position.y);
          if (targets.length > 0) {
            selectAndFocusNode(targets[0], 0.95, targets.length > 1 ? { nodes: targets, currentIndex: 0, direction: 'ArrowDown' } : null);
          }
        } else if (e.key === 'ArrowLeft') {
          // Springt in Spalte 1 (Infrastruktur)
          const targets = col1Nodes.sort((a, b) => a.position.y - b.position.y);
          if (targets.length > 0) {
            selectAndFocusNode(targets[0], 0.95, targets.length > 1 ? { nodes: targets, currentIndex: 0, direction: 'ArrowLeft' } : null);
          }
        } else if (e.key === 'ArrowRight') {
          // Springt in Spalte 3 (Store-Erweiterungen)
          const targets = col3Nodes.filter((n) => n.data.status === 'store-available').sort((a, b) => a.position.y - b.position.y);
          if (targets.length > 0) {
            selectAndFocusNode(targets[0], 0.95, targets.length > 1 ? { nodes: targets, currentIndex: 0, direction: 'ArrowRight' } : null);
          }
        }
        return;
      }

      // ─────────────────────────────────────────────────────────
      // Navigation innerhalb der 3 Spalten
      // ─────────────────────────────────────────────────────────
      const currentX = current.position.x;
      const currentLane = currentX < 200 ? 1 : currentX < 550 ? 2 : 3;
      const currentLaneNodes = currentLane === 1 ? col1Nodes : currentLane === 2 ? col2Nodes : col3Nodes;

      if (e.key === 'ArrowUp') {
        // Befindet sich der Knoten ganz oben in seiner Spalte? -> Zurück zum Microkernel
        if (current.position.y <= 240) {
          const kernel = nodes.find((n) => n.id === 'kernel-core');
          if (kernel) {
            selectAndFocusNode(kernel, 0.95, null);
            return;
          }
        }

        // Suche vorherigen Knoten in derselben Spalte
        const aboveNodes = currentLaneNodes
          .filter((n) => n.position.y < current.position.y - 10)
          .sort((a, b) => b.position.y - a.position.y);

        if (aboveNodes.length > 0) {
          selectAndFocusNode(aboveNodes[0], 0.95, null);
        } else {
          // Fallback: Gehe zum Kernel
          const kernel = nodes.find((n) => n.id === 'kernel-core');
          if (kernel) selectAndFocusNode(kernel, 0.95, null);
        }
      } else if (e.key === 'ArrowDown') {
        // Nächster Knoten darunter in derselben Spalte (schließt alle Subkomponenten ein!)
        const belowNodes = currentLaneNodes
          .filter((n) => n.position.y > current.position.y + 10)
          .sort((a, b) => a.position.y - b.position.y);

        if (belowNodes.length > 0) {
          selectAndFocusNode(belowNodes[0], 0.95, null);
        }
      } else if (e.key === 'ArrowRight') {
        // Spaltenwechsel nach rechts: Lane 1 -> Lane 2 -> Lane 3
        const targetLaneNodes = currentLane === 1 ? col2Nodes : currentLane === 2 ? col3Nodes : [];
        if (targetLaneNodes.length > 0) {
          // Sortiere nach Y-Nähe
          const sorted = [...targetLaneNodes].sort((a, b) => {
            return Math.abs(a.position.y - current.position.y) - Math.abs(b.position.y - current.position.y);
          });
          // Biete die 2 bis 3 nächsten Knoten als Auswahlliste an
          const candidateList = sorted.slice(0, Math.min(3, sorted.length));
          selectAndFocusNode(
            candidateList[0], 
            0.95, 
            candidateList.length > 1 ? { nodes: candidateList, currentIndex: 0, direction: 'ArrowRight' } : null
          );
        }
      } else if (e.key === 'ArrowLeft') {
        // Spaltenwechsel nach links: Lane 3 -> Lane 2 -> Lane 1
        const targetLaneNodes = currentLane === 3 ? col2Nodes : currentLane === 2 ? col1Nodes : [];
        if (targetLaneNodes.length > 0) {
          const sorted = [...targetLaneNodes].sort((a, b) => {
            return Math.abs(a.position.y - current.position.y) - Math.abs(b.position.y - current.position.y);
          });
          const candidateList = sorted.slice(0, Math.min(3, sorted.length));
          selectAndFocusNode(
            candidateList[0], 
            0.95, 
            candidateList.length > 1 ? { nodes: candidateList, currentIndex: 0, direction: 'ArrowLeft' } : null
          );
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [nodes, selectedNodeData, candidates, selectAndFocusNode, togglePluginExpand]);

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
    selectAndFocusNode(node as Node<CustomNodeData>, 0.95, null);
  }, [selectAndFocusNode]);

  const onPaneClick = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  return (
    <div className="relative w-full h-full min-h-[650px] bg-[#fcfbf9] rounded-3xl overflow-hidden border border-stone-200 shadow-sm flex flex-col">
      {/* ─────────────────────────────────────────────────────────────
          1. SCHLANKER, AUFGERÄUMTER KOPFBEREICH (Point 1: Kein Clutter)
          ───────────────────────────────────────────────────────────── */}
      <div className="px-5 py-3 bg-white/80 backdrop-blur-md border-b border-stone-200/80 z-10 flex flex-wrap items-center justify-between gap-3">
        {/* Titel & Status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🏔️</span>
            <h2 className="text-lg font-serif font-bold text-stone-900 tracking-tight">Topologie</h2>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Live</span>
          </span>
        </div>

        {/* Ansichts-Filter */}
        <div className="flex items-center gap-1 bg-stone-100/90 p-1 rounded-xl border border-stone-200/60">
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              activeFilter === 'all' ? 'bg-white text-stone-900 shadow-xs font-semibold' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Alle ({nodes.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('clinical')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              activeFilter === 'clinical' ? 'bg-white text-stone-900 shadow-xs font-semibold' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Klinisch
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('active')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              activeFilter === 'active' ? 'bg-white text-stone-900 shadow-xs font-semibold' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Aktiv
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('infra')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              activeFilter === 'infra' ? 'bg-white text-stone-900 shadow-xs font-semibold' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Infrastruktur
          </button>
        </div>

        {/* Aktionen & Suche */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={expandAllPlugins}
            title="Alle Plugins aufklappen"
            className="p-1.5 px-2.5 rounded-xl text-xs font-medium bg-stone-100 hover:bg-stone-200 text-stone-700 transition-all flex items-center gap-1 active:scale-95"
          >
            <span>⊞</span>
            <span className="hidden sm:inline text-[11px]">Aufklappen</span>
          </button>
          <button
            type="button"
            onClick={collapseAllPlugins}
            title="Alle Plugins einklappen"
            className="p-1.5 px-2.5 rounded-xl text-xs font-medium bg-stone-100 hover:bg-stone-200 text-stone-700 transition-all flex items-center gap-1 active:scale-95"
          >
            <span>⊟</span>
            <span className="hidden sm:inline text-[11px]">Einklappen</span>
          </button>
          <button
            type="button"
            onClick={() => {
              const target = selectedNodeData
                ? (nodes.find((n) => n.data.technicalId === selectedNodeData.technicalId || n.id === selectedNodeData.technicalId) || nodes[0])
                : (nodes.find((n) => n.id === 'plugin-patient-onboarding') || nodes[0]);
              if (target) {
                selectAndFocusNode(target, 0.95, null);
              }
            }}
            title="Ansicht auf aktiven Knoten zentrieren"
            className="p-1.5 px-2.5 rounded-xl text-xs font-medium bg-stone-900 hover:bg-stone-800 text-white transition-all flex items-center gap-1 active:scale-95"
          >
            <span>⛶</span>
            <span className="hidden sm:inline text-[11px]">Zentrieren</span>
          </button>

          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Suchen..."
              className="w-32 sm:w-44 px-2.5 py-1 text-xs bg-stone-100/90 rounded-lg border border-stone-200 focus:bg-white focus:outline-none focus:border-stone-400 font-sans"
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
      </div>

      {loading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/50 backdrop-blur-sm">
          <div className="w-8 h-8 border-2 border-stone-300 border-t-stone-700 rounded-full animate-spin" />
        </div>
      )}

      {/* Haupt-Canvas */}
      <div className="flex-1 w-full relative overflow-hidden">
        <div className="w-full h-full relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={true}
            connectionLineType={ConnectionLineType.SmoothStep}
            onInit={(instance) => {
              reactFlowInstanceRef.current = instance;
            }}
            defaultViewport={{ x: 50, y: 30, zoom: 0.95 }}
            minZoom={0.3}
            maxZoom={1.5}
            className="bg-transparent"
          >
            <Background color="#e7e5e4" gap={24} size={1} />
            <Controls className="!bg-white !border-stone-200 !shadow-sm fill-stone-600 !rounded-xl overflow-hidden" showInteractive={false} />
          </ReactFlow>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            KANDIDATEN-AUSWAHL BEI MEHRFACH-TREFFERN (Point 3)
            ───────────────────────────────────────────────────────────── */}
        {candidates && candidates.nodes.length > 1 && (
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 bg-stone-900/95 text-white backdrop-blur-md px-4 py-2 rounded-2xl shadow-2xl flex items-center gap-3 border border-amber-500/40 text-xs">
            <span className="text-amber-400 font-mono font-bold text-[11px] whitespace-nowrap">
              Auswahl ({candidates.currentIndex + 1}/{candidates.nodes.length}):
            </span>
            <div className="flex items-center gap-1.5 overflow-x-auto max-w-[400px] py-0.5">
              {candidates.nodes.map((cand, idx) => (
                <button
                  key={cand.id}
                  type="button"
                  onClick={() => {
                    selectAndFocusNode(cand, 0.95, {
                      ...candidates,
                      currentIndex: idx,
                    });
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                    idx === candidates.currentIndex 
                      ? 'bg-amber-400 text-stone-950 font-bold shadow-md scale-105' 
                      : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                  }`}
                >
                  {cand.data.label}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-stone-400 hidden sm:inline pl-2 border-l border-stone-700 whitespace-nowrap">
              Pfeiltaste erneut drücken zum Weiterschalten
            </span>
          </div>
        )}
        
        {/* Detail-Panel auf der rechten Seite */}
        <InfoPanel 
          nodeData={selectedNodeData} 
          onClose={() => {
            const lastId = selectedNodeData?.technicalId || selectedNodeData?.pluginId;
            clearSelection();
            if (lastId && reactFlowInstanceRef.current) {
              const node = nodes.find((n) => n.data.technicalId === lastId || n.id === lastId);
              if (node) {
                centerOnNode(node.id, 0.95, false, 350);
              }
            }
          }}
          onToggleExpand={togglePluginExpand}
          isExpanded={selectedNodeData ? expandedPluginIds.has(selectedNodeData.technicalId || selectedNodeData.pluginId || '') : false}
        />
      </div>
    </div>
  );
};
