import React, { useState } from 'react';
import { TaxonomyNode } from '../types';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TooltipIcon } from './TooltipIcon';

interface TaxonomyNodeViewProps {
  node: TaxonomyNode;
  depth: number;
}

const PANEL_TOOLTIP = (
  <div className="space-y-1.5">
    <p className="font-semibold" style={{ color: 'oklch(0.78 0.19 75)' }}>Таксономия</p>
    <p>Иерархическая классификация понятий, извлечённых из графа знаний.</p>
    <ul className="space-y-0.5 list-none">
      <li><span style={{ color: 'oklch(0.82 0.19 195)' }}>Корневые узлы</span> — термины с наивысшим TF-IDF (топ 20%), ключевые понятия</li>
      <li><span style={{ color: 'oklch(0.78 0.19 75)' }}>Дочерние узлы</span> — термины, связанные с родительским понятием</li>
      <li><span style={{ color: 'oklch(0.65 0.22 300)' }}>TF-IDF</span> — числовая значимость термина в корпусе запросов</li>
    </ul>
    <p className="text-muted-foreground">Нажмите на узел со стрелкой, чтобы развернуть или свернуть ветку иерархии.</p>
  </div>
);

const TFIDF_TOOLTIP = (
  <div className="space-y-1">
    <p className="font-semibold" style={{ color: 'oklch(0.78 0.19 75)' }}>TF-IDF</p>
    <p>Term Frequency–Inverse Document Frequency — мера важности термина. Высокое значение означает, что термин часто встречается в данной группе, но редко в других группах.</p>
  </div>
);

function TaxonomyNodeView({ node, depth }: TaxonomyNodeViewProps) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children.length > 0;

  if (node.id === 'root') {
    return (
      <div>
        {node.children.map(child => (
          <TaxonomyNodeView key={child.id} node={child} depth={0} />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div
        className={`
          flex items-center gap-1.5 py-1 px-2 rounded cursor-pointer
          hover:bg-kg-panel/60 transition-colors group
        `}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => hasChildren && setExpanded(e => !e)}
      >
        {hasChildren ? (
          expanded
            ? <ChevronDown className="w-3 h-3 text-muted-foreground flex-shrink-0" />
            : <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
        ) : (
          <span className="w-3 h-3 flex-shrink-0 flex items-center justify-center">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: depth === 0 ? 'oklch(0.82 0.19 195)' : 'oklch(0.78 0.19 75)' }}
            />
          </span>
        )}

        <span
          className="text-xs font-mono truncate flex-1"
          style={{
            color: depth === 0
              ? 'oklch(0.82 0.19 195)'
              : depth === 1
              ? 'oklch(0.78 0.19 75)'
              : 'oklch(0.85 0.01 240)',
          }}
        >
          {node.label}
        </span>

        <span className="text-xs text-muted-foreground/60 font-mono ml-2 flex-shrink-0">
          {node.tfidf.toFixed(4)}
        </span>

        {hasChildren && (
          <span className="text-xs text-muted-foreground/40 font-mono flex-shrink-0">
            {node.children.length}
          </span>
        )}
      </div>

      {expanded && hasChildren && (
        <div>
          {node.children.map(child => (
            <TaxonomyNodeView key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

interface TaxonomyPanelProps {
  taxonomy: TaxonomyNode | null;
}

export function TaxonomyPanel({ taxonomy }: TaxonomyPanelProps) {
  if (!taxonomy) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-xs font-mono">
        Нет таксономии. Загрузите файл и запустите анализ.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-1">
      <div className="flex items-center gap-1 px-2 pt-1 flex-shrink-0">
        <span className="text-xs font-mono text-muted-foreground/60">TF-IDF</span>
        <TooltipIcon content={TFIDF_TOOLTIP} side="top" align="start" />
      </div>
      <ScrollArea className="flex-1">
        <TaxonomyNodeView node={taxonomy} depth={0} />
      </ScrollArea>
    </div>
  );
}
