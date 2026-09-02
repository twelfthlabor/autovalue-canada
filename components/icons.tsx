const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true as const,
};

export function InfoIcon({ size = 13 }: { size?: number }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} {...base}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.5v.5" /></svg>;
}

export function CheckCircleIcon({ size = 15 }: { size?: number }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} {...base} strokeWidth={1.9}><circle cx="12" cy="12" r="9" /><path d="M8.6 12.2l2.2 2.2 4.4-4.8" /></svg>;
}

export function CalendarIcon({ size = 16 }: { size?: number }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} {...base}><rect x="4" y="5.5" width="16" height="14.5" rx="2.5" /><path d="M8 3.5v4M16 3.5v4M4 10h16" /></svg>;
}

export function BarsIcon({ size = 16 }: { size?: number }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} {...base}><path d="M5 20V13M12 20V5M19 20v-9" /></svg>;
}

export function DollarIcon({ size = 16 }: { size?: number }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} {...base}><circle cx="12" cy="12" r="9" /><path d="M12 6.5v11M14.8 8.8c-.5-1-1.5-1.5-2.8-1.5-1.6 0-2.8.9-2.8 2.2 0 2.9 5.6 1.5 5.6 4.4 0 1.3-1.2 2.2-2.8 2.2-1.3 0-2.4-.6-2.9-1.6" /></svg>;
}

export function ShieldIcon({ size = 16 }: { size?: number }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} {...base}><path d="M12 3l7 3v5c0 4.4-3 8.4-7 10-4-1.6-7-5.6-7-10V6l7-3z" /></svg>;
}

export function ShieldCheckIcon({ size = 20 }: { size?: number }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} {...base} strokeWidth={1.8}><path d="M12 3l7 3v5c0 4.4-3 8.4-7 10-4-1.6-7-5.6-7-10V6l7-3z" /><path d="M9.2 12.2l2 2 3.6-4" /></svg>;
}

export function AnchorIcon({ size = 18 }: { size?: number }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} {...base}><circle cx="12" cy="5.5" r="2.2" /><path d="M12 7.7V20M5 12H2.8A9.2 9.2 0 0012 20a9.2 9.2 0 009.2-8H19M8.5 12h7" /></svg>;
}

export function PulseIcon({ size = 18 }: { size?: number }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} {...base}><path d="M3 12h3.5l2.5-6 4 12 2.5-6H21" /></svg>;
}

export function TargetIcon({ size = 18 }: { size?: number }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} {...base}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" /></svg>;
}

export function TrendUpIcon({ size = 16 }: { size?: number }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} {...base}><path d="M3.5 17l5.5-6 4 3.5L20.5 7" /><path d="M15.5 7h5v5" /></svg>;
}

export function PercentIcon({ size = 16 }: { size?: number }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} {...base}><path d="M18.5 5.5l-13 13" /><circle cx="7.5" cy="7.5" r="2.6" /><circle cx="16.5" cy="16.5" r="2.6" /></svg>;
}

export function LockIcon({ size = 16 }: { size?: number }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} {...base}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></svg>;
}

export function ArrowRightIcon({ size = 16 }: { size?: number }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} {...base} strokeWidth={1.9}><path d="M4 12h15M13.5 5.5L20 12l-6.5 6.5" /></svg>;
}

export function CodeIcon({ size = 18 }: { size?: number }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} {...base}><path d="M8 7l-4.5 5L8 17M16 7l4.5 5L16 17" /></svg>;
}

export function PencilIcon({ size = 18 }: { size?: number }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} {...base}><path d="M4 20l1-4.5L16.5 4a1.9 1.9 0 012.8 0l.7.7a1.9 1.9 0 010 2.8L8.5 19 4 20z" /><path d="M14.5 6l3.5 3.5" /></svg>;
}

export function CpuIcon({ size = 18 }: { size?: number }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} {...base}><rect x="6" y="6" width="12" height="12" rx="2.5" /><rect x="10" y="10" width="4" height="4" /><path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" /></svg>;
}

export function PlugIcon({ size = 20 }: { size?: number }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} {...base} strokeWidth={1.8}><path d="M9 3v5M15 3v5" /><path d="M6.5 8h11v3.5a5.5 5.5 0 01-11 0V8zM12 17v4" /></svg>;
}

export function CurveIcon({ size = 22 }: { size?: number }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} {...base}><path d="M3 18.5c4.5 0 5-13 9-13s4.5 13 9 13" /><path d="M12 15.5v.5" /></svg>;
}

export function PersonIcon({ size = 22 }: { size?: number }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} {...base}><circle cx="12" cy="8" r="3.6" /><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" /></svg>;
}
