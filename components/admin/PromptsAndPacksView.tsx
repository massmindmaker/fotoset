'use client'

import { useState } from 'react'
import {
  FlaskConical,
  FileText,
  Package,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { PromptTesterView } from './PromptTesterView'
import { PromptsProvider } from './PromptsContext'
import { SavedPromptsColumn } from './SavedPromptsColumn'
import { PhotoPacksColumn } from './PhotoPacksColumn'
import { AddToPackPopover } from './AddToPackPopover'

/**
 * PromptsAndPacksView Component
 *
 * Fully responsive 3-column layout:
 *
 * Desktop (≥1280px): 3 columns side by side
 * - LEFT (40%): Prompt Tester
 * - CENTER (35%): Saved Prompts
 * - RIGHT (25%): Photo Packs
 *
 * Tablet (768px-1279px): 2 columns + collapsible third
 * - TOP ROW: Tester (60%) + Prompts (40%)
 * - BOTTOM ROW: Packs (collapsible)
 *
 * Mobile (<768px): Single column with collapsible sections
 * - All sections stacked vertically
 * - Each section collapsible to save space
 */

type SectionId = 'tester' | 'prompts' | 'packs'

export function PromptsAndPacksView() {
  // Mobile: track which sections are expanded
  const [expandedSections, setExpandedSections] = useState<Set<SectionId>>(
    new Set(['tester'])
  )

  const toggleSection = (section: SectionId) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(section)) {
        next.delete(section)
      } else {
        next.add(section)
      }
      return next
    })
  }

  const isSectionExpanded = (section: SectionId) => expandedSections.has(section)

  return (
    <PromptsProvider>
      <div className="h-full">
        {/*
          DESKTOP LAYOUT (xl: ≥1280px)
          3 columns side by side
        */}
        <div className="hidden xl:grid xl:grid-cols-12 gap-4 h-full">
          {/* Left Column: Tester (5 cols = ~42%) */}
          <div className="xl:col-span-5 h-full overflow-hidden">
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
          <div className="xl:col-span-4 h-full overflow-hidden">
            <SavedPromptsColumn />
          </div>

          {/* Right Column: Photo Packs (3 cols = ~25%) */}
          <div className="xl:col-span-3 h-full overflow-hidden">
            <PhotoPacksColumn />
          </div>
        </div>

        {/*
          TABLET LAYOUT (md: 768px - 1279px)
          2 columns on top, packs below
        */}
        <div className="hidden md:block xl:hidden space-y-4">
          {/* Top Row: Tester + Prompts */}
          <div className="grid grid-cols-2 gap-4" style={{ height: 'calc(50vh - 80px)' }}>
            {/* Tester */}
            <div className="h-full overflow-hidden">
              <div className="h-full bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
                <div className="flex-shrink-0 p-3 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                  <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                    <FlaskConical className="w-4 h-4 text-blue-600" />
                    Тестер промптов
                  </h3>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <PromptTesterView />
                </div>
              </div>
            </div>

            {/* Saved Prompts */}
            <div className="h-full overflow-hidden">
              <SavedPromptsColumn />
            </div>
          </div>

          {/* Bottom Row: Photo Packs */}
          <div style={{ height: 'calc(50vh - 80px)' }}>
            <PhotoPacksColumn />
          </div>
        </div>

        {/*
          MOBILE LAYOUT (<768px)
          Single column with collapsible sections
        */}
        <div className="md:hidden space-y-3">
          {/* Tester Section */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <button
              onClick={() => toggleSection('tester')}
              className="w-full p-4 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 transition-colors"
            >
              <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <FlaskConical className="w-5 h-5 text-blue-600" />
                Тестер промптов
              </h3>
              {isSectionExpanded('tester') ? (
                <ChevronUp className="w-5 h-5 text-slate-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-400" />
              )}
            </button>
            {isSectionExpanded('tester') && (
              <div className="border-t border-slate-200">
                <PromptTesterView />
              </div>
            )}
          </div>

          {/* Saved Prompts Section */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <button
              onClick={() => toggleSection('prompts')}
              className="w-full p-4 flex items-center justify-between bg-gradient-to-r from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 transition-colors"
            >
              <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-green-600" />
                Сохранённые промпты
              </h3>
              {isSectionExpanded('prompts') ? (
                <ChevronUp className="w-5 h-5 text-slate-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-400" />
              )}
            </button>
            {isSectionExpanded('prompts') && (
              <div className="border-t border-slate-200">
                <SavedPromptsColumn isMobile />
              </div>
            )}
          </div>

          {/* Photo Packs Section */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <button
              onClick={() => toggleSection('packs')}
              className="w-full p-4 flex items-center justify-between bg-gradient-to-r from-purple-50 to-violet-50 hover:from-purple-100 hover:to-violet-100 transition-colors"
            >
              <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <Package className="w-5 h-5 text-purple-600" />
                Фотопаки
              </h3>
              {isSectionExpanded('packs') ? (
                <ChevronUp className="w-5 h-5 text-slate-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-400" />
              )}
            </button>
            {isSectionExpanded('packs') && (
              <div className="border-t border-slate-200">
                <PhotoPacksColumn isMobile />
              </div>
            )}
          </div>
        </div>

        {/* Global Add to Pack Popover */}
        <AddToPackPopover />
      </div>
    </PromptsProvider>
  )
}
