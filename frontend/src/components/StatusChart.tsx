import { useId, useState } from "react";
import { Card } from "./ui";
import { cn, formatNumber, titleCase } from "../lib/utils";

type Category = { status: string; color: string };
type Row = { status: string; count: number };
const percentage = (count: number, total: number) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(
    total ? (count / total) * 100 : 0,
  );

export function StatusChart({
  title,
  description,
  unit,
  rows,
  categories,
}: {
  title: string;
  description: string;
  unit: string;
  rows: Row[];
  categories: Category[];
}) {
  const titleId = useId();
  const [selected, setSelected] = useState<string | null>(null);
  const allCategories = [
    ...categories,
    ...rows
      .filter(
        (row) => !categories.some((category) => category.status === row.status),
      )
      .map((row) => ({ status: row.status, color: "#a78bfa" })),
  ];
  const values = allCategories.map((category) => ({
    ...category,
    count: rows.find((row) => row.status === category.status)?.count ?? 0,
  }));
  const total = values.reduce((sum, row) => sum + row.count, 0);
  const active = values.find((row) => row.status === selected);
  let offset = 0;

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id={titleId} className="font-bold">
            {title}
          </h2>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            {description}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600 dark:bg-stone-800 dark:text-stone-300">
          All time
        </span>
      </div>
      <div className="mt-6 grid items-center gap-6 min-[540px]:grid-cols-[minmax(160px,220px)_1fr] lg:grid-cols-1 xl:grid-cols-[minmax(160px,220px)_1fr]">
        <div className="relative mx-auto w-full max-w-[220px]">
          <svg
            viewBox="0 0 200 200"
            className="w-full -rotate-90"
            role="img"
            aria-label={`${title}: ${values.map((row) => `${titleCase(row.status)} ${row.count}`).join(", ")}. Total ${total} ${unit}.`}
          >
            <circle
              cx="100"
              cy="100"
              r="78"
              fill="none"
              stroke="currentColor"
              strokeWidth="22"
              className="text-stone-100 dark:text-stone-800"
            />
            {values
              .filter((row) => row.count > 0)
              .map((row) => {
                const fraction = total ? (row.count / total) * 100 : 0;
                const start = offset;
                offset += fraction;
                return (
                  <circle
                    key={row.status}
                    cx="100"
                    cy="100"
                    r="78"
                    fill="none"
                    pathLength="100"
                    stroke={row.color}
                    strokeWidth="22"
                    strokeDasharray={`${fraction} ${100 - fraction}`}
                    strokeDashoffset={-start}
                    className="transition-opacity"
                    opacity={selected && selected !== row.status ? 0.2 : 1}
                  >
                    <title>
                      {titleCase(row.status)}: {formatNumber(row.count)} (
                      {percentage(row.count, total)}%)
                    </title>
                  </circle>
                );
              })}
          </svg>
          <div
            className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-8 text-center"
            aria-live="polite"
          >
            <span className="text-3xl font-bold tabular-nums">
              {formatNumber(active?.count ?? total)}
            </span>
            <span className="mt-1 text-xs text-stone-500 dark:text-stone-400">
              {active ? titleCase(active.status) : `Total ${unit}`}
            </span>
          </div>
        </div>
        <ul aria-labelledby={titleId} className="grid min-w-0 gap-2">
          {values.map((row) => (
            <li key={row.status}>
              <button
                type="button"
                aria-pressed={selected === row.status}
                onClick={() =>
                  setSelected((current) =>
                    current === row.status ? null : row.status,
                  )
                }
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-emerald-500 dark:hover:bg-stone-800",
                  selected === row.status && "bg-stone-100 dark:bg-stone-800",
                )}
              >
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: row.color }}
                />
                <span className="min-w-0 flex-1 text-sm">
                  {titleCase(row.status)}
                </span>
                <span className="text-right">
                  <strong className="block text-sm tabular-nums">
                    {formatNumber(row.count)}
                  </strong>
                  <span className="block text-xs tabular-nums text-stone-500 dark:text-stone-400">
                    {percentage(row.count, total)}%
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      {!total && (
        <p className="mt-4 text-center text-sm text-stone-500 dark:text-stone-400">
          No {unit} yet.
        </p>
      )}
    </Card>
  );
}
