import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Link } from 'react-router-dom';

export type NodeStatus = 
  | 'kernel'
  | 'active'
  | 'store-available'
  | 'missing-warning'
  | 'planned'
  | 'deprecated'
  | 'error';

export interface NodeRoute {
  name: string;
  path: string;
}

export type CustomNodeData = {
  label: string;
  status: NodeStatus;
  description?: string;
  concept?: string;
  mathModel?: string;
  errorMessage?: string;
  technicalId?: string;
  storePluginId?: string;
  version?: string;
  routes?: NodeRoute[];
};

export const CustomNode: React.FC<NodeProps<CustomNodeData>> = ({ data, selected }) => {
  const statusColors: Record<NodeStatus, string> = {
    kernel: 'bg-stone-900 border-stone-800 text-stone-50 shadow-stone-900/10',
    active: 'bg-emerald-50/95 border-emerald-200/90 text-emerald-950',
    'store-available': 'bg-stone-100/95 border-stone-300/90 text-stone-800',
    'missing-warning': 'bg-stone-200/95 border-amber-300/90 text-stone-900',
    planned: 'bg-sky-50 border-sky-200 text-sky-800',
    deprecated: 'bg-stone-50 border-stone-200 text-stone-500',
    error: 'bg-rose-50 border-rose-200 text-rose-800',
  };

  const statusDotColors: Record<NodeStatus, string> = {
    kernel: 'bg-stone-400 ring-2 ring-stone-600',
    active: 'bg-emerald-500 ring-2 ring-emerald-200',
    'store-available': 'bg-stone-400',
    'missing-warning': 'bg-amber-500 animate-pulse',
    planned: 'bg-sky-400',
    deprecated: 'bg-stone-400',
    error: 'bg-rose-500 animate-pulse',
  };

  const tooltipText = data.technicalId 
    ? `ID: ${data.technicalId}${data.version ? ` (v${data.version})` : ''}` 
    : data.label;

  return (
    <div 
      title={tooltipText}
      className={`
        w-[280px] h-[140px] p-4 rounded-2xl border backdrop-blur-md transition-all duration-200
        flex flex-col justify-between overflow-hidden cursor-pointer select-none
        ${statusColors[data.status]} 
        ${selected ? 'ring-2 ring-amber-400 shadow-xl scale-[1.03] z-50' : 'shadow-xs hover:shadow-md hover:scale-[1.01]'}
      `}
    >
      <Handle type="target" position={Position.Top} className="w-2.5 h-2.5 !bg-stone-400 !border-2 !border-white" />
      <Handle type="target" position={Position.Left} className="w-2.5 h-2.5 !bg-stone-400 !border-2 !border-white" />

      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-2.5 h-2.5 rounded-full ${statusDotColors[data.status]} shadow-xs flex-shrink-0`} />
          <span className="font-serif font-medium tracking-wide text-sm truncate">
            {data.label}
          </span>
        </div>

        {/* Badges */}
        {data.status === 'kernel' && (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-stone-800 text-stone-300 border border-stone-700 flex-shrink-0">
            Core
          </span>
        )}
        {data.status === 'active' && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex-shrink-0">
            Aktiv
          </span>
        )}
        {data.status === 'missing-warning' && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1 flex-shrink-0">
            ⚠️ Fehlt
          </span>
        )}
        {data.status === 'store-available' && (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-stone-200 text-stone-700 flex-shrink-0">
            Store
          </span>
        )}
      </div>

      {/* Kurze 2-zeilige Beschreibung */}
      <p className={`text-xs leading-relaxed line-clamp-2 my-auto ${data.status === 'kernel' ? 'text-stone-300' : 'text-stone-600'}`}>
        {data.description || 'Keine Beschreibung verfügbar.'}
      </p>

      {/* Footer / Metadaten-Leiste */}
      <div className="flex items-center justify-between pt-2 border-t border-stone-200/50 text-[10px]">
        {data.routes && data.routes.length > 0 ? (
          <span className="font-medium text-stone-500 flex items-center gap-1">
            <span>📍</span>
            <span>{data.routes.length} Route{data.routes.length > 1 ? 'n' : ''}</span>
          </span>
        ) : data.version ? (
          <span className="font-mono text-stone-400">v{data.version}</span>
        ) : (
          <span className="text-stone-400">Systemmodul</span>
        )}

        <span className={`font-medium ${data.status === 'kernel' ? 'text-stone-300' : 'text-stone-500'} flex items-center gap-0.5`}>
          <span>Details</span>
          <span>↗</span>
        </span>
      </div>

      <Handle type="source" position={Position.Bottom} className="w-2.5 h-2.5 !bg-stone-400 !border-2 !border-white" />
      <Handle type="source" position={Position.Right} className="w-2.5 h-2.5 !bg-stone-400 !border-2 !border-white" />
    </div>
  );
};
