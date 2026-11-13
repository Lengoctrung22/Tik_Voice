'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable]:not([contenteditable="false"])',
].join(', ');

export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const candidates = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  return candidates.filter((el) => {
    if (el.hasAttribute('disabled') || el.hasAttribute('hidden') || el.hasAttribute('inert')) {
      return false;
    }
    if (el.tabIndex < 0) return false;

    const hasComputedStyle =
      typeof window !== 'undefined' && typeof window.getComputedStyle === 'function';
    let cur: HTMLElement | null = el;
    while (cur) {
      if (
        cur !== container &&
        (cur.hasAttribute('hidden') ||
          cur.hasAttribute('inert') ||
          cur.getAttribute('aria-hidden') === 'true')
      ) {
        return false;
      }
      if (hasComputedStyle) {
        const style = window.getComputedStyle(cur);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
      }
      if (cur === container) break;
      cur = cur.parentElement;
    }
    return true;
  });
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: DialogProps) {
  const titleId = React.useId();
  const descId = React.useId();
  const panelRef = React.useRef<HTMLDivElement>(null);
  const onOpenChangeRef = React.useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  React.useEffect(() => {
    if (!open) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const panelAtOpen = panelRef.current;
    if (panelAtOpen) {
      const currentActive = document.activeElement;
      const alreadyInsideChild =
        currentActive instanceof HTMLElement &&
        panelAtOpen.contains(currentActive) &&
        currentActive !== panelAtOpen;
      if (!alreadyInsideChild) {
        const focusable = getFocusableElements(panelAtOpen);
        if (focusable.length > 0) {
          focusable[0].focus();
        } else {
          panelAtOpen.focus();
        }
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onOpenChangeRef.current(false);
        return;
      }

      if (e.key === 'Tab') {
        const panel = panelRef.current;
        if (!panel) return;
        const focusable = getFocusableElements(panel);
        if (focusable.length === 0) {
          e.preventDefault();
          panel.focus();
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement as HTMLElement | null;

        if (!active || !panel.contains(active)) {
          e.preventDefault();
          (e.shiftKey ? last : first).focus();
          return;
        }

        if (e.shiftKey) {
          if (active === first || active === panel) {
            e.preventDefault();
            last.focus();
          }
        } else if (active === panel || active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    const handleFocusIn = (e: FocusEvent) => {
      const panel = panelRef.current;
      if (!panel) return;
      if (!panel.contains(e.target as Node)) {
        const focusable = getFocusableElements(panel);
        (focusable[0] || panel).focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('focusin', handleFocusIn);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('focusin', handleFocusIn);
      if (
        previouslyFocused &&
        previouslyFocused.isConnected &&
        typeof previouslyFocused.focus === 'function'
      ) {
        previouslyFocused.focus();
      }
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="presentation"
    >
      <div
        className="fixed inset-0"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          'relative z-50 w-full max-w-lg rounded-xl border border-white/[0.12] bg-[#18181b] p-5 shadow-2xl flex flex-col gap-4 text-[#fafafa] outline-none',
          className
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] pb-3">
          <div>
            {title && (
              <h3 id={titleId} className="font-bold text-[#fafafa] text-sm">
                {title}
              </h3>
            )}
            {description && (
              <p id={descId} className="text-xs text-[#a1a1aa] mt-0.5">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            aria-label="Đóng hộp thoại"
            onClick={() => onOpenChange(false)}
            className="rounded-md p-1.5 text-[#a1a1aa] hover:bg-[#27272a] hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f97316]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}
