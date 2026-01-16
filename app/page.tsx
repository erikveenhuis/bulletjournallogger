import Link from "next/link";

export default function Home() {
  return (
    <div className="bujo-card bujo-torn grid gap-10">
      <div className="flex flex-col gap-4">
        <p className="bujo-section-title">Bullet Journal Logger</p>
        <div className="flex flex-col gap-4">
          <span className="w-fit rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gray-700">
            Daily check-in, polished export
          </span>
          <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">
            Keep your paper journal vibrant without the daily bookkeeping.
          </h1>
          <p className="max-w-3xl text-base text-gray-800 sm:text-lg">
            Answer a short set of questions, every day, in under two minutes. We turn your
            insights into a clean export so your bullet journal stays intentional and
            beautiful.
          </p>
        </div>
        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:flex-wrap">
          <Link href="/sign-up" className="bujo-btn">
            Get started
          </Link>
          <Link href="/profile" className="bujo-btn-secondary">
            View profile
          </Link>
          <Link href="/insights" className="bujo-btn-secondary">
            Preview insights
          </Link>
        </div>
        <p className="text-sm text-gray-600">
          Customize questions, schedule reminders, export whenever you are ready.
        </p>
      </div>
      <div className="grid gap-6">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {[
            { title: "Smart reminders", desc: "Pick your local time and stay consistent." },
            { title: "Question types", desc: "Boolean, number, scale, emoji, and text." },
            { title: "Bullet journal export", desc: "CSV for quick coloring sessions." },
          ].map((item) => (
            <div key={item.title} className="bujo-question h-full">
              <p className="text-sm font-semibold text-gray-900">{item.title}</p>
              <p className="text-sm text-gray-700">{item.desc}</p>
            </div>
          ))}
        </div>
        <div className="grid gap-4 rounded-2xl border border-gray-200 bg-white/70 p-5">
          <p className="text-sm font-semibold text-gray-900">How it works</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              {
                title: "Build your log",
                desc: "Choose the questions that reflect your habits and goals.",
              },
              {
                title: "Check in daily",
                desc: "Answer in a quick flow on mobile or desktop.",
              },
              {
                title: "Export and reflect",
                desc: "Pull a CSV anytime to color and annotate your journal.",
              },
            ].map((item, index) => (
              <div key={item.title} className="flex gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-sm font-semibold text-gray-700">
                  {index + 1}
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                  <p className="text-sm text-gray-700">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
