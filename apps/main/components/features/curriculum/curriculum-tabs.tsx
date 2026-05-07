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
        <TabsList>
          <TabsTrigger value="syllabus">Syllabus</TabsTrigger>
          <TabsTrigger value="modules">Modules</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
        </TabsList>
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
