import React, { useState } from 'react';
import { Download, FileJson, FileText, FileSpreadsheet } from 'lucide-react';
import { KnowledgeGraph, Triplet, TaxonomyNode, OntologyEntry } from '../types';
import { exportToJSON, exportToCSV, exportToExcel } from '../lib/exportUtils';
import { TooltipIcon } from './TooltipIcon';

interface ExportButtonsProps {
  graph: KnowledgeGraph | null;
  triplets: Triplet[];
  taxonomy: TaxonomyNode | null;
  ontology: OntologyEntry[];
  disabled?: boolean;
}

const JSON_TOOLTIP = (
  <div className="space-y-1.5">
    <p className="font-semibold" style={{ color: 'oklch(0.82 0.19 195)' }}>Экспорт JSON</p>
    <p>Полный результат анализа в одном структурированном файле:</p>
    <ul className="space-y-0.5 list-none">
      <li>• Граф (узлы и рёбра)</li>
      <li>• Триплеты (субъект–предикат–объект)</li>
      <li>• Таксономия (иерархия понятий)</li>
      <li>• Онтология (типизированные связи)</li>
    </ul>
    <p className="text-muted-foreground">Подходит для программной обработки и интеграции с другими системами.</p>
  </div>
);

const CSV_TOOLTIP = (
  <div className="space-y-1.5">
    <p className="font-semibold" style={{ color: 'oklch(0.72 0.2 145)' }}>Экспорт CSV</p>
    <p>Генерирует два отдельных CSV-файла:</p>
    <ul className="space-y-0.5 list-none">
      <li>• <span style={{ color: 'oklch(0.82 0.19 195)' }}>triplets.csv</span> — все триплеты с весами</li>
      <li>• <span style={{ color: 'oklch(0.78 0.19 75)' }}>ontology.csv</span> — онтологические связи с уверенностью</li>
    </ul>
    <p className="text-muted-foreground">Подходит для анализа в Excel, Google Sheets или Python/pandas.</p>
  </div>
);

const EXCEL_TOOLTIP = (
  <div className="space-y-1.5">
    <p className="font-semibold" style={{ color: 'oklch(0.78 0.19 75)' }}>Экспорт Excel</p>
    <p>Многолистовая книга Excel (.xlsx) с отдельными листами:</p>
    <ul className="space-y-0.5 list-none">
      <li>• <span style={{ color: 'oklch(0.82 0.19 195)' }}>Триплеты</span> — семантические тройки</li>
      <li>• <span style={{ color: 'oklch(0.78 0.19 75)' }}>Таксономия</span> — иерархия (плоский список)</li>
      <li>• <span style={{ color: 'oklch(0.65 0.22 300)' }}>Онтология</span> — типизированные связи</li>
    </ul>
    <p className="text-muted-foreground">Подходит для ручного просмотра, отчётов и презентаций.</p>
  </div>
);

type ExportType = 'json' | 'csv' | 'excel';

interface ButtonConfig {
  type: ExportType;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  tooltip: React.ReactNode;
}

const BUTTONS: ButtonConfig[] = [
  { type: 'json', label: 'JSON', Icon: FileJson, tooltip: JSON_TOOLTIP },
  { type: 'csv', label: 'CSV', Icon: FileText, tooltip: CSV_TOOLTIP },
  { type: 'excel', label: 'Excel', Icon: FileSpreadsheet, tooltip: EXCEL_TOOLTIP },
];

export function ExportButtons({ graph, triplets, taxonomy, ontology, disabled }: ExportButtonsProps) {
  const [exporting, setExporting] = useState<ExportType | null>(null);

  const isDisabled = disabled || !graph || !taxonomy;

  const handleExport = async (type: ExportType) => {
    if (!graph || !taxonomy) return;
    setExporting(type);
    try {
      if (type === 'json') exportToJSON(graph, triplets, taxonomy, ontology);
      else if (type === 'csv') exportToCSV(triplets, ontology);
      else exportToExcel(graph, triplets, taxonomy, ontology);
    } finally {
      setTimeout(() => setExporting(null), 800);
    }
  };

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Экспорт</p>
      <div className="grid grid-cols-3 gap-1.5">
        {BUTTONS.map(({ type, label, Icon, tooltip }) => (
          <div key={type} className="relative flex flex-col items-center">
            <button
              disabled={isDisabled || exporting !== null}
              onClick={() => handleExport(type)}
              className={`
                w-full flex flex-col items-center gap-1 px-2 py-2 rounded text-xs font-mono transition-all duration-150
                bg-kg-panel border border-kg-border
                hover:border-kg-cyan/40 hover:text-foreground
                disabled:opacity-30 disabled:cursor-not-allowed
                text-muted-foreground
              `}
            >
              {exporting === type ? (
                <Download className="w-3.5 h-3.5 animate-bounce" />
              ) : (
                <Icon className="w-3.5 h-3.5" />
              )}
              {label}
            </button>
            <div className="absolute top-0.5 right-0.5">
              <TooltipIcon content={tooltip} side="right" align="start" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
