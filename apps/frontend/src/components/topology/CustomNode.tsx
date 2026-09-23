import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';

export type NodeStatus = 'active' | 'planned' | 'deprecated' | 'error';

export type CustomNodeData = {
  label: string;
  status: NodeStatus;
  description: string;
  concept: string;
  mathModel?: string;
  errorMessage?: string;
};

export const CustomNode: React.FC<NodeProps<CustomNodeData>> = ({ data, selected }) => {
  const statusColors = {
    active: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    planned: 'bg-sky-50 border-sky-200 text-sky-800',
    deprecated: 'bg-stone-50 border-stone-200 text-stone-500',
    error: 'bg-rose-50 border-rose-200 text-rose-800',
  };

  const statusDotColors = {
    active: 'bg-emerald-400',
    planned: 'bg-sky-400',
    deprecated: 'bg-stone-400',
    error: 'bg-rose-500 animate-pulse',
  };

  return (
    <div className={`px-5 py-4 rounded-2xl border backdrop-blur-sm shadow-[0_4px_20px_rgb(0,0,0,0.03)] transition-all duration-300 ${statusColors[data.status]} ${selected ? 'ring-2 ring-yellow-400 shadow-[0_8px_30px_rgb(250,204,21,0.2)] scale-105 z-50' : 'shadow-sm'}`}>
      <Handle type="target" position={Position.Top} className="w-2 h-2 !bg-stone-300 !border-0" />
      <div className="flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full ${statusDotColors[data.status]} shadow-sm`} />
        <div className="font-serif font-medium tracking-wide flex items-center gap-2">
          {data.label}
          {data.status === 'error' && (
            <span title={data.errorMessage} className="text-rose-500 text-[10px] cursor-help">⚠️</span>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-2 h-2 !bg-stone-300 !border-0" />
    </div>
  );
};
