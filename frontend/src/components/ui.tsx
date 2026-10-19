import * as DialogPrimitive from "@radix-ui/react-dialog";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from "react";
import { X } from "lucide-react";
import { cn } from "../lib/utils";

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "danger" | "ghost";
}) {
  return (
    <button
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition disabled:pointer-events-none disabled:opacity-50",
        variant === "primary" &&
          "bg-emerald-700 text-white hover:bg-emerald-800",
        variant === "outline" &&
          "border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 hover:bg-stone-50 dark:hover:bg-stone-950",
        variant === "danger" && "bg-red-600 text-white hover:bg-red-700",
        variant === "ghost" && "hover:bg-stone-100 dark:hover:bg-stone-800",
        className,
      )}
      {...props}
    />
  );
}
export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 px-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100",
        className,
      )}
      {...props}
    />
  );
}
export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-sm",
        className,
      )}
    >
      {children}
    </section>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "danger" | "warning";
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
        tone === "neutral" &&
          "bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200",
        tone === "success" &&
          "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200",
        tone === "danger" &&
          "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300",
        tone === "warning" &&
          "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200",
      )}
    >
      {children}
    </span>
  );
}
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export function DialogContent({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-stone-950/45 backdrop-blur-sm" />
      <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white dark:bg-stone-900 p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <DialogPrimitive.Title className="text-xl font-bold">
            {title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Close className="rounded-lg p-1 hover:bg-stone-100 dark:hover:bg-stone-800">
            <X size={18} />
          </DialogPrimitive.Close>
        </div>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
