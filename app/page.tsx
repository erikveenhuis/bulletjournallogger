import Link from "next/link";

export default function Home() {
  return (
    <div className="bujo-card bujo-torn grid gap-8">
      <div className="flex flex-col gap-4">
        <p className="bujo-section-title">Bullet Journal Logger</p>
        <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">
          Log your day in minutes. Keep your paper journal vibrant.
        </h1>
        <p className="max-w-3xl text-base text-gray-800 sm:text-lg">
          Get a daily reminder, answer your personalized questions (mood, habits, steps,
          water, more), and export insights to color your bullet journal on your own time.
        </p>
        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:flex-wrap">
          <Link href="/sign-up" className="bujo-btn">
            Get started
          </Link>
          <Link href="/profile" className="bujo-btn-secondary">
            View profile
          </Link>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {[
          { title: "Push reminder", desc: "Pick your local time; we nudge you daily." },
          { title: "Typed questions", desc: "Boolean, number, scale, emoji, text." },
          { title: "Bullet journal export", desc: "CSV for quick coloring sessions." },
        ].map((item) => (
          <div key={item.title} className="bujo-question h-full">
            <p className="text-sm font-semibold text-gray-900">{item.title}</p>
            <p className="text-sm text-gray-700">{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
