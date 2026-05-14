import { useId, useLayoutEffect, useRef, useState } from 'react';
import { SparklineSeries } from './utils';
import './Sparkline.scss';


const COLOR_DANGER  = "hsl(0, 100%, 45%)";
const COLOR_WARNING = "hsl(30, 100%, 45%)";
const COLOR_OK      = "hsl(120, 100%, 35%)";
const COLOR_NEUTRAL = "var(--cp-color-txt-2)";


function parsePoints(points: string): { x: number; y: number }[] {
    return points.trim().split(/\s+/).filter(Boolean).map(pt => {
        const [x, y] = pt.split(',').map(Number);
        return { x, y };
    });
}

/**
 * Renders one or more sparkline series as an inline SVG.
 *
 * The SVG always fills its container width. A ResizeObserver tracks the
 * actual pixel width so strokes, dots, and gradients are drawn at true pixel
 * sizes rather than stretching with the viewBox.
 *
 * Visual sizing
 * -------------
 * • `height` + `aspectRatio` — both set: SVG is a fixed pixel size (width = height × ratio); no container measurement.
 * • `height` only            — SVG fills container width at the specified height.
 * • `aspectRatio` only       — SVG fills container width; height = width ÷ ratio (default ratio: 3).
 * • neither                  — fills container width with a 3:1 aspect ratio.
 *
 * Coordinate space
 * ----------------
 * Points can use any numeric coordinate space; the component scales automatically.
 * `dataPaddingX` / `dataPaddingY` (default 0.1) add proportional whitespace beyond the
 * data extents so points aren't clipped at the edges.
 *
 * When a series has a dot, the polyline stroke uses a linear gradient that is
 * fully opaque at the dot's x position and fades toward both ends.
 */
