import React from 'react';
import { KnowledgeGraph } from '../types';
import { Network, GitBranch } from 'lucide-react';
import { TooltipIcon } from './TooltipIcon';

interface GraphSelectorProps {
  intentGraphs: KnowledgeGraph[];
  selectedIndex: number | 'meta';
  onChange: (index: number | 'meta') => void;
}

const GRAPH_SELECTOR_TOOLTIP = (
  <div className="space-y-1.5">
    <p className="font-semibold" style={{ color: 'oklch(0.65 0.22 300)' }}>Выбор графа</p>
    <p><span style={{ color: 'oklch(0.65 0.22 300)' }}>Мета-граф</span> — показывает высокоуровневые связи между кластерами намерений. Полезен для понимания тематической структуры всего набора запросов.</p>
    <p><span style={{ color: 'oklch(0.78 0.19 75)' }}>Граф намерения N</span> — детальный граф знаний для конкретной группы запросов. Позволяет углублённо изучить отдельную тему.</p>
    <p className="text-muted-foreground">Переключайтесь между графами для сравнения тематических кластеров.</p>
  </div>
);

export function GraphSelector({ intentGraphs, selectedIndex, onChange }: GraphSelectorProps) {
  if (intentGraphs.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1">
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Граф намерения</p>
        <TooltipIcon content={GRAPH_SELECTOR_TOOLTIP} side="right" align="start" />
      </div>
      <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
        <button
          onClick={() => onChange('meta')}
          className={`
            w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs font-mono transition-all duration-150 text-left
            ${selectedIndex === 'meta'
              ? 'bg-kg-purple/20 border border-kg-purple/60'
              : 'bg-kg-panel border border-kg-border text-muted-foreground hover:border-kg-purple/30'
            }
          `}
          style={selectedIndex === 'meta' ? { color: 'oklch(0.65 0.22 300)', borderColor: 'oklch(0.65 0.22 300 / 0.6)' } : {}}
        >
          <Network className="w-3 h-3 flex-shrink-0" />
          Мета-граф
        </button>
        {intentGraphs.map((g, i) => (
          <button
            key={i}
            onClick={() => onChange(i)}
            className={`
              w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs font-mono transition-all duration-150 text-left
              ${selectedIndex === i
                ? 'bg-kg-amber/20 border border-kg-amber/60'
                : 'bg-kg-panel border border-kg-border text-muted-foreground hover:border-kg-amber/30'
              }
            `}
            style={selectedIndex === i ? { color: 'oklch(0.78 0.19 75)', borderColor: 'oklch(0.78 0.19 75 / 0.6)' } : {}}
          >
            <GitBranch className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">Намерение {i + 1}</span>
            <span className="ml-auto text-muted-foreground/60">{g.nodes.length}у</span>
          </button>
        ))}
      </div>
    </div>
  );
}
