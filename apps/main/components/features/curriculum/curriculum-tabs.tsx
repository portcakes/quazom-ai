"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@quazom-ai/ui/components/ui/tabs";
import type {
  CurriculumObjective,
  CurriculumResource,
} from "@/inngest/schemas";
import type { CurriculumModuleWithLessons } from "@/lib/queries/lesson";
import { SyllabusTab } from "./syllabus-tab";
import { ModulesTab } from "./modules-tab";
import { ResourcesTab } from "./resources-tab";
import { OptionsTab } from "./options-tab";
import { CurriculumNotesTab } from "./notes-tab";
import { StudyScheduleTab } from "./study-schedule-tab";

type Props = {
  id: string;
  title: string;
  isHidden: boolean;
  objectives: CurriculumObjective[];
  modules: CurriculumModuleWithLessons[];
  resources: CurriculumResource[];
};

export function CurriculumTabs({
  id,
  title,
  isHidden,
  objectives,
  modules,
  resources,
}: Props) {
  return (
    <section className="mx-auto w-full max-w-4xl px-6 py-8">
      <Tabs defaultValue="syllabus" className="w-full">
        {/* Sticky tabs on every screen size so users can switch tabs without
            scrolling back to the top. Offset matches the sticky chrome:
              - portrait mobile (<md): navbar h-12 + compact header h-12 = top-24
              - everywhere else: just the compact header h-12 = top-12

            On narrow viewports the six tabs no longer fit in the strip's
            natural width. We solve this with a horizontal scroll container
            whose inner row uses `min-w-full w-fit` so that:
              - when the tabs fit, they stay centered in the container
              - when they overflow, the user can swipe horizontally
            The scrollbar is hidden visually since the active-tab indicator
            already cues "swipe to see more". */}
        <div className="sticky top-24 z-10 -mx-6 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:top-12">
          <div className="overflow-x-auto px-6 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex w-fit min-w-full justify-center">
              <TabsList>
                <TabsTrigger value="syllabus" className="cursor-pointer">Syllabus</TabsTrigger>
                <TabsTrigger value="modules" className="cursor-pointer">Modules</TabsTrigger>
                <TabsTrigger value="resources" className="cursor-pointer">Resources</TabsTrigger>
                <TabsTrigger value="notes" className="cursor-pointer">Notes</TabsTrigger>
                <TabsTrigger value="schedule" className="cursor-pointer">Study Schedule</TabsTrigger>
                <TabsTrigger value="options" className="cursor-pointer">Options</TabsTrigger>
              </TabsList>
            </div>
          </div>
        </div>
        <TabsContent value="syllabus" className="mt-6">
          <SyllabusTab objectives={objectives} resources={resources} />
        </TabsContent>
        <TabsContent value="modules" className="mt-6">
          <ModulesTab curriculumId={id} modules={modules} />
        </TabsContent>
        <TabsContent value="resources" className="mt-6">
          <ResourcesTab resources={resources} />
        </TabsContent>
        <TabsContent value="notes" className="mt-6">
          <CurriculumNotesTab curriculumId={id} />
        </TabsContent>
        <TabsContent value="schedule" className="mt-6">
          <StudyScheduleTab curriculumId={id} curriculumTitle={title} />
        </TabsContent>
        <TabsContent value="options" className="mt-6">
          <OptionsTab id={id} title={title} isHidden={isHidden} />
        </TabsContent>
      </Tabs>
    </section>
  );
}
