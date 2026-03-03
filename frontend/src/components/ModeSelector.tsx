import React from 'react';
import { AnalysisMode } from '../types';
import { Globe, Layers } from 'lucide-react';
import { TooltipIcon } from './TooltipIcon';

interface ModeSelectorProps {
  mode: AnalysisMode;
  onChange: (mode: AnalysisMode) => void;
  disabled?: boolean;
}

const GLOBAL_TOOLTIP = (
  <div className="space-y-1.5">
    <p className="font-semibold" style={{ color: 'oklch(0.82 0.19 195)' }}>Глобальный режим</p>
    <p>Все запросы из всех групп объединяются в единый граф знаний.</p>
    <p className="text-muted-foreground">Используйте, когда нужна общая картина связей между всеми терминами без разбивки по темам.</p>
  </div>
);

const INTENT_TOOLTIP = (
  <div className="space-y-1.5">
    <p className="font-semibold" style={{ color: 'oklch(0.78 0.19 75)' }}>Режим по намерениям</p>
    <p>Каждая группа запросов обрабатывается отдельно, создавая индивидуальный граф для каждого намерения.</p>
    <p>Дополнительно строится мета-граф, показывающий связи между кластерами намерений.</p>
    <p className="text-muted-foreground">Используйте, когда нужно сравнить тематические кластеры или изучить каждую группу отдельно.</p>
  </div>
);

export function ModeSelector({ mode, onChange, disabled }: ModeSelectorProps) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Режим анализа</p>
      <div className="grid grid-cols-2 gap-1.5">
        <div className="relative">
          <button
            disabled={disabled}
            onClick={() => onChange('global')}
            className={`
              w-full flex items-center justify-center gap-1.5 px-2 py-2 rounded text-xs font-mono transition-all duration-150
              ${mode === 'global'
                ? 'bg-kg-cyan/20 border border-kg-cyan/60 text-kg-cyan shadow-glow-cyan'
                : 'bg-kg-panel border border-kg-border text-muted-foreground hover:border-kg-cyan/30 hover:text-foreground'
              }
              disabled:opacity-40 disabled:cursor-not-allowed
            `}
            style={mode === 'global' ? { color: 'oklch(0.82 0.19 195)', borderColor: 'oklch(0.82 0.19 195 / 0.6)' } : {}}
          >
            <Globe className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">Global</span>
          </button>
          <div className="absolute top-0.5 right-0.5">
            <TooltipIcon content={GLOBAL_TOOLTIP} side="right" align="start" />
          </div>
        </div>
        <div className="relative">
          <button
            disabled={disabled}
            onClick={() => onChange('intent')}
            className={`
              w-full flex items-center justify-center gap-1.5 px-2 py-2 rounded text-xs font-mono transition-all duration-150
              ${mode === 'intent'
                ? 'bg-kg-amber/20 border border-kg-amber/60 text-kg-amber shadow-glow-amber'
                : 'bg-kg-panel border border-kg-border text-muted-foreground hover:border-kg-amber/30 hover:text-foreground'
              }
              disabled:opacity-40 disabled:cursor-not-allowed
            `}
            style={mode === 'intent' ? { color: 'oklch(0.78 0.19 75)', borderColor: 'oklch(0.78 0.19 75 / 0.6)' } : {}}
          >
            <Layers className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">Intent</span>
          </button>
          <div className="absolute top-0.5 right-0.5">
            <TooltipIcon content={INTENT_TOOLTIP} side="right" align="start" />
          </div>
        </div>
      </div>
    </div>
  );
}
