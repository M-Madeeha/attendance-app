import Image from "next/image";

export default function BrandLockup({ tone = "light" }) {
  const onDark = tone === "light";

  return (
    <div className="flex items-center gap-3">
      <Image
        src="/BtelLogo.jpg"
        alt="Btel"
        width={44}
        height={44}
        className="h-11 w-11 rounded-xl object-cover shadow-sm"
        priority
      />
      <div>
        <p className={`text-base font-semibold leading-none tracking-tight ${onDark ? "text-white" : "text-ink"}`}>
          Btel
        </p>
        <p className={`mt-1 text-xs ${onDark ? "text-white/65" : "text-slate-500"}`}>Attendance</p>
      </div>
    </div>
  );
}
