import { Node, Edge, Position } from 'reactflow';
import { CustomNodeData, ComponentCategory } from './CustomNode';

export const getLayoutedElements = (
  nodes: Node<CustomNodeData>[],
  edges: Edge[],
  _direction = 'TB'
) => {
  const clonedNodes = nodes.map((node) => ({ ...node }));

  // Klassifizierung der Knoten
  const kernelNode = clonedNodes.find((n) => n.id === 'kernel-core' || n.data?.status === 'kernel');
  
  const infraNodes = clonedNodes.filter((n) => 
    n.id !== 'kernel-core' && (n.data?.status === 'infrastructure' || ['database-core', 'nginx-gateway', 'frontend-spa'].includes(n.id))
  );

  // Feste Reihenfolge der Infrastruktur
  const infraOrder = ['database-core', 'nginx-gateway', 'frontend-spa'];
  infraNodes.sort((a, b) => {
    const idxA = infraOrder.indexOf(a.id);
    const idxB = infraOrder.indexOf(b.id);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.data.label.localeCompare(b.data.label);
  });

  const componentNodes = clonedNodes.filter((n) => n.data?.status === 'component');

  const pluginNodes = clonedNodes.filter((n) => 
    n.id !== 'kernel-core' &&
    !infraNodes.includes(n) &&
    !componentNodes.includes(n) &&
    (n.data?.isPlugin || n.id.startsWith('plugin-') || n.id.startsWith('store-') || n.data?.status === 'active' || n.data?.status === 'store-available')
  );

  // Aktive Plugins vor Store-Plugins
  pluginNodes.sort((a, b) => {
    if (a.data?.status === 'active' && b.data?.status !== 'active') return -1;
    if (a.data?.status !== 'active' && b.data?.status === 'active') return 1;
    return a.data.label.localeCompare(b.data.label);
  });

  const hasInfra = infraNodes.length > 0;
  const hasPlugins = pluginNodes.length > 0;

  // Schmale Spalten-Geometrie: Verhindert horizontales Ausufern vollständig!
  // Gesamte Graphbreite bleibt ca. 680px, sodass bei Zoom 0.9 - 1.0 alles perfekt lesbar ist.
  let col1X = 40;  // Infrastruktur-Spalte links
  let col2X = 390; // Plugin-Spalte rechts
  let coreX = 215; // Kernel zentriert über beiden Spalten

  if (hasPlugins && !hasInfra) {
    col2X = 200;
    coreX = 200;
  } else if (hasInfra && !hasPlugins) {
    col1X = 200;
    coreX = 200;
  }

  const startY = 240;

  // 1. Kernel Core positionieren
  if (kernelNode) {
    kernelNode.position = { x: coreX, y: 30 };
    kernelNode.targetPosition = Position.Top;
    kernelNode.sourcePosition = Position.Bottom;
  }

  // 2. Infrastruktur-Spalte vertikal nach unten anordnen
  let infraY = startY;
  infraNodes.forEach((node) => {
    node.position = { x: col1X, y: infraY };
    node.targetPosition = Position.Top;
    node.sourcePosition = Position.Bottom;
    infraY += 195; // 145px Knotenhöhe + 50px Abstand
  });

  // 3. Plugin-Spalte vertikal nach unten anordnen samt aufgeklappten Komponenten
  const categoryOrder: ComponentCategory[] = ['ui', 'api', 'data', 'lifecycle'];
  let pluginY = startY;

  pluginNodes.forEach((pNode) => {
    const pluginId = pNode.data.technicalId || pNode.data.pluginId || pNode.id.replace(/^(plugin-|store-)/, '');
    
    pNode.position = { x: col2X, y: pluginY };
    pNode.targetPosition = Position.Top;
    pNode.sourcePosition = Position.Bottom;
    pluginY += 195;

    // Finde Sub-Komponenten dieses Plugins
    const comps = componentNodes.filter((c) => 
      c.data.pluginId === pluginId || c.id.startsWith(`${pluginId}__comp_`)
    );

    if (comps.length > 0) {
      comps.sort((a, b) => {
        const catA = a.data.componentCategory ? categoryOrder.indexOf(a.data.componentCategory) : 0;
        const catB = b.data.componentCategory ? categoryOrder.indexOf(b.data.componentCategory) : 0;
        return catA - catB;
      });

      comps.forEach((cNode) => {
        // Leicht eingerückt (20px), sodass die Ast-Verbindung vom Plugin visuell sauber wirkt
        cNode.position = { x: col2X + 20, y: pluginY };
        cNode.targetPosition = Position.Left;
        cNode.sourcePosition = Position.Bottom;
        pluginY += 155; // 125px Knotenhöhe + 30px Abstand
      });

      pluginY += 15; // Zusätzlicher Puffer vor dem nächsten Plugin
    }
  });

  // Fallback für sonstige Knoten
  const positionedIds = new Set([
    kernelNode?.id,
    ...infraNodes.map((n) => n.id),
    ...pluginNodes.map((n) => n.id),
    ...componentNodes.map((n) => n.id),
  ]);

  clonedNodes.forEach((node) => {
    if (!positionedIds.has(node.id)) {
      node.position = { x: col2X, y: pluginY };
      node.targetPosition = Position.Top;
      node.sourcePosition = Position.Bottom;
      pluginY += 180;
    }
  });

  return { nodes: clonedNodes, edges };
};
