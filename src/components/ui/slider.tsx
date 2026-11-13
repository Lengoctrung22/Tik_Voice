'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  label?: string;
  valueDisplay?: string | number;
  defaultResetValue?: number;
}

export function Slider({
  className,
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  label,
  valueDisplay,
  defaultResetValue,
  ...props
}: SliderProps) {
  const handleDoubleClick = () => {
    if (props.disabled) return;
    if (defaultResetValue !== undefined) {
      onChange(defaultResetValue);
    }
  };

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {(label || valueDisplay !== undefined) && (
        <div className="flex items-center justify-between text-xs gap-2">
          {label && <span className="text-[#a1a1aa] truncate">{label}</span>}
          {valueDisplay !== undefined && (
            <button
              type="button"
              disabled={props.disabled}
              onDoubleClick={handleDoubleClick}
              title={
                defaultResetValue !== undefined && !props.disabled
                  ? 'Nhấp đúp để đặt lại mặc định'
                  : undefined
              }
              className={cn(
                'font-mono text-[11px] text-[#fafafa] font-semibold bg-[#27272a] border border-white/[0.08] px-1.5 py-0.5 rounded tabular-nums disabled:opacity-50 disabled:cursor-not-allowed',
                defaultResetValue !== undefined && !props.disabled && 'hover:border-[#f97316]/50 cursor-pointer'
              )}
            >
              {valueDisplay}
            </button>
          )}
        </div>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onDoubleClick={handleDoubleClick}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className={cn(
          'w-full h-1.5 bg-[#27272a] rounded-full appearance-none cursor-pointer accent-[#f97316] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f97316]/50 disabled:opacity-50 disabled:cursor-not-allowed',
          className
        )}
        {...props}
      />
    </div>
  );
}
