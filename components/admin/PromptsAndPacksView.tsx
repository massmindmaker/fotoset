'use client'

import { useState } from 'react'
import {
  FlaskConical,
  FileText,
  Package,
} from 'lucide-react'
import { PromptTesterView } from './PromptTesterView'
import { PromptsProvider } from './PromptsContext'
import { SavedPromptsColumn } from './SavedPromptsColumn'
import { PhotoPacksColumn } from './PhotoPacksColumn'
import { AddToPackPopover } from './AddToPackPopover'

/**
 * PromptsAndPacksView Component
 *
 * 3-column layout for desktop (lg+):
 * - LEFT (40%): Prompt Tester
 * - CENTER (33%): Saved Prompts
 * - RIGHT (27%): Photo Packs
 *
 * Tab navigation for mobile/tablet (< lg)
 */

type TabType = 'tester' | 'prompts' | 'packs'

export function PromptsAndPacksView() {
  const [activeTab, setActiveTab] = useState<TabType>('tester')

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'tester', label: 'Тестер', icon: <FlaskConical className="w-4 h-4" /> },
    { id: 'prompts', label: 'Промпты', icon: <FileText className="w-4 h-4" /> },
    { id: 'packs', label: 'Фотопаки', icon: <Package className="w-4 h-4" /> },
  ]

  return (
    <PromptsProvider>
      <div className="h-full">
        {/* Desktop: 3-column grid (lg+) */}
        <div className="hidden lg:grid lg:grid-cols-12 gap-4 h-full">
          {/* Left Column: Tester (5 cols = ~42%) */}
          <div className="lg:col-span-5 h-full overflow-hidden">
            <div className="h-full bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
              <div className="flex-shrink-0 p-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <FlaskConical className="w-5 h-5 text-blue-600" />
                  Тестер промптов
                </h3>
              </div>
              <div className="flex-1 overflow-y-auto">
                <PromptTesterView />
              </div>
            </div>
          </div>

          {/* Center Column: Saved Prompts (4 cols = ~33%) */}
          <div className="lg:col-span-4 h-full overflow-hidden">
            <SavedPromptsColumn />
          </div>

          {/* Right Column: Photo Packs (3 cols = ~25%) */}
          <div className="lg:col-span-3 h-full overflow-hidden">
            <PhotoPacksColumn />
          </div>
        </div>

        {/* Mobile/Tablet: Tab navigation (< lg) */}
        <div className="lg:hidden space-y-4">
          {/* Tab Buttons */}
          <div className="flex gap-2 border-b border-slate-200 pb-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                  ${activeTab === tab.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }
                `}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="min-h-[calc(100vh-200px)]">
            {activeTab === 'tester' && (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <FlaskConical className="w-5 h-5 text-blue-600" />
                    Тестер промптов
                  </h3>
                </div>
                <PromptTesterView />
              </div>
            )}
            {activeTab === 'prompts' && <SavedPromptsColumn />}
            {activeTab === 'packs' && <PhotoPacksColumn />}
          </div>
        </div>

        {/* Global Add to Pack Popover */}
        <AddToPackPopover />
      </div>
    </PromptsProvider>
  )
}
