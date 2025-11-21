// app/courses/[course]/[discipline]/[lesson]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { getCourseBySlug } from "@/data/courses";
import PlayerWithRouting from "@/components/PlayerWithRouting";
import DisciplineSidebar from "@/components/DisciplineSidebar";

type Props = {
  params: { course: string; discipline: string; lesson: string };
};

export default function LessonPage({ params }: Props) {
  const { course: courseSlug, discipline: disciplineSlug, lesson: lessonSlug } = params;

  const course = getCourseBySlug(courseSlug);
  if (!course) return notFound();

  // subjects|disciplines + lessons|videos
  const subjects = (course as any).subjects ?? (course as any).disciplines ?? [];
  const subject = subjects.find((s: any) => s.slug === disciplineSlug);
  if (!subject) return notFound();

  const lessons = (subject as any).lessons ?? (subject as any).videos ?? [];
  if (!Array.isArray(lessons) || lessons.length === 0) return notFound();

  const current = lessons.find((l: any) => l.slug === lessonSlug);
  if (!current) return notFound();

  // PDFs opcionais
  const pdfs =
    (subject as any).pdfs ??
    ([] as Array<{ slug: string; title: string; url?: string; pages?: number }>);

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10">
      {/* Breadcrumb */}
      <div className="mb-4 text-sm text-gray-600">
        <Link
          href={`/courses/${course.slug}`}
          className="no-underline text-gray-700 hover:text-gray-900"
        >
          {course.title}
        </Link>{" "}
        /{" "}
        <Link
          href={`/courses/${course.slug}/${subject.slug}`}
          className="no-underline text-gray-700 hover:text-gray-900"
        >
          {subject.title}
        </Link>{" "}
        / <span className="text-gray-800">{current.title}</span>
      </div>

      <h1 className="mb-4 text-2xl md:text-3xl font-semibold">{current.title}</h1>

      {/* Layout: player grande + sidebar rica com abas */}
      <section className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
        {/* Player / conteúdo principal */}
        <div className="space-y-4">
          <PlayerWithRouting
            courseSlug={course.slug}
            disciplineSlug={subject.slug}
            lessons={lessons}
            currentLessonSlug={lessonSlug}
          />
          {current.description && <p className="text-gray-700">{current.description}</p>}
        </div>

        {/* Sidebar (Vídeo / PDF / Anotações, rolagem própria, sticky) */}
        <DisciplineSidebar
          courseSlug={course.slug}
          disciplineSlug={subject.slug}
          disciplineTitle={subject.title}
          lessons={lessons}
          currentLessonSlug={lessonSlug}
          pdfs={pdfs}
        />
      </section>
    </main>
  );
}
