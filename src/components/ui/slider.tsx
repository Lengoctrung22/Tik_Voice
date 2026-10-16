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
  ...props
}: SliderProps) {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {(label || valueDisplay !== undefined) && (
        <div className="flex items-center justify-between text-xs">
          {label && <span className="text-[#a1a1aa]">{label}</span>}
          {valueDisplay !== undefined && (
            <span className="font-mono text-white font-semibold">{valueDisplay}</span>
          )}
        </div>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className={cn(
          'w-full h-1.5 bg-[#27272a] rounded-lg appearance-none cursor-pointer accent-[#f97316]',
          className
        )}
        {...props}
      />
    </div>
  );
}
