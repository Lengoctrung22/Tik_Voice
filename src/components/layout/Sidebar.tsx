'use client';

import { useEditorStore, EditorTab } from '@/stores/editorStore';
import { FileText, Mic, Subtitles, Music, Rocket, CheckCircle2 } from 'lucide-react';

interface TabItem {
  id: EditorTab;
  label: string;
  icon: typeof FileText;
  isComplete: (project: any) => boolean;
}

const TABS: TabItem[] = [
  {
    id: 'script',
    label: 'Kịch bản',
    icon: FileText,
    isComplete: (p) => Boolean(p?.script?.text),
  },
  {
    id: 'voice',
    label: 'Giọng đọc',
    icon: Mic,
    isComplete: (p) => Boolean(p?.tts?.audioPath),
  },
  {
    id: 'subtitle',
    label: 'Phụ đề',
    icon: Subtitles,
    isComplete: (p) => Boolean(p?.subtitle?.words?.length > 0),
  },
  {
    id: 'music',
    label: 'Nhạc nền',
    icon: Music,
    isComplete: (p) => Boolean(p?.bgMusic?.path),
  },
  {
    id: 'export',
    label: 'Xuất video',
    icon: Rocket,
    isComplete: (p) => p?.status === 'done',
  },
];

export function Sidebar() {
  const { activeTab, setActiveTab, project } = useEditorStore();

  return (
    <aside className="w-16 border-r border-[#3f3f46] bg-[#18181b] flex flex-col items-center py-4 gap-2 select-none">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        const complete = tab.isComplete(project);

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            title={tab.label}
            className={`group relative flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all ${
              isActive
                ? 'bg-[#431407] text-[#f97316] shadow-sm'
                : 'text-[#a1a1aa] hover:bg-[#27272a] hover:text-white'
            }`}
          >
            <Icon className="h-5 w-5" />
            <span className="text-[10px] mt-1 font-medium scale-90 leading-none">
              {tab.label}
            </span>

            {complete && (
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-[#22c55e]" />
            )}
          </button>
        );
      })}
    </aside>
  );
}
