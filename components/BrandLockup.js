export default function BrandLockup({ tone = "light" }) {
  const onDark = tone === "light";

  return (
    <div className="flex flex-col items-center gap-1.5">
      <span
        className={
          onDark
            ? "inline-flex items-center"
            : "inline-flex items-center rounded-lg bg-ink px-2.5 py-2 dark:bg-transparent dark:px-0 dark:py-0"
        }
      >
        <img src="/btel-logo.svg" alt="Btel" className="h-6 w-auto" />
      </span>
      <p className={`text-xs font-medium ${onDark ? "text-white/70" : "text-slate-500"}`}>Attendance</p>
    </div>
  );
}
