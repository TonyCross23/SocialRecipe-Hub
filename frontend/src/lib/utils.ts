import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
export const formatNumber = (value: number) => new Intl.NumberFormat().format(value);
export const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
export const titleCase = (value: string) => value.toLowerCase().replace(/(^|_)([a-z])/g, (_, p, c) => `${p ? ' ' : ''}${c.toUpperCase()}`);
