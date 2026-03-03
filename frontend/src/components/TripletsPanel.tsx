import React, { useState, useMemo } from 'react';
import { Triplet, RelationType } from '../types';
import { ArrowUpDown } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TooltipIcon } from './TooltipIcon';

interface TripletsPanelProps {
  triplets: Triplet[];
}

const RELATION_COLORS: Record<RelationType, string> = {
  'association': 'oklch(0.82 0.19 195)',
  'co-occurrence': 'oklch(0.65 0.22 300)',
  'hierarchical': 'oklch(0.78 0.19 75)',
  'functional': 'oklch(0.72 0.2 145)',
};

const RELATION_LABELS: Record<RelationType, string> = {
  'association': 'ассоциация',
  'co-occurrence': 'совместная встречаемость',
  'hierarchical': 'иерархическая',
  'functional': 'функциональная',
};

const RELATION_TOOLTIPS: Record<RelationType, React.ReactNode> = {
  'association': (
    <div className="space-y-1">
      <p className="font-semibold" style={{ color: 'oklch(0.82 0.19 195)' }}>Ассоциация</p>
      <p>Высокая совместная встречаемость терминов и схожие значения TF-IDF. Указывает на тематическую близость — термины относятся к одной предметной области.</p>
    </div>
  ),
  'co-occurrence': (
    <div className="space-y-1">
      <p className="font-semibold" style={{ color: 'oklch(0.65 0.22 300)' }}>Совместная встречаемость</p>
      <p>Термины часто появляются вместе в пределах одного контекстного окна (4 слова). Статистическая связь без явной семантики.</p>
    </div>
  ),
  'hierarchical': (
    <div className="space-y-1">
      <p className="font-semibold" style={{ color: 'oklch(0.78 0.19 75)' }}>Иерархическая</p>
      <p>Один термин является подтипом, категорией или обобщением другого. Отражает отношение «является частью» или «является видом».</p>
    </div>
  ),
  'functional': (
    <div className="space-y-1">
      <p className="font-semibold" style={{ color: 'oklch(0.72 0.2 145)' }}>Функциональная</p>
      <p>Один термин модифицирует, уточняет или функционально дополняет другой. Отражает отношение «используется для» или «влияет на».</p>
    </div>
  ),
};

const PANEL_TOOLTIP = (
  <div className="space-y-1.5">
    <p className="font-semibold" style={{ color: 'oklch(0.82 0.19 195)' }}>Триплеты</p>
    <p>Семантические тройки вида «Субъект → Предикат → Объект», извлечённые из графа знаний.</p>
    <ul className="space-y-0.5 list-none">
      <li><span style={{ color: 'oklch(0.82 0.19 195)' }}>Субъект</span> — исходная сущность</li>
      <li><span style={{ color: 'oklch(0.78 0.19 75)' }}>Предикат</span> — тип связи между сущностями</li>
      <li><span style={{ color: 'oklch(0.65 0.22 300)' }}>Объект</span> — целевая сущность</li>
      <li><span style={{ color: 'oklch(0.72 0.2 145)' }}>Вес</span> — значимость связи (0–1)</li>
    </ul>
    <p className="text-muted-foreground">Используйте фильтры по типу связи и сортировку по весу для анализа наиболее значимых отношений.</p>
  </div>
);

const FILTER_TOOLTIP = (
  <div className="space-y-1">
    <p className="font-semibold" style={{ color: 'oklch(0.82 0.19 195)' }}>Фильтр по типу связи</p>
    <p>Отображает только триплеты с выбранным типом предиката. «Все» — показывает все триплеты без фильтрации.</p>
  </div>
);

const SORT_TOOLTIP = (
  <div className="space-y-1">
    <p className="font-semibold" style={{ color: 'oklch(0.82 0.19 195)' }}>Сортировка по весу</p>
    <p>Вес отражает силу связи между сущностями. Сортировка по убыванию (↓) показывает наиболее значимые отношения первыми.</p>
  </div>
);

