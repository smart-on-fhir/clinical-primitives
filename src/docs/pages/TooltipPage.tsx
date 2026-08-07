import { useState } from 'react';

const X_VALUES = ['left', 'center', 'right'] as const;
const Y_VALUES = ['top', 'middle', 'bottom'] as const;

function Swatch({ children, ...rest }: { children: React.ReactNode } & Record<string, unknown>) {
    return (
        <span
            {...rest}
            tabIndex={0}
            className="inline-flex items-center justify-center px-3 py-2 cp-fill-win-2 cp-rounded-md cursor-default"
        >
            {children}
        </span>
    );
}

export function TooltipPage() {
    const [position, setPosition] = useState<'outside' | 'inside'>('outside');

    return (
        <section>
            <header className="text-sky-500 uppercase mb-8">Tooltip</header>

            <article className="mb-12">
                <h3 className="mb-2">Basics</h3>
                <p className="mb-4 cp-text-txt-5">
                    Render <code>&lt;Tooltip /&gt;</code> once near the root of the app. Every element
                    with a <code>data-tooltip</code> attribute is then picked up by delegation — including
                    markup that React did not render.
                </p>
                <div className="flex gap-3 flex-wrap">
                    <Swatch data-tooltip="A plain tooltip.">Default</Swatch>
                    <Swatch data-tooltip="Opens with no delay." data-tooltip-delay="0">No delay</Swatch>
                    <Swatch data-tooltip="Waits half a second." data-tooltip-delay="500">Slow</Swatch>
                    <Swatch data-tooltip="Pushed further from the anchor." data-tooltip-offset="20">Big offset</Swatch>
                </div>
            </article>

            <article className="mb-12">
                <h3 className="mb-2">Markdown content</h3>
                <p className="mb-4 cp-text-txt-5">
                    Content is parsed as a small Markdown subset and rendered as React nodes — never as an
                    HTML string — so tooltip text built from patient data cannot inject markup.
                </p>
                <div className="flex gap-3 flex-wrap">
                    <Swatch data-tooltip="**Bold**, *italic* and ~~struck~~ text.">Emphasis</Swatch>
                    <Swatch data-tooltip="Serum `sodium` measured in `mmol/L`.">Code</Swatch>
                    <Swatch data-tooltip={'**Reference range**\n- Low: < 135\n- Normal: 135–145\n- High: > 145'}>
                        List
                    </Swatch>
                    <Swatch data-tooltip={'First paragraph of the explanation.\n\nSecond paragraph, after a blank line.'}>
                        Paragraphs
                    </Swatch>
                    <Swatch data-tooltip="Literal \*asterisks\* via backslash escapes.">Escaping</Swatch>
                    <Swatch data-tooltip="<img src=x onerror=alert(1)> is shown as plain text, not parsed as HTML.">
                        Not HTML
                    </Swatch>
                </div>
            </article>

            <article className="mb-12">
                <h3 className="mb-2">Placement</h3>
                <p className="mb-4 cp-text-txt-5">
                    <code>data-tooltip-x</code> and <code>data-tooltip-y</code> pick one of nine anchor
                    points; <code>data-tooltip-position</code> puts the bubble outside the element (default)
                    or overlaid inside it.
                </p>

                <div className="mb-4 flex gap-4">
                    {(['outside', 'inside'] as const).map(value => (
                        <label key={value}>
                            <input
                                type="radio"
                                name="tooltip-position"
                                checked={position === value}
                                onChange={() => setPosition(value)}
                            />{' '}
                            {value}
                        </label>
                    ))}
                </div>

                <div className="inline-grid grid-cols-3 gap-2">
                    {Y_VALUES.map(y =>
                        X_VALUES.map(x => (
                            <span
                                key={`${x}-${y}`}
                                tabIndex={0}
                                data-tooltip={`x = **${x}**\ny = **${y}**`}
                                data-tooltip-x={x}
                                data-tooltip-y={y}
                                data-tooltip-position={position}
                                className="px-4 py-6 cp-fill-win-2 cp-rounded-md text-center cursor-default"
                                style={{ minWidth: '9em' }}
                            >
                                {y} / {x}
                            </span>
                        ))
                    )}
                </div>
            </article>

            <article className="mb-12">
                <h3 className="mb-2">Following the pointer</h3>
                <p className="mb-4 cp-text-txt-5">
                    Either axis accepts <code>pointer</code>, which tracks the cursor instead of the
                    element's box. Wide targets need this — anchoring to the center of a bar that spans
                    the screen points somewhere the user isn't looking. Hover-only: a click- or
                    focus-opened tooltip has no cursor to follow and falls back to the axis default.
                </p>
                <div className="flex flex-col gap-3">
                    <span
                        tabIndex={0}
                        data-tooltip="Follows you horizontally, stays above the bar."
                        data-tooltip-x="pointer"
                        className="px-3 py-4 cp-fill-win-2 cp-rounded-md cursor-default text-center"
                    >
                        x = pointer — a wide target, like a timeline bar
                    </span>
                    <span
                        tabIndex={0}
                        data-tooltip="Both axes follow the cursor."
                        data-tooltip-x="pointer"
                        data-tooltip-y="pointer"
                        className="px-3 py-8 cp-fill-win-2 cp-rounded-md cursor-default text-center"
                    >
                        x = pointer, y = pointer — follows freely
                    </span>
                    <span
                        tabIndex={0}
                        data-tooltip="Pinned to the element, because click has no cursor to track."
                        data-tooltip-x="pointer"
                        data-tooltip-trigger="click"
                        className="px-3 py-4 cp-fill-win-2 cp-rounded-md cursor-default text-center"
                    >
                        x = pointer with trigger = click — falls back to centered
                    </span>
                </div>
            </article>

            <article className="mb-12">
                <h3 className="mb-2">Anchoring elsewhere</h3>
                <p className="mb-4 cp-text-txt-5">
                    <code>data-tooltip-anchor</code> takes a CSS selector for the element the bubble should
                    point at, which need not be the one that triggered it. Hovering anywhere in the box below
                    opens a tooltip anchored to the small square, not to the box. The selector is resolved
                    inside the trigger first, so repeated instances on a page each find their own child
                    rather than all matching the first in document order.
                </p>
                <div
                    tabIndex={0}
                    data-tooltip="Anchored to the square, triggered by the whole box."
                    data-tooltip-anchor=".tooltip-anchor-demo-target"
                    className="cp-rounded-md p-6 flex justify-end cp-fill-win-2 cursor-default"
                >
                    <span
                        className="tooltip-anchor-demo-target cp-rounded-md"
                        style={{ width: "2rem", height: "2rem", background: "var(--cp-color-blue)" }}
                    />
                </div>
            </article>

            <article className="mb-12">
                <h3 className="mb-2">Triggers</h3>
                <p className="mb-4 cp-text-txt-5">
                    <code>data-tooltip-trigger</code> accepts <code>mouseover</code> (default),{' '}
                    <code>click</code> or <code>focus</code>. Hover and focus tooltips also open on keyboard
                    focus; click tooltips latch open, accept the pointer so their text can be selected, and
                    close on Escape or an outside click.
                </p>
                <div className="flex gap-3 flex-wrap">
                    <Swatch data-tooltip="Shown while the pointer is over me.">mouseover</Swatch>
                    <Swatch data-tooltip="Latched open until you click away or press Escape." data-tooltip-trigger="click">
                        click
                    </Swatch>
                    <Swatch data-tooltip="Tab to me to see this." data-tooltip-trigger="focus">focus</Swatch>
                    <label className="inline-flex items-center gap-2">
                        Native input:
                        <input
                            type="text"
                            placeholder="focus me"
                            data-tooltip="Works on **form controls** too."
                            data-tooltip-trigger="focus"
                            className="px-2 py-1 cp-fill-win-2 cp-rounded-md"
                        />
                    </label>
                </div>
            </article>

            <article className="mb-12">
                <h3 className="mb-2">Escaping overflow</h3>
                <p className="mb-4 cp-text-txt-5">
                    The bubble is portaled into <code>document.body</code>, so it is not clipped by scrolling
                    or <code>overflow: hidden</code> ancestors. Scroll the box — the tooltip follows its
                    anchor and flips when it runs out of room.
                </p>
                <div
                    className="cp-rounded-md p-4"
                    style={{ height: '12rem', overflow: 'auto', border: '1px solid var(--cp-color-win-4)' }}
                >
                    <div style={{ height: '30rem', display: 'flex', flexDirection: 'column', gap: '3rem' }}>
                        <Swatch data-tooltip="Near the top of the scroll box.">Top anchor</Swatch>
                        <Swatch data-tooltip="Halfway down — scroll me around.">Middle anchor</Swatch>
                        <Swatch data-tooltip="This one flips below when there is no room above.">Bottom anchor</Swatch>
                    </div>
                </div>
            </article>

            <article className="mb-12">
                <h3 className="mb-2">Constrained viewport</h3>
                <p className="mb-4 cp-text-txt-5">
                    <code>data-tooltip-viewport</code> takes a CSS selector for the region the tooltip must
                    stay inside. Here it is the bordered panel rather than the window, so tooltips flip and
                    clamp at the panel edges.
                </p>
                <div
                    id="tooltip-viewport-demo"
                    className="cp-rounded-md p-4 flex justify-between items-center"
                    style={{ height: '10rem', border: '1px solid var(--cp-color-sky, var(--cp-color-blue))' }}
                >
                    {(['left', 'center', 'right'] as const).map(x => (
                        <span
                            key={x}
                            tabIndex={0}
                            data-tooltip={`Confined to the panel.\n\nThis text is long enough that it would overflow the panel edge if it were not clamped.`}
                            data-tooltip-viewport="#tooltip-viewport-demo"
                            data-tooltip-x={x}
                            className="px-3 py-2 cp-fill-win-2 cp-rounded-md cursor-default"
                        >
                            {x}
                        </span>
                    ))}
                </div>
            </article>

            <article className="mb-12">
                <h3 className="mb-2">Attribute reference</h3>
                <table className="w-full text-left">
                    <thead>
                        <tr className="cp-text-txt-5">
                            <th className="py-2 pr-4">Attribute</th>
                            <th className="py-2 pr-4">Values</th>
                            <th className="py-2">Default</th>
                        </tr>
                    </thead>
                    <tbody>
                        {[
                            ['data-tooltip',           'Markdown text — bold, italic, code, strike, lists, paragraphs', '—'],
                            ['data-tooltip-x',         'left | center | right | pointer',  'center'],
                            ['data-tooltip-y',         'top | middle | bottom | pointer',  'top'],
                            ['data-tooltip-position',  'inside | outside',            'outside'],
                            ['data-tooltip-trigger',   'mouseover | click | focus',   'mouseover'],
                            ['data-tooltip-viewport',  'CSS selector',                'the window'],
                            ['data-tooltip-anchor',    'CSS selector for the element to point at', 'the trigger itself'],
                            ['data-tooltip-delay',     'milliseconds',                '100'],
                            ['data-tooltip-offset',    'pixels',                      '8'],
                            ['data-tooltip-max-width', 'CSS length',                  '20rem'],
                            ['data-tooltip-class',     'extra class name on the bubble', '—'],
                        ].map(([attribute, values, fallback]) => (
                            <tr key={attribute} style={{ borderTop: '1px solid var(--cp-color-win-3)' }}>
                                <td className="py-2 pr-4"><code>{attribute}</code></td>
                                <td className="py-2 pr-4 cp-text-txt-5">{values}</td>
                                <td className="py-2 cp-text-txt-5">{fallback}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </article>
        </section>
    );
}
