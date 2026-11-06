import type { AvatarTone } from "@/domain/appProfiles";
import { getInitials } from "@/domain/profile";

const TONES: Record<AvatarTone, string> = {
  violet: "from-hero-from to-hero-to",
  teal: "from-[#0b7a80] to-[#2db4b9]",
  orange: "from-[#c2570a] to-[#eba13f]",
};

/**
 * Initials in a circle. There is no photo on purpose: it can't be uploaded or changed.
 * Pass `initials` when they shouldn't be taken from the name.
 */
export function Avatar({
  name,
  initials,
  tone = "violet",
  size = 72,
}: {
  name: string;
  initials?: string;
  tone?: AvatarTone;
  size?: number;
}) {
  return (
    <span
      role="img"
      aria-label={`Perfil de ${name}`}
      className={`flex shrink-0 items-center justify-center rounded-full bg-linear-135 font-semibold text-white ${TONES[tone]}`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials ?? getInitials(name)}
    </span>
  );
}
