import { STUDIO_MARK } from "@/lib/studio-mark";

export function StudioMark() {
  return (
    <svg className="mark" viewBox={STUDIO_MARK.viewBox} aria-hidden="true" focusable="false"
      fill="none" stroke="currentColor" strokeWidth={STUDIO_MARK.stroke}
      strokeLinecap="round" strokeLinejoin="round">
      {STUDIO_MARK.paths.map((path) => <path key={path} d={path} />)}
    </svg>
  );
}
