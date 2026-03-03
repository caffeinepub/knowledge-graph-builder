import {
  AlertCircle,
  CheckCircle,
  FileSpreadsheet,
  Loader2,
  Upload,
} from "lucide-react";
import type React from "react";
import { useCallback, useRef, useState } from "react";
import { parseExcelFile } from "../lib/excelParser";
import type { IntentGroup } from "../types";
import { TooltipIcon } from "./TooltipIcon";

interface FileUploadProps {
  onParsed: (groups: IntentGroup[]) => void;
}

const FILE_FORMAT_TOOLTIP = (
  <div className="space-y-2">
    <p className="font-semibold" style={{ color: "oklch(0.82 0.19 195)" }}>
      Формат файла .xlsx
    </p>
    <p>Загрузите таблицу Excel со следующей структурой:</p>
    <ul className="space-y-1 list-none">
      <li>
        <span style={{ color: "oklch(0.82 0.19 195)" }}>Колонка A</span> —
        поисковые запросы (ключевые фразы)
      </li>
      <li>
        <span style={{ color: "oklch(0.78 0.19 75)" }}>Колонка B</span> —
        частота запроса (целое число)
      </li>
      <li>
        <span style={{ color: "oklch(0.65 0.22 300)" }}>Пустая строка</span> —
        разделитель групп намерений
      </li>
    </ul>
    <p className="text-muted-foreground">
      Пример: строки 1–5 = группа 1, пустая строка, строки 7–12 = группа 2 и
      т.д.
    </p>
  </div>
);

export function FileUpload({ onParsed }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [fileName, setFileName] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [stats, setStats] = useState<{
    intents: number;
    queries: number;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    async (file: File) => {
      if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
        setStatus("error");
        setErrorMsg("Загрузите файл формата .xlsx или .xls");
        return;
      }

      setStatus("loading");
      setFileName(file.name);
      setErrorMsg("");

      try {
        const groups = await parseExcelFile(file);
        if (groups.length === 0) {
          setStatus("error");
          setErrorMsg("Данные не найдены. Проверьте формат файла.");
          return;
        }
        const totalQueries = groups.reduce((s, g) => s + g.length, 0);
        setStats({ intents: groups.length, queries: totalQueries });
        setStatus("success");
        onParsed(groups);
      } catch (err) {
        setStatus("error");
        setErrorMsg(
          err instanceof Error ? err.message : "Ошибка при разборе файла",
        );
      }
    },
    [onParsed],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        <span className="text-xs font-mono text-muted-foreground/70">
          Файл данных
        </span>
        <TooltipIcon content={FILE_FORMAT_TOOLTIP} side="right" align="start" />
      </div>
      <button
        type="button"
        className={`
          w-full relative border-2 border-dashed rounded-lg p-4 cursor-pointer transition-all duration-200
          ${
            isDragging
              ? "border-kg-cyan bg-kg-cyan/10"
              : status === "success"
                ? "border-kg-green/60 bg-kg-green/5"
                : status === "error"
                  ? "border-destructive/60 bg-destructive/5"
                  : "border-kg-border hover:border-kg-cyan/50 hover:bg-kg-cyan/5"
          }
        `}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={handleChange}
        />

        <div className="flex flex-col items-center gap-2 text-center">
          {status === "loading" ? (
            <Loader2 className="w-8 h-8 text-kg-cyan animate-spin" />
          ) : status === "success" ? (
            <CheckCircle
              className="w-8 h-8"
              style={{ color: "oklch(0.72 0.2 145)" }}
            />
          ) : status === "error" ? (
            <AlertCircle className="w-8 h-8 text-destructive" />
          ) : (
            <div className="flex flex-col items-center gap-1">
              <FileSpreadsheet className="w-8 h-8 text-muted-foreground/40" />
              <Upload className="w-4 h-4 text-muted-foreground/30" />
            </div>
          )}

          {status === "loading" && (
            <p className="text-xs font-mono text-muted-foreground">
              Загрузка...
            </p>
          )}
          {status === "success" && stats && (
            <div className="space-y-0.5">
              <p
                className="text-xs font-mono truncate max-w-[140px]"
                style={{ color: "oklch(0.72 0.2 145)" }}
              >
                {fileName}
              </p>
              <p className="text-xs font-mono text-muted-foreground">
                {stats.intents}{" "}
                {stats.intents === 1
                  ? "группа"
                  : stats.intents < 5
                    ? "группы"
                    : "групп"}{" "}
                · {stats.queries} запросов
              </p>
            </div>
          )}
          {status === "error" && (
            <p className="text-xs font-mono text-destructive text-center">
              {errorMsg}
            </p>
          )}
          {status === "idle" && (
            <div className="space-y-0.5">
              <p className="text-xs font-mono text-muted-foreground/60">
                Перетащите .xlsx
              </p>
              <p className="text-xs font-mono text-muted-foreground/40">
                или нажмите
              </p>
            </div>
          )}
        </div>
      </button>
    </div>
  );
}
