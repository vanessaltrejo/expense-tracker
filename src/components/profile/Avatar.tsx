import { getInitials } from "@/domain/profile";

/** Initials in a circle. There is no photo on purpose: it can't be uploaded or changed. */
export function Avatar({ name, size = 72 }: { name: string; size?: number }) {
  return (
    <span
      role="img"
      aria-label={`Perfil de ${name}`}
      className="flex shrink-0 items-center justify-center rounded-full bg-linear-135 from-hero-from to-hero-to font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {getInitials(name)}
    </span>
  );
}
