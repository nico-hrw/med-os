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

  const allPluginNodes = clonedNodes.filter((n) => 
    n.id !== 'kernel-core' &&
    !infraNodes.includes(n) &&
    !componentNodes.includes(n) &&
    (n.data?.isPlugin || n.id.startsWith('plugin-') || n.id.startsWith('store-') || n.data?.status === 'active' || n.data?.status === 'store-available')
  );

  // Trennung in Aktive Plugins (Spalte 2) und Store-Plugins (Spalte 3)
  const activePluginNodes = allPluginNodes.filter((n) => n.data?.status === 'active');
  const storePluginNodes = allPluginNodes.filter((n) => n.data?.status !== 'active');

  activePluginNodes.sort((a, b) => a.data.label.localeCompare(b.data.label));
  storePluginNodes.sort((a, b) => a.data.label.localeCompare(b.data.label));

  const hasInfra = infraNodes.length > 0;
  const hasActive = activePluginNodes.length > 0;
  const hasStore = storePluginNodes.length > 0;

  // Ausgewogenes 3-Spalten-Layout: 
  // Spalte 1: Infrastruktur (links)
  // Spalte 2: Aktive Module + aufgeklappte Komponenten (mitte)
  // Spalte 3: Store-Erweiterungen (rechts)
  // Kern oben zentriert. Verhindert die endlose 1-Spalten-Liste komplett!
  let col1X = 40;
  let col2X = 390;
  let col3X = 860;
  let coreX = 430;

  if (!hasInfra && hasActive && !hasStore) {
    col2X = 220;
    coreX = 220;
  } else if (!hasInfra && hasActive && hasStore) {
    col2X = 140;
    col3X = 580;
    coreX = 360;
  } else if (hasInfra && hasActive && !hasStore) {
    col1X = 40;
    col2X = 390;
    coreX = 240;
  } else if (hasInfra && !hasActive && !hasStore) {
    col1X = 200;
    coreX = 200;
  }

  const startY = 230;

  // 1. Kernel Core positionieren
  if (kernelNode) {
    kernelNode.position = { x: coreX, y: 30 };
    kernelNode.targetPosition = Position.Top;
    kernelNode.sourcePosition = Position.Bottom;
  }

  // 2. Infrastruktur-Spalte (Spalte 1)
  let infraY = startY;
  infraNodes.forEach((node) => {
    node.position = { x: col1X, y: infraY };
    node.targetPosition = Position.Top;
    node.sourcePosition = Position.Bottom;
    infraY += 185; // 145px Höhe + 40px Abstand
  });

  const categoryOrder: ComponentCategory[] = ['ui', 'api', 'data', 'lifecycle'];

  // Helper zum Platzieren einer Plugin-Spalte samt Kind-Komponenten
  // Staggered & 2x2 Komponenten-Grid: weder zu breit noch starr einspaltig untereinander!
  const layoutPluginColumn = (columnNodes: Node<CustomNodeData>[], startColX: number) => {
    let curY = startY;

    columnNodes.forEach((pNode, index) => {
      const pluginId = pNode.data.technicalId || pNode.data.pluginId || pNode.id.replace(/^(plugin-|store-)/, '');

      // Leichter horizontaler Versatz zwischen aufeinanderfolgenden Plugins (staggered)
      // Verhindert eine starre 1-Spalten-Wand, ohne zu breit zu fächern
      const staggerOffsetX = index % 2 === 0 ? 0 : 40;
      const nodeX = startColX + staggerOffsetX;

      pNode.position = { x: nodeX, y: curY };
      pNode.targetPosition = Position.Top;
      pNode.sourcePosition = Position.Bottom;
      curY += 185;

      // Finde aufgeklappte Sub-Komponenten dieses Plugins
      const comps = componentNodes.filter((c) => 
        c.data.pluginId === pluginId || c.id.startsWith(`${pluginId}__comp_`)
      );

      if (comps.length > 0) {
        comps.sort((a, b) => {
          const catA = a.data.componentCategory ? categoryOrder.indexOf(a.data.componentCategory) : 0;
          const catB = b.data.componentCategory ? categoryOrder.indexOf(b.data.componentCategory) : 0;
          return catA - catB;
        });

        // Kompaktes 2x2 Grid statt 1x4 Endlosturm:
        // Spalte A (links): UI (Index 0), Data (Index 2)
        // Spalte B (rechts): API (Index 1), Lifecycle (Index 3)
        comps.forEach((cNode, compIdx) => {
          const isLeft = compIdx % 2 === 0;
          const row = Math.floor(compIdx / 2);

          const compX = isLeft ? nodeX - 45 : nodeX + 135;
          const compY = curY + (row * 145);

          cNode.position = { x: compX, y: compY };
          cNode.targetPosition = Position.Top;
          cNode.sourcePosition = Position.Bottom;
        });

        const rowCount = Math.ceil(comps.length / 2);
        curY += (rowCount * 145) + 30; // Visueller Puffer
      }
    });

    return curY;
  };

  // 3. Spalte 2: Aktive Plugins
  layoutPluginColumn(activePluginNodes, col2X);

  // 4. Spalte 3: Store-Erweiterungen
  layoutPluginColumn(storePluginNodes, col3X);

  // Fallback für sonstige Knoten
  const positionedIds = new Set([
    kernelNode?.id,
    ...infraNodes.map((n) => n.id),
    ...activePluginNodes.map((n) => n.id),
    ...storePluginNodes.map((n) => n.id),
    ...componentNodes.map((n) => n.id),
  ]);

  let fallbackY = startY;
  clonedNodes.forEach((node) => {
    if (!positionedIds.has(node.id)) {
      node.position = { x: col2X, y: fallbackY };
      node.targetPosition = Position.Top;
      node.sourcePosition = Position.Bottom;
      fallbackY += 180;
    }
  });

  return { nodes: clonedNodes, edges };
};
