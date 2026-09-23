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
};

export const CustomNode: React.FC<NodeProps<CustomNodeData>> = ({ data, selected }) => {
  const statusColors: Record<NodeStatus, string> = {
    kernel: 'bg-stone-900 border-stone-800 text-stone-50 shadow-stone-900/10',
    active: 'bg-emerald-50/90 border-emerald-200/80 text-emerald-950',
    'store-available': 'bg-stone-100/90 border-stone-300/80 text-stone-800',
    'missing-warning': 'bg-stone-200/90 border-amber-300/80 text-stone-900',
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
        px-5 py-4 rounded-2xl border backdrop-blur-md transition-all duration-300
        min-w-[240px] max-w-[320px]
        ${statusColors[data.status]} 
        ${selected ? 'ring-2 ring-amber-400 shadow-xl scale-105 z-50' : 'shadow-sm hover:shadow-md'}
      `}
    >
      <Handle type="target" position={Position.Top} className="w-2.5 h-2.5 !bg-stone-400 !border-2 !border-white" />
      <Handle type="target" position={Position.Left} className="w-2.5 h-2.5 !bg-stone-400 !border-2 !border-white" />

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className={`w-2.5 h-2.5 rounded-full ${statusDotColors[data.status]} shadow-sm flex-shrink-0`} />
            <span className="font-serif font-medium tracking-wide text-sm truncate">
              {data.label}
            </span>
          </div>

          {/* Badges */}
          {data.status === 'kernel' && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-stone-800 text-stone-300 border border-stone-700">
              Core
            </span>
          )}
          {data.status === 'active' && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
              Aktiv
            </span>
          )}
          {data.status === 'missing-warning' && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
              ⚠️ Plugin fehlt
            </span>
          )}
          {data.status === 'store-available' && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-stone-200 text-stone-700">
              Im Store
            </span>
          )}
        </div>

        {/* Beschreibung / Actions */}
        {data.description && (
          <p className={`text-xs leading-relaxed line-clamp-2 ${data.status === 'kernel' ? 'text-stone-300' : 'text-stone-500'}`}>
            {data.description}
          </p>
        )}

        {/* Store Action Button für store-available */}
        {data.status === 'store-available' && (
          <div className="pt-1.5 border-t border-stone-200/60 mt-1">
            <Link
              to="/plugins"
              className="
                inline-flex items-center gap-1.5 text-xs font-semibold
                text-stone-900 bg-white hover:bg-stone-50
                px-3 py-1.5 rounded-lg border border-stone-300 shadow-sm
                transition-all active:scale-[0.98]
              "
              onClick={(e) => e.stopPropagation()}
            >
              <span>🛒</span>
              Aus dem Store installieren
            </Link>
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="w-2.5 h-2.5 !bg-stone-400 !border-2 !border-white" />
      <Handle type="source" position={Position.Right} className="w-2.5 h-2.5 !bg-stone-400 !border-2 !border-white" />
    </div>
  );
};