export function TripletsPanel({ triplets }: TripletsPanelProps) {
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [filterType, setFilterType] = useState<RelationType | 'all'>('all');

  const filtered = useMemo(() => {
    let result = filterType === 'all' ? triplets : triplets.filter(t => t.predicate === filterType);
    return [...result].sort((a, b) => sortDir === 'desc' ? b.weight - a.weight : a.weight - b.weight);
  }, [triplets, sortDir, filterType]);

  const relationTypes: RelationType[] = ['association', 'co-occurrence', 'hierarchical', 'functional'];

  if (triplets.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-xs font-mono">
        Нет триплетов. Загрузите файл и запустите анализ.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setFilterType('all')}
            className={`text-xs font-mono px-2 py-0.5 rounded border transition-colors ${filterType === 'all' ? 'border-foreground/40 text-foreground' : 'border-kg-border text-muted-foreground hover:border-foreground/20'}`}
          >
            Все ({triplets.length})
          </button>
          <TooltipIcon content={FILTER_TOOLTIP} side="top" align="start" />
        </div>
        {relationTypes.map(rt => (
          <div key={rt} className="flex items-center gap-0.5">
            <button
              onClick={() => setFilterType(rt)}
              className={`text-xs font-mono px-2 py-0.5 rounded border transition-colors ${filterType === rt ? 'border-foreground/40 text-foreground' : 'border-kg-border text-muted-foreground hover:border-foreground/20'}`}
            >
              {RELATION_LABELS[rt]}
            </button>
            <TooltipIcon content={RELATION_TOOLTIPS[rt]} side="top" align="start" />
          </div>
        ))}
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
            className="flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowUpDown className="w-3 h-3" />
            Вес {sortDir === 'desc' ? '↓' : '↑'}
          </button>
          <TooltipIcon content={SORT_TOOLTIP} side="top" align="end" />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-kg-border">
              <th className="text-left py-1.5 px-2 text-muted-foreground font-normal">
                <div className="flex items-center gap-1">
                  Субъект
                  <TooltipIcon content={<p>Исходная сущность в семантической тройке — термин, от которого исходит связь.</p>} side="top" align="start" />
                </div>
              </th>
              <th className="text-left py-1.5 px-2 text-muted-foreground font-normal">
                <div className="flex items-center gap-1">
                  Предикат
                  <TooltipIcon content={<p>Тип семантической связи между субъектом и объектом. Определяет характер отношения.</p>} side="top" align="start" />
                </div>
              </th>
              <th className="text-left py-1.5 px-2 text-muted-foreground font-normal">
                <div className="flex items-center gap-1">
                  Объект
                  <TooltipIcon content={<p>Целевая сущность в семантической тройке — термин, на который направлена связь.</p>} side="top" align="start" />
                </div>
              </th>
              <th className="text-right py-1.5 px-2 text-muted-foreground font-normal">
                <div className="flex items-center justify-end gap-1">
                  Вес
                  <TooltipIcon content={<p>Числовая значимость связи от 0 до 1. Чем выше вес, тем сильнее и достовернее отношение между сущностями.</p>} side="top" align="end" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t, i) => (
              <tr key={i} className="border-b border-kg-border/40 hover:bg-kg-panel/50 transition-colors">
                <td className="py-1 px-2 text-foreground/90 max-w-[120px] truncate">{t.subject}</td>
                <td className="py-1 px-2">
                  <div className="flex items-center gap-1">
                    <span
                      className="px-1.5 py-0.5 rounded text-xs"
                      style={{
                        color: RELATION_COLORS[t.predicate],
                        backgroundColor: `${RELATION_COLORS[t.predicate]}20`,
                      }}
                    >
                      {RELATION_LABELS[t.predicate]}
                    </span>
                    <TooltipIcon content={RELATION_TOOLTIPS[t.predicate]} side="top" align="start" />
                  </div>
                </td>
                <td className="py-1 px-2 text-foreground/90 max-w-[120px] truncate">{t.object}</td>
                <td className="py-1 px-2 text-right text-muted-foreground">{t.weight.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollArea>
    </div>
  );
}
