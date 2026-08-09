import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>
const base = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }

export const BoltIcon = (p: IconProps) => <svg {...base} {...p}><path d="M13 2 5 14h6l-1 8 8-13h-6l1-7Z" /></svg>
export const FoodIcon = (p: IconProps) => <svg {...base} {...p}><path d="M6 3v7M3 3v5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V3M6 10v11M15 3v18M15 3c4 2 5 7 0 10" /></svg>
export const ScrapIcon = (p: IconProps) => <svg {...base} {...p}><path d="m14 6 4-4 4 4-4 4M2 14l5-5 8 8-5 5H2v-8Z" /><path d="m11 13 3-3" /></svg>
export const MoraleIcon = (p: IconProps) => <svg {...base} {...p}><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" /></svg>
export const ClockIcon = (p: IconProps) => <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
export const HelpIcon = (p: IconProps) => <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M9.7 9a2.4 2.4 0 1 1 3.4 2.2c-.8.4-1.1.9-1.1 1.8M12 17h.01" /></svg>
export const SoundIcon = ({ muted, ...p }: IconProps & { muted: boolean }) => <svg {...base} {...p}><path d="M11 5 6 9H3v6h3l5 4V5Z" />{muted ? <path d="m17 9 4 6M21 9l-4 6" /> : <><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18 6a8 8 0 0 1 0 12" /></>}</svg>
export const LightIcon = (p: IconProps) => <svg {...base} {...p}><path d="M9 18h6M10 22h4M8.5 14.5A6 6 0 1 1 15.5 14.5C14.4 15.3 14 16 14 18h-4c0-2-.4-2.7-1.5-3.5Z" /><path d="M12 2v2M4 10H2M22 10h-2M5 4l1.5 1.5M19 4l-1.5 1.5" /></svg>
