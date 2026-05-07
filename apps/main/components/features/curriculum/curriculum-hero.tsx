import { Badge } from "@quazom-ai/ui/components/ui/badge";

type Props = {
  title: string;
  overview: string;
  level: string;
  estimatedDuration: string;
};

export function CurriculumHero({ title, overview, level, estimatedDuration }: Props) {
  return (
    <section className="border-b border-border bg-gradient-to-b from-muted/40 to-background">
      <div className="mx-auto flex max-w-4xl flex-col gap-4 px-6 py-12">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="capitalize">
            {level}
          </Badge>
          <Badge variant="outline">{estimatedDuration}</Badge>
        </div>
        <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          {title}
        </h1>
        <p className="max-w-3xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          {overview}
        </p>
      </div>
    </section>
  );
}
