"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@quazom-ai/ui/components/ui/tabs";
import type {
  CurriculumModule,
  CurriculumObjective,
  CurriculumResource,
} from "@/inngest/schemas";
import { SyllabusTab } from "./syllabus-tab";
import { ModulesTab } from "./modules-tab";
import { ResourcesTab } from "./resources-tab";

type Props = {
  objectives: CurriculumObjective[];
  modules: CurriculumModule[];
  resources: CurriculumResource[];
};

export function CurriculumTabs({ objectives, modules, resources }: Props) {
  return (
    <section className="mx-auto w-full max-w-4xl px-6 py-8">
      <Tabs defaultValue="syllabus" className="w-full">
        {/* Sticky on mobile so users can switch tabs without scrolling back to
            the top. Sits below the navbar (h-12) + compact header (h-12) on
            portrait, just below the compact header on landscape mobile, and
            falls back to natural flow on desktop where the hero is sticky. */}
        <div className="sticky top-24 z-10 -mx-6 border-b border-border bg-background/95 px-6 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:top-12 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none">
          <TabsList>
            <TabsTrigger value="syllabus">Syllabus</TabsTrigger>
            <TabsTrigger value="modules">Modules</TabsTrigger>
            <TabsTrigger value="resources">Resources</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="syllabus" className="mt-6">
          <SyllabusTab objectives={objectives} resources={resources} />
        </TabsContent>
        <TabsContent value="modules" className="mt-6">
          <ModulesTab modules={modules} />
        </TabsContent>
        <TabsContent value="resources" className="mt-6">
          <ResourcesTab resources={resources} />
        </TabsContent>
      </Tabs>
    </section>
  );
}
