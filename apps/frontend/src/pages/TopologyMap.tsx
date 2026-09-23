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
import { initialNodes, initialEdges } from '../components/topology/initial-data';
import { getLayoutedElements } from '../components/topology/layout';

const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(initialNodes, initialEdges);

export const TopologyMap: React.FC = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);
  const [selectedNodeData, setSelectedNodeData] = useState<CustomNodeData | null>(null);

  const nodeTypes = useMemo(() => ({ custom: CustomNode }), []);

  useEffect(() => {
    const eventSource = new EventSource('/yeti/api/events');

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'PLUGIN_UPDATE') {
          setNodes((nds) => 
            nds.map((node) => {
              if (node.id === data.plugin) {
                let newStatus = node.data.status;
                let errorMsg = undefined;

                if (data.action === 'LOAD') newStatus = 'active';
                else if (data.action === 'UNLOAD') newStatus = 'deprecated'; // Grau für entladen
                else if (data.action === 'PLUGIN_ERROR') {
                  newStatus = 'error';
                  errorMsg = data.error;
                }

                return {
                  ...node,
                  data: {
                    ...node.data,
                    status: newStatus,
                    errorMessage: errorMsg
                  }
                };
              }
              return node;
            })
          );
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
  }, [setNodes]);

  const onNodeClick: NodeMouseHandler = useCallback((event, node) => {
    setSelectedNodeData(node.data as CustomNodeData);
    
    // Highlight connected edges
    setEdges((eds) => 
      eds.map((edge) => {
        if (edge.source === node.id || edge.target === node.id) {
          return { ...edge, style: { stroke: '#facc15', strokeWidth: 2 }, animated: true };
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
    <div className="relative w-full h-full bg-[#fcfbf9] rounded-3xl overflow-hidden border border-stone-200 shadow-sm flex flex-col">
      <div className="absolute top-6 left-8 z-10">
        <h2 className="text-2xl font-serif text-stone-900">System-Topologie</h2>
        <p className="text-stone-500 text-sm mt-1">Interaktive Architektur-Dokumentation</p>
      </div>

      <div className="w-full h-full relative">
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