export function Sparkline({
    series,
    dataPaddingX = 0.02,
    dataPaddingY = 0.02,
    height,
    aspectRatio,
}: {
    series: SparklineSeries[]
    /** Proportional padding added before the min and after the max x value. Default 0.02 (2%). */
    dataPaddingX?: number
    /** Proportional padding added before the min and after the max y value. Default 0.02 (2%). */
    dataPaddingY?: number
    /** Fix the SVG to exactly this many pixels tall. */
    height?:      number
    /**
     * Width ÷ height display ratio. Default 3.
     * When combined with `height`, the SVG renders at a fixed pixel size (width = height × ratio)
     * instead of stretching to fill the container.
     */
    aspectRatio?: number
}) {
    const uid          = useId().replace(/:/g, '');
    const containerRef = useRef<HTMLDivElement>(null);

    // Parse all series points up front for extent calculations.
    const parsed = series.map(s => parsePoints(s.points));
    const allXs  = parsed.flat().map(p => p.x);
    const allYs  = parsed.flat().map(p => p.y);
    const minX   = allXs.length ? Math.min(...allXs) : 0;
    const maxX   = allXs.length ? Math.max(...allXs) : 1;
    const xRange = maxX - minX || 1;
    const minY   = allYs.length ? Math.min(...allYs) : 0;
    const maxY   = allYs.length ? Math.max(...allYs) : 1;
    const yRange = maxY - minY;

    // When both height and aspectRatio are provided the SVG has a fixed pixel size —
    // no need to measure the container.
    const fixedSize = height !== undefined && aspectRatio !== undefined;

    // Track the container's actual pixel width so we can draw at true pixel
    // sizes. Start at 0 and measure synchronously before first paint.
    const [measuredW, setMeasuredW] = useState(0);

    useLayoutEffect(() => {
        if (fixedSize) return;
        const el = containerRef.current;
        if (!el) return;
        // Measure immediately (sync) so first paint uses real width.
        const w = Math.round(el.getBoundingClientRect().width);
        if (w > 0) setMeasuredW(w);
        const ro = new ResizeObserver(entries => {
            const rw = Math.round(entries[0].contentRect.width);
            if (rw > 0) setMeasuredW(rw);
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, [fixedSize]);

    const ratio  = aspectRatio ?? 5;
    const svgH   = height ?? Math.round(measuredW / ratio);
    const svgW   = fixedSize ? Math.round(height! * ratio) : measuredW;

    // Scale functions: map coordinate-space values to SVG pixels,
    // with padding applied on both sides of the data range.
    const padX   = dataPaddingX * xRange;
    const padY   = dataPaddingY * (yRange < 0.001 ? 1 : yRange);
    const scaleX = (x: number) => (x - minX + padX) / (xRange + 2 * padX) * svgW;
    const scaleY = (y: number) =>
        yRange < 0.001 ? svgH / 2 : svgH - ((y - minY + padY) / (yRange + 2 * padY)) * svgH;

    // --- Per-series range color zones ---
    const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
    const computeRangeZone = (range: [number, number] | number | undefined) => {
        if (range === undefined || typeof range === 'number') return null;
        const [r0, r1] = range;
        const rMin = Math.min(r0, r1);
        const rMax = Math.max(r0, r1);
        const span = rMax - rMin;
        const effectiveSpan = span > 1e-6 ? span : Math.max(yRange * 0.15, 1e-6);
        return {
            fOrangeTop: clamp01(scaleY(rMax + 1.5 * effectiveSpan) / svgH),
            fGreenTop:  clamp01(scaleY(rMax)                       / svgH),
            fGreenBot:  clamp01(scaleY(rMin)                       / svgH),
            fOrangeBot: clamp01(scaleY(rMin - 1.5 * effectiveSpan) / svgH),
            rMin, rMax, effectiveSpan,
        };
    };
    const dotZoneColorFor = (rz: NonNullable<ReturnType<typeof computeRangeZone>>, y: number): string => {
        const { rMin, rMax, effectiveSpan } = rz;
        if (y >= rMin && y <= rMax) return COLOR_OK;
        const dist = y < rMin ? rMin - y : y - rMax;
        if (dist <= 1.5 * effectiveSpan) return COLOR_WARNING;
        return COLOR_DANGER;
    };

    // Dot positions in absolute SVG pixels (cx/cy ready to use directly).
    const scaled = series.map((s, si) => {
        const rz = computeRangeZone(s.range);
        return {
            ...s,
            points: parsed[si]
                .map(({ x, y }) => `${scaleX(x).toFixed(1)},${scaleY(y).toFixed(1)}`)
                .join(' '),
            dot: s.dot ? {
                fracX: scaleX(s.dot.x) / svgW,
                cx: scaleX(s.dot.x),
                cy: scaleY(s.dot.y),
                coordY: s.dot.y,
                r: s.dot.r ?? 3,
            } : null,
            rangeZone: rz,
            color: s.color || (rz ? 'auto' : COLOR_NEUTRAL),
        };
    });

    const labels = scaled
        .filter(s => s.label)
        .map(s => ({
            label: s.label,
            color: s.color === 'auto' ? COLOR_OK : s.color,
        }));

    return (
        <div className="cp-sparkline" ref={containerRef}>
            {svgW === 0 ? null : (<>
            <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: fixedSize ? svgW : '100%', display: 'block', overflow: 'visible' }}>
                <defs>
                    {scaled.map((s, i) => {
                        const dot = s.dot;
                        const nodes: React.ReactNode[] = [];

                        const useRangeColor = s.rangeZone && (!s.color || s.color === 'auto');
                        if (useRangeColor) {
                            // Vertical gradient encodes the clinical color zones.
                            // Stops are ordered top→bottom (low SVG y → high SVG y).
                            nodes.push(
                                <linearGradient
                                    key={`rg-${i}`}
                                    id={`${uid}rg${i}`}
                                    gradientUnits="userSpaceOnUse"
                                    x1="0" y1="0" x2="0" y2={svgH}
                                >
                                    <stop offset={0}                                                     stopColor={COLOR_DANGER} />
                                    <stop offset={s.rangeZone!.fOrangeTop}                               stopColor={COLOR_WARNING} />
                                    <stop offset={(s.rangeZone!.fGreenTop + s.rangeZone!.fGreenBot) / 2} stopColor={COLOR_OK} />
                                    <stop offset={s.rangeZone!.fOrangeBot}                               stopColor={COLOR_WARNING} />
                                    <stop offset={1}                                                     stopColor={COLOR_DANGER} />
                                </linearGradient>
                            );
                            if (dot) {
                                // Horizontal opacity-fade gradient used as the mask's fill.
                                nodes.push(
                                    <linearGradient
                                        key={`fg-${i}`}
                                        id={`${uid}fg${i}`}
                                        gradientUnits="userSpaceOnUse"
                                        x1="0" y1="0" x2={svgW} y2="0"
                                    >
                                        <stop offset={0}          stopColor="white" stopOpacity={0.12} />
                                        <stop offset={dot.fracX}  stopColor="white" stopOpacity={1}    />
                                        <stop offset={1}          stopColor="white" stopOpacity={0.12} />
                                    </linearGradient>
                                );
                                // Mask: fade gradient background + dot-hole cutout.
                                nodes.push(
                                    <mask key={`m-${i}`} id={`${uid}m${i}`}
                                        maskUnits="userSpaceOnUse"
                                        x={-svgW} y={-svgH} width={svgW * 3} height={svgH * 3}
                                    >
                                        <rect x={-svgW} y={-svgH} width={svgW * 3} height={svgH * 3}
                                              fill={`url(#${uid}fg${i})`} />
                                        <circle cx={dot.cx} cy={dot.cy} r={dot.r * 1.5} fill="black" />
                                    </mask>
                                );
                            }
                        } else if (dot) {
                            // Original behavior: color+opacity fade in a single horizontal gradient.
                            nodes.push(
                                <linearGradient
                                    key={`grad-${i}`}
                                    id={`${uid}g${i}`}
                                    x1="0" y1="0" x2={svgW} y2="0"
                                    gradientUnits="userSpaceOnUse"
                                >
                                    <stop offset={0}           style={{ stopColor: s.color, stopOpacity: 0.12 }} />
                                    <stop offset={dot.fracX}   style={{ stopColor: s.color, stopOpacity: s.opacity }} />
                                    <stop offset={1}           style={{ stopColor: s.color, stopOpacity: 0.12 }} />
                                </linearGradient>
                            );
                            nodes.push(
                                <mask key={`mask-${i}`} id={`${uid}m${i}`}
                                    maskUnits="userSpaceOnUse"
                                    x={-svgW} y={-svgH} width={svgW * 3} height={svgH * 3}
                                >
                                    <rect x={-svgW} y={-svgH} width={svgW * 3} height={svgH * 3} fill="white" />
                                    <circle cx={dot.cx} cy={dot.cy} r={dot.r * 1.5} fill="black" />
                                </mask>
                            );
                        }

                        return nodes;
                    })}
                </defs>

                {scaled.map((s, i) => {
                    if (s.range === undefined) return null;
                    const r = s.range;
                    if (typeof r === 'number') {
                        const y = scaleY(r);
                        if (y < 0 || y > svgH) return null;
                        return <line key={`rl-${i}`} x1={0} y1={y} x2={svgW} y2={y} stroke={COLOR_NEUTRAL} strokeOpacity={0.3} strokeWidth={0.5} strokeDasharray="2,1" />;
                    }
                    const [r0, r1] = r;
                    const top    = Math.max(0,    Math.min(scaleY(r0), scaleY(r1)));
                    const bottom = Math.min(svgH, Math.max(scaleY(r0), scaleY(r1)));
                    if (top >= svgH || bottom <= 0 || bottom <= top) return null;
                    return (
                        <g key={`rl-${i}`}>
                            <line stroke={COLOR_NEUTRAL} strokeOpacity={0.3} strokeWidth={0.5} strokeDasharray="2,1" x1={0} y1={top}    x2={svgW} y2={top} />
                            <line stroke={COLOR_NEUTRAL} strokeOpacity={0.3} strokeWidth={0.5} strokeDasharray="2,1" x1={0} y1={bottom} x2={svgW} y2={bottom} />
                        </g>
                    );
                })}


                {scaled.map((s, i) => (
                    <polyline
                        key={i}
                        points={s.points}
                        fill="none"
                        stroke={
                            s.rangeZone && (!s.color || s.color === 'auto') ? `url(#${uid}rg${i})` :
                            s.dot                                           ? `url(#${uid}g${i})`  :
                            s.color
                        }
                        strokeWidth={s.lineWidth ?? 2}
                        strokeLinejoin="round"
                        strokeOpacity={s.dot ? 1 : s.opacity}
                        mask={s.dot ? `url(#${uid}m${i})` : undefined}
                        style={{ filter: 'drop-shadow(0px 1px 0.5px rgba(0,0,0,0.2))' }}
                    />
                ))}

                {scaled.map((s, i) => s.dot && (
                    <circle
                        key={`dot-${i}`}
                        cx={s.dot.cx}
                        cy={s.dot.cy}
                        r={s.dot.r}
                        fill={s.rangeZone && (!s.color || s.color === 'auto') && s.dot
                            ? dotZoneColorFor(s.rangeZone, s.dot.coordY)
                            : s.color}
                        fillOpacity={s.opacity}
                    />
                ))}
            </svg>
            <div className='cp-sparkline-labels'>
                {labels.map((l, i) => <span key={i}><span style={{ color: l.color }}>◼︎</span><span style={{ fontSize: '75%' }}>{l.label}</span></span>)}
            </div>
            </>)}
        </div>
    );
}
