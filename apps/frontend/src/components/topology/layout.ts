import dagre from 'dagre';
import { Node, Edge, Position } from 'reactflow';

export const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const isHorizontal = direction === 'LR';

  // Angenehme Knoten- und Rangabstände für übersichtliche Baum- und Graphenstrukturen
  dagreGraph.setGraph({ 
    rankdir: direction, 
    nodesep: 65, 
    ranksep: 100,
    align: 'DL',
  });

  nodes.forEach((node) => {
    const isComponent = node.data?.status === 'component';
    const width = isComponent ? 260 : 280;
    const height = isComponent ? 125 : 145;

    dagreGraph.setNode(node.id, { width, height });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const isComponent = node.data?.status === 'component';
    const width = isComponent ? 260 : 280;
    const height = isComponent ? 125 : 145;

    node.targetPosition = isHorizontal ? Position.Left : Position.Top;
    node.sourcePosition = isHorizontal ? Position.Right : Position.Bottom;

    node.position = {
      x: nodeWithPosition.x - width / 2,
      y: nodeWithPosition.y - height / 2,
    };
  });

  return { nodes, edges };
};
