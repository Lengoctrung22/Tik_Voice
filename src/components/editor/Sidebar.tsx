'use client';

import React from 'react';
import {
  FileText,
  Mic,
  Captions,
  Music,
  Download,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EditorTab } from '@/stores/editorStore';
import type { ProjectDTO } from '@/types';

interface SidebarProps {
  activeTab: EditorTab;
  onSelectTab: (tab: EditorTab) => void;
  project: ProjectDTO;
}

export function Sidebar({ activeTab, onSelectTab, project }: SidebarProps) {
  const hasScript = Boolean(project.script?.text?.trim());
  const hasVoice = Boolean(project.tts?.audioPath);
  const hasSubtitle = Boolean(
    !project.subtitle?.enabled || (project.subtitle?.words?.length ?? 0) > 0
  );
  const hasMusicOrWm = Boolean(project.bgMusic?.path || project.watermark?.enabled);
  const isDone = project.status === 'done' && Boolean(project.export?.path);

  const isScriptVoiceDesync = Boolean(
    project.tts?.audioPath &&
      !project.tts?.isCustomAudio &&
      project.tts?.sourceText &&
      project.script?.text &&
      project.tts.sourceText.trim() !== project.script.text.trim()
  );

  const steps: Array<{
    id: EditorTab;
    label: string;
    shortLabel: string;
    icon: React.ComponentType<{ className?: string }>;
    done: boolean;
    warning?: boolean;
  }> = [
    {
      id: 'script',
      label: 'Kịch bản & Video',
      shortLabel: 'Kịch bản',
      icon: FileText,
      done: hasScript,
    },
    {
      id: 'voice',
      label: 'Giọng đọc AI',
      shortLabel: 'Giọng đọc',
      icon: Mic,
      done: hasVoice,
      warning: isScriptVoiceDesync,
    },
    {
      id: 'subtitle',
      label: 'Phụ đề Karaoke',
      shortLabel: 'Phụ đề',
      icon: Captions,
      done: Boolean(project.subtitle?.words?.length) && hasSubtitle,
    },
    {
      id: 'music',
      label: 'Nhạc nền & Logo',
      shortLabel: 'Nhạc & Logo',
      icon: Music,
      done: hasMusicOrWm,
    },
    {
      id: 'export',
      label: 'Xuất video',
      shortLabel: 'Xuất video',
      icon: Download,
      done: isDone,
    },
  ];

  return (
    <aside
      aria-label="Các bước biên tập"
      className="shrink-0 border-b border-white/[0.08] bg-[#111113] lg:w-[88px] lg:border-b-0 lg:border-r"
    >
      <nav className="flex flex-row items-center gap-1 overflow-x-auto p-1.5 lg:flex-col lg:gap-1.5 lg:p-2">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const active = activeTab === step.id;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => onSelectTab(step.id)}
              aria-current={active ? 'step' : undefined}
              title={step.label}
              className={cn(
                'relative flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-2 text-[11px] font-medium transition-colors cursor-pointer lg:w-full lg:flex-col lg:justify-center lg:gap-1 lg:px-1 lg:py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f97316]',
                active
                  ? 'bg-[#f97316]/15 text-[#fb923c] border border-[#f97316]/35'
                  : 'text-[#a1a1aa] border border-transparent hover:bg-white/[0.05] hover:text-[#fafafa]'
              )}
            >
              <span className="relative flex h-6 w-6 items-center justify-center">
                <Icon className="h-4 w-4" />
                {step.warning ? (
                  <span
                    title="Kịch bản vừa thay đổi, cần tạo lại giọng đọc"
                    className="absolute -right-1.5 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500 text-black"
                  >
                    <AlertTriangle className="h-2.5 w-2.5" />
                  </span>
                ) : step.done ? (
                  <span className="absolute -right-1.5 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 text-black">
                    <Check className="h-2.5 w-2.5 stroke-[3]" />
                  </span>
                ) : null}
              </span>
              <span className="whitespace-nowrap text-[10px] leading-tight lg:text-center">
                {index + 1}. {step.shortLabel}
              </span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
