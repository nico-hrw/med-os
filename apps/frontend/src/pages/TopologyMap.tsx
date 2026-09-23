import React, { useState, useCallback, useMemo, useEffect } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  Edge, 
  Node, 
  ConnectionLineType,
  useNodesState,
  useEdgesState,
  NodeMouseHandler
} from 'reactflow';
import 'reactflow/dist/style.css';

import { CustomNode, CustomNodeData } from '../components/topology/CustomNode';
import { InfoPanel } from '../components/topology/InfoPanel';
import { getLayoutedElements } from '../components/topology/layout';

interface ActivePlugin {
  name: string;
  version: string;
  description?: string;
  author?: string;
  icon?: string;
  category?: string;
  dependencies?: { id: string; name: string }[];
}

interface AvailablePlugin {
  name: string;
  version: string;
  description?: string;
  author?: string;
  icon?: string;
  category?: string;
  dependencies?: { id: string; name: string }[];
  installed: boolean;
}

const API_BASE = '/yeti/api';

export const TopologyMap: React.FC = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeData, setSelectedNodeData] = useState<CustomNodeData | null>(null);
  const [loading, setLoading] = useState(true);

  const nodeTypes = useMemo(() => ({ custom: CustomNode }), []);

  // Erzeugt das dynamische Topologie-Graph-Modell
  const buildGraph = useCallback((active: ActivePlugin[], available: AvailablePlugin[]) => {
    const rawNodes: Node<CustomNodeData>[] = [];
    const rawEdges: Edge[] = [];

    // 1. Statischer Microkernel Core Knoten (im Zentrum)
    rawNodes.push({
      id: 'kernel-core',
      type: 'custom',
      position: { x: 0, y: 0 },
      data: {
        label: 'Microkernel Core',
        status: 'kernel',
        description: 'Zentraler Event-Bus, Service-Registry und Sicherheits-Sandbox.',
        concept: 'Der Kernel isoliert Module über Proxies, friert Kontexte ein (Object.freeze) und garantiert dynamisches Hot-Swapping ohne Server-Neustart.',
        technicalId: 'medos-microkernel-core',
      },
    });

    const activeNames = new Set(active.map(p => p.name));
    const availableMap = new Map(available.map(p => [p.name, p]));
    const registeredDependencyNodes = new Set<string>();

    // 2. Aktive Plugins als grüne Knoten
    active.forEach(plugin => {
      const pluginNodeId = `plugin-${plugin.name}`;
      
      rawNodes.push({
        id: pluginNodeId,
        type: 'custom',
        position: { x: 0, y: 0 },
        data: {
          label: `${plugin.icon ? plugin.icon + ' ' : ''}${plugin.name}`,
          status: 'active',
          description: plugin.description || 'Aktives Systemmodul.',
          technicalId: plugin.name,
          version: plugin.version,
          concept: plugin.category 
            ? `Kategorie: ${plugin.category} | Version: v${plugin.version}` 
            : `Version: v${plugin.version}`,
        },
      });

      // Direkte Kante vom Microkernel zum aktiven Plugin
      rawEdges.push({
        id: `edge-core-${plugin.name}`,
        source: 'kernel-core',
        target: pluginNodeId,
        animated: true,
        style: { stroke: '#10b981', strokeWidth: 2 },
      });

      // 3. Dependencies des Plugins auflösen
      if (plugin.dependencies && Array.isArray(plugin.dependencies)) {
        plugin.dependencies.forEach(dep => {
          const isDepActive = activeNames.has(dep.id);

          if (isDepActive) {
            // Dependency ist bereits aktiv -> Kante zwischen den beiden Modulen
            rawEdges.push({
              id: `edge-${plugin.name}-${dep.id}`,
              source: pluginNodeId,
              target: `plugin-${dep.id}`,
              animated: false,
              style: { stroke: '#059669', strokeWidth: 1.5 },
            });
          } else {
            // Dependency ist NICHT aktiv
            const depNodeId = `dep-${dep.id}`;

            if (!registeredDependencyNodes.has(depNodeId)) {
              registeredDependencyNodes.add(depNodeId);
              const storePlugin = availableMap.get(dep.id);

              if (storePlugin) {
                // a) Im Store gefunden -> Hellgrauer Knoten mit Store-Metadaten & Direktlink
                rawNodes.push({
                  id: depNodeId,
                  type: 'custom',
                  position: { x: 0, y: 0 },
                  data: {
                    label: `${storePlugin.icon ? storePlugin.icon + ' ' : ''}${storePlugin.name}`,
                    status: 'store-available',
                    description: storePlugin.description || 'Im Plugin-Store verfügbar.',
                    technicalId: dep.id,
                    version: storePlugin.version,
                    concept: `Verfügbare Erweiterung im Store. Wird benötigt von '${plugin.name}'.`,
                    storePluginId: dep.id,
                  },
                });
              } else {
                // b) Nicht im Store gefunden -> Dunkelgrauer Warn-Knoten
                rawNodes.push({
                  id: depNodeId,
                  type: 'custom',
                  position: { x: 0, y: 0 },
                  data: {
                    label: dep.name || dep.id,
                    status: 'missing-warning',
                    description: `Abhängigkeit '${dep.id}' ist weder geladen noch im Store vorhanden.`,
                    technicalId: dep.id,
                    errorMessage: `Fehlt im System: ${dep.id}`,
                    concept: `Kritische Abhängigkeit für '${plugin.name}'. Das Modul benötigt diese Komponente für den vollständigen Betrieb.`,
                  },
                });
              }
            }

            // Kante vom aktiven Plugin zur fehlenden Abhängigkeit
            rawEdges.push({
              id: `edge-${plugin.name}-${dep.id}`,
              source: pluginNodeId,
              target: depNodeId,
              animated: true,
              style: { stroke: '#f59e0b', strokeWidth: 1.5, strokeDasharray: '4 4' },
            });
          }
        });
      }
    });

    // Automatisches Layouting mit Dagre
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(rawNodes, rawEdges, 'TB');
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
    setLoading(false);
  }, [setNodes, setEdges]);

  // Lädt beide Listen (active & available) parallel
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

      buildGraph(activeList, availableList);
    } catch (err) {
      console.error('Fehler beim Laden der Topologie-Daten:', err);
      // Fallback: Nur Microkernel anzeigen
      buildGraph([], []);
    }
  }, [buildGraph]);

  useEffect(() => {
    fetchTopologyData();
  }, [fetchTopologyData]);

  // Live-Synchronisation über SSE
  useEffect(() => {
    const eventSource = new EventSource(`${API_BASE}/events`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'PLUGIN_UPDATE') {
          // Re-fetch Topologie bei Modulwechseln
          if (
            data.action === 'LOAD' || 
            data.action === 'UNLOAD' || 
            data.action === 'INSTALL_COMPLETE' || 
            data.action === 'UNINSTALL_COMPLETE'
          ) {
            fetchTopologyData();
          }
        }
      } catch (err) {
        console.error('Fehler beim Parsen der SSE-Nachricht in Topology:', err);
      }
    };

    eventSource.onerror = () => {
      console.warn('Topology SSE Verbindungsabbruch. Native Browser-API versucht Reconnect...');
    };

    return () => {
      eventSource.close();
    };
  }, [fetchTopologyData]);

  const onNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    setSelectedNodeData(node.data as CustomNodeData);
    
    // Highlight connected edges
    setEdges((eds) => 
      eds.map((edge) => {
        if (edge.source === node.id || edge.target === node.id) {
          return { ...edge, style: { stroke: '#facc15', strokeWidth: 2.5 }, animated: true };
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
    <div className="relative w-full h-full min-h-[600px] bg-[#fcfbf9] rounded-3xl overflow-hidden border border-stone-200 shadow-sm flex flex-col">
      <div className="absolute top-6 left-8 z-10 pointer-events-none">
        <h2 className="text-2xl font-serif text-stone-900">System-Topologie</h2>
        <p className="text-stone-500 text-sm mt-1">
          Echtzeit-Visualisierung von Microkernel, Plugins und Abhängigkeiten
        </p>
      </div>

      {loading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/50 backdrop-blur-sm">
          <div className="w-8 h-8 border-2 border-stone-300 border-t-stone-700 rounded-full animate-spin" />
        </div>
      )}

      <div className="w-full h-full min-h-[500px] relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          connectionLineType={ConnectionLineType.SmoothStep}
          fitView
          className="bg-transparent"
        >
          <Background color="#e7e5e4" gap={24} size={1} />
          <Controls className="!bg-white !border-stone-200 !shadow-sm fill-stone-600 !rounded-xl overflow-hidden" showInteractive={false} />
        </ReactFlow>
        
        <InfoPanel 
          nodeData={selectedNodeData} 
          onClose={() => {
            setSelectedNodeData(null);
            setEdges((eds) => 
              eds.map((edge) => ({ ...edge, style: { stroke: '#d6d3d1', strokeWidth: 1 }, animated: false }))
            );
          }} 
        />
      </div>
    </div>
  );
};
