import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';

export type NodeStatus = 
  | 'kernel'
  | 'infrastructure'
  | 'active'
  | 'store-available'
  | 'component'
  | 'missing-warning'
  | 'planned'
  | 'deprecated'
  | 'error';

export type ComponentCategory = 'ui' | 'api' | 'data' | 'lifecycle';

export interface NodeRoute {
  name: string;
  path: string;
}

export interface CustomNodeData {
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
  
  // Plugin-Erweiterungsdaten
  isPlugin?: boolean;
  pluginId?: string;
  isExpanded?: boolean;
  onToggleExpand?: (pluginId: string) => void;
  componentCategory?: ComponentCategory;
  componentBadge?: string;
  parentPluginTitle?: string;
  componentItemsSummary?: string;
  icon?: string;
  isSelected?: boolean;
}

export const CustomNode: React.FC<NodeProps<CustomNodeData>> = ({ data, selected }) => {
  const isCurrentlySelected = Boolean(selected || data.isSelected);

  // Spezialansicht für aufgeklappte Komponenten-Knoten (UI, API, Data, Lifecycle)
  if (data.status === 'component') {
    const categoryConfigs: Record<ComponentCategory, { bg: string; border: string; text: string; badgeBg: string; icon: string; title: string }> = {
      ui: {
        bg: 'bg-indigo-50/95',
        border: 'border-indigo-300',
        text: 'text-indigo-950',
        badgeBg: 'bg-indigo-100 text-indigo-700 border-indigo-200',
        icon: '🖥️',
        title: 'UI & Interaktion',
      },
      api: {
        bg: 'bg-sky-50/95',
        border: 'border-sky-300',
        text: 'text-sky-950',
        badgeBg: 'bg-sky-100 text-sky-700 border-sky-200',
        icon: '⚡',
        title: 'REST-API & Routing',
      },
      data: {
        bg: 'bg-amber-50/95',
        border: 'border-amber-300',
        text: 'text-amber-950',
        badgeBg: 'bg-amber-100 text-amber-800 border-amber-200',
        icon: '💾',
        title: 'Datenmodell & Scope',
      },
      lifecycle: {
        bg: 'bg-emerald-50/95',
        border: 'border-emerald-300',
        text: 'text-emerald-950',
        badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        icon: '🔄',
        title: 'Events & Lifecycle',
      },
    };

    const category = data.componentCategory || 'ui';
    const config = categoryConfigs[category];

    return (
      <div
        title={`${data.label} (Komponente von ${data.parentPluginTitle || 'Plugin'})`}
        className={`
          relative w-[260px] h-[125px] p-3.5 rounded-2xl border backdrop-blur-md transition-all duration-200
          flex flex-col justify-between cursor-pointer select-none
          ${config.bg} ${config.border} ${config.text}
          ${isCurrentlySelected 
            ? 'ring-4 ring-indigo-500 ring-offset-2 ring-offset-white/80 shadow-[0_0_35px_rgba(99,102,241,0.5)] scale-[1.05] z-50' 
            : 'shadow-xs hover:shadow-md hover:scale-[1.01]'}
        `}
      >
        {isCurrentlySelected && (
          <div className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full bg-indigo-600 text-white font-mono text-[9px] font-bold shadow-md tracking-wider flex items-center gap-1 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
            <span>FOKUS</span>
          </div>
        )}

        <Handle type="target" position={Position.Top} className="w-2.5 h-2.5 !bg-stone-400 !border-2 !border-white" />
        <Handle type="target" position={Position.Left} className="w-2.5 h-2.5 !bg-stone-400 !border-2 !border-white" />

        {/* Header */}
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm">{config.icon}</span>
            <span className="font-serif font-semibold text-xs truncate">
              {data.label}
            </span>
          </div>
          <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full border ${config.badgeBg} flex-shrink-0 font-medium`}>
            {data.componentBadge || config.title}
          </span>
        </div>

        {/* Beschreibung */}
        <p className="text-[11px] leading-relaxed line-clamp-2 text-stone-600 my-auto">
          {data.description || 'Strukturierte Modulkomponente.'}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between pt-1.5 border-t border-stone-200/60 text-[10px]">
          <span className="text-stone-500 font-mono text-[9px] truncate max-w-[140px]">
            {data.componentItemsSummary || data.parentPluginTitle || 'Subkomponente'}
          </span>
          <span className="font-medium text-stone-600 hover:text-stone-900 flex items-center gap-0.5">
            <span>Aufbau</span>
            <span>↗</span>
          </span>
        </div>

        <Handle type="source" position={Position.Bottom} className="w-2.5 h-2.5 !bg-stone-400 !border-2 !border-white" />
        <Handle type="source" position={Position.Right} className="w-2.5 h-2.5 !bg-stone-400 !border-2 !border-white" />
      </div>
    );
  }

  // Standard-Knoten (Kernel, Infrastruktur, Aktive & Verfügbare Plugins)
  const statusColors: Record<NodeStatus, string> = {
    kernel: 'bg-stone-900 border-stone-800 text-stone-50 shadow-stone-900/10',
    infrastructure: 'bg-slate-900/90 border-slate-700/80 text-slate-50 shadow-slate-900/10',
    active: 'bg-emerald-50/95 border-emerald-300 text-emerald-950',
    'store-available': 'bg-stone-50/95 border-stone-300 text-stone-800 border-dashed',
    'missing-warning': 'bg-amber-50/95 border-amber-300 text-stone-900',
    component: 'bg-indigo-50 border-indigo-200 text-indigo-900',
    planned: 'bg-sky-50 border-sky-200 text-sky-800',
    deprecated: 'bg-stone-50 border-stone-200 text-stone-500',
    error: 'bg-rose-50 border-rose-200 text-rose-800',
  };

  const statusDotColors: Record<NodeStatus, string> = {
    kernel: 'bg-amber-400 ring-2 ring-amber-500/40 animate-pulse',
    infrastructure: 'bg-cyan-400 ring-2 ring-cyan-500/40',
    active: 'bg-emerald-500 ring-2 ring-emerald-200',
    'store-available': 'bg-stone-400',
    'missing-warning': 'bg-amber-500 animate-pulse',
    component: 'bg-indigo-500',
    planned: 'bg-sky-400',
    deprecated: 'bg-stone-400',
    error: 'bg-rose-500 animate-pulse',
  };

  const tooltipText = data.technicalId 
    ? `ID: ${data.technicalId}${data.version ? ` (v${data.version})` : ''}` 
    : data.label;

  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.onToggleExpand && (data.technicalId || data.pluginId)) {
      data.onToggleExpand((data.technicalId || data.pluginId)!);
    }
  };

  return (
    <div 
      title={tooltipText}
      className={`
        relative w-[280px] h-[145px] p-4 rounded-2xl border backdrop-blur-md transition-all duration-200
        flex flex-col justify-between cursor-pointer select-none
        ${statusColors[data.status]} 
        ${isCurrentlySelected 
          ? 'ring-4 ring-amber-400 ring-offset-2 ring-offset-stone-900/30 shadow-[0_0_40px_rgba(245,158,11,0.65)] scale-[1.05] z-50' 
          : 'shadow-xs hover:shadow-md hover:scale-[1.01]'}
      `}
    >
      {isCurrentlySelected && (
        <div className="absolute -top-3 right-3 px-2.5 py-0.5 rounded-full bg-amber-400 text-stone-950 font-mono text-[10px] font-extrabold shadow-lg tracking-wider flex items-center gap-1.5 animate-pulse z-50">
          <span className="w-1.5 h-1.5 rounded-full bg-stone-950"></span>
          <span>AKTIV</span>
        </div>
      )}

      <Handle type="target" position={Position.Top} className="w-2.5 h-2.5 !bg-stone-400 !border-2 !border-white" />
      <Handle type="target" position={Position.Left} className="w-2.5 h-2.5 !bg-stone-400 !border-2 !border-white" />

      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-2.5 h-2.5 rounded-full ${statusDotColors[data.status]} shadow-xs flex-shrink-0`} />
          <span className="font-serif font-medium tracking-wide text-sm truncate">
            {data.icon ? `${data.icon} ` : ''}{data.label}
          </span>
        </div>

        {/* Badges */}
        {data.status === 'kernel' && (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-stone-800 text-amber-300 border border-stone-700 flex-shrink-0">
            Core
          </span>
        )}
        {data.status === 'infrastructure' && (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-cyan-300 border border-slate-700 flex-shrink-0">
            Infrastruktur
          </span>
        )}
        {data.status === 'active' && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex-shrink-0">
            Aktiv
          </span>
        )}
        {data.status === 'store-available' && (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-stone-200 text-stone-700 flex-shrink-0">
            Store
          </span>
        )}
        {data.status === 'missing-warning' && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1 flex-shrink-0">
            ⚠️ Fehlt
          </span>
        )}
      </div>

      {/* Kurze 2-zeilige Beschreibung */}
      <p className={`text-xs leading-relaxed line-clamp-2 my-auto ${data.status === 'kernel' || data.status === 'infrastructure' ? 'text-stone-300' : 'text-stone-600'}`}>
        {data.description || 'Keine Beschreibung verfügbar.'}
      </p>

      {/* Interaktiver Aufbau-Aufklapp-Button für Plugins */}
      {data.isPlugin && (
        <div className="flex items-center justify-between pt-2 border-t border-stone-200/50">
          <button
            type="button"
            onClick={handleToggleClick}
            className={`
              inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium
              transition-all duration-150 active:scale-95
              ${data.isExpanded 
                ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 shadow-xs' 
                : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300'}
            `}
          >
            <span>{data.isExpanded ? '▲' : '🔍'}</span>
            <span>{data.isExpanded ? 'Aufbau einklappen' : 'Aufbau aufklappen'}</span>
            <span className="text-[9px] font-mono text-stone-500">
              {data.isExpanded ? '[-]' : '(4)'}
            </span>
          </button>

          <span className={`text-[10px] font-medium ${data.status === 'kernel' ? 'text-stone-300' : 'text-stone-500'} flex items-center gap-0.5`}>
            <span>Details</span>
            <span>↗</span>
          </span>
        </div>
      )}

      {/* Standard Footer falls kein Plugin */}
      {!data.isPlugin && (
        <div className="flex items-center justify-between pt-2 border-t border-stone-200/50 text-[10px]">
          {data.routes && data.routes.length > 0 ? (
            <span className="font-medium text-stone-500 flex items-center gap-1">
              <span>📍</span>
              <span>{data.routes.length} Route{data.routes.length > 1 ? 'n' : ''}</span>
            </span>
          ) : data.version ? (
            <span className="font-mono text-stone-400">v{data.version}</span>
          ) : (
            <span className={data.status === 'kernel' || data.status === 'infrastructure' ? 'text-stone-400' : 'text-stone-500'}>
              System-Service
            </span>
          )}

          <span className={`font-medium ${data.status === 'kernel' || data.status === 'infrastructure' ? 'text-stone-300' : 'text-stone-500'} flex items-center gap-0.5`}>
            <span>Details</span>
            <span>↗</span>
          </span>
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="w-2.5 h-2.5 !bg-stone-400 !border-2 !border-white" />
      <Handle type="source" position={Position.Right} className="w-2.5 h-2.5 !bg-stone-400 !border-2 !border-white" />
    </div>
  );
};
