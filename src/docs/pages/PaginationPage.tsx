import { useState } from 'react';
import { Pagination } from '../../components/Pagination';

/**
 * What the paged things are called in the count beside the control.
 *
 * `Pagination` renders no count of its own, so this is not a prop — it is the
 * caller's word for its own data, and every caller picks its own.
 */
const ITEM_LABEL = "Items";

/** Enough items to page through, standing in for whatever a real list holds. */
const ITEMS = Array.from({ length: 47 }, (_, i) => `Observation #${i + 1}`);

/** Shows the offset a demo is currently on, since that is the whole state. */
function OffsetReadout({ offset, limit, total }: { offset: number, limit: number, total: number }) {
    return (
        <p className="cp-text-txt-5 mt-3">
            <code>offset={offset}</code> <code>limit={limit}</code> <code>total={total}</code>
            {' — '}page {Math.floor(offset / limit) + 1} of {Math.ceil(total / limit)}
        </p>
    );
}

export function PaginationPage() {
    const [offset, setOffset] = useState(0);
    const limit = 10;

    const [bigOffset, setBigOffset] = useState(0);

    const [total, setTotal] = useState(24);
    const [edgeOffset, setEdgeOffset] = useState(0);

    // Kept in range when `total` shrinks under the current offset, which would
    // otherwise leave the control paging past the end of its own data.
    const clampedEdgeOffset = Math.min(edgeOffset, Math.max(0, (Math.ceil(total / 10) - 1) * 10));

    return (
        <section>
            <header className="text-sky-500 uppercase mb-8">Pagination</header>

            <article className="mb-12">
                <h3 className="mb-2">Basics</h3>
                <p className="mb-4 cp-text-txt-5">
                    A controlled component with no state of its own. It takes{' '}
                    <code>offset</code>, <code>limit</code> and <code>total</code>, and reports a
                    new offset through <code>onChange</code> — it never holds the current page,
                    and never fetches anything. Slicing the data is the caller&apos;s job.
                </p>
                <div className="cp-fill-win-2 cp-rounded-md p-4">
                    <ul className="mb-3" style={{ paddingLeft: '1.2em', listStyle: 'disc' }}>
                        {ITEMS.slice(offset, offset + limit).map(item => (
                            <li key={item}>{item}</li>
                        ))}
                    </ul>
                    <Pagination
                        offset={offset}
                        limit={limit}
                        total={ITEMS.length}
                        onChange={setOffset}
                    />
                </div>
                <OffsetReadout offset={offset} limit={limit} total={ITEMS.length} />
            </article>

            <article className="mb-12">
                <h3 className="mb-2">The page window</h3>
                <p className="mb-4 cp-text-txt-5">
                    At most five page buttons are shown: the current page and two either side.
                    There is no ellipsis, no first/last jump, and no way to reach a distant page
                    in one step — on a thousand pages, page 500 is 500 clicks from page 1. Pair it
                    with a search or a filter rather than expecting the reader to walk there.
                </p>
                <div className="cp-fill-win-2 cp-rounded-md p-4">
                    <Pagination
                        offset={bigOffset}
                        limit={10}
                        total={10000}
                        onChange={setBigOffset}
                    />
                </div>
                <p className="cp-text-txt-5 mt-3">
                    Jump straight to a page to see the window move — something the control itself
                    cannot do:
                </p>
                <div className="flex gap-3 flex-wrap mt-2">
                    {[1, 2, 3, 50, 500, 999, 1000].map(page => (
                        <button
                            key={page}
                            className="px-3 py-1 cp-fill-win-2 cp-rounded-md"
                            onClick={() => setBigOffset((page - 1) * 10)}
                        >
                            Page {page}
                        </button>
                    ))}
                </div>
                <OffsetReadout offset={bigOffset} limit={10} total={10000} />
            </article>

            <article className="mb-12">
                <h3 className="mb-2">Edges</h3>
                <p className="mb-4 cp-text-txt-5">
                    Two behaviors worth knowing before this goes in a layout. With one page or
                    fewer the component renders <code>null</code> — nothing at all, not an empty
                    row — so a footer sized around it collapses. And the two arrows are not
                    symmetrical: on the first page the back arrow is <em>rendered but disabled</em>,
                    while on the last page the forward arrow is <em>not rendered</em>, so the
                    control changes width as you reach the end.
                </p>
                <div className="flex gap-4 items-center mb-4">
                    <label>
                        total:{' '}
                        <input
                            type="range"
                            min={0}
                            max={60}
                            value={total}
                            onChange={e => setTotal(Number(e.target.value))}
                        />
                    </label>
                    <span className="cp-text-txt-5">
                        {total} items = {Math.ceil(total / 10)} page{Math.ceil(total / 10) === 1 ? '' : 's'}
                    </span>
                </div>
                <div
                    className="cp-fill-win-2 cp-rounded-md p-4"
                    style={{ minHeight: '4rem', display: 'flex', alignItems: 'center' }}
                >
                    <Pagination
                        offset={clampedEdgeOffset}
                        limit={10}
                        total={total}
                        onChange={setEdgeOffset}
                    />
                    {Math.ceil(total / 10) < 2 && (
                        <span className="cp-text-txt-5">
                            (fewer than two pages — the component rendered nothing)
                        </span>
                    )}
                </div>
            </article>

            <article className="mb-12">
                <h3 className="mb-2">With a count</h3>
                <p className="mb-4 cp-text-txt-5">
                    The component shows page <em>buttons</em> only — no &quot;showing 1–10 of
                    47&quot;. Callers supply that themselves, either side of the control:{' '}
                    <code>StaticDataGrid</code> does exactly this in its footer. Reproduced here,
                    since a paginated list usually wants it:
                </p>
                <p className="mb-4 cp-text-txt-5">
                    The noun is the caller&apos;s to pick. <code>Items</code> suits most lists;{' '}
                    <code>StaticDataGrid</code> says <code>Rows</code> because it really is a
                    table, and a report might say <code>Results</code> or{' '}
                    <code>Observations</code>.
                </p>
                <div className="cp-fill-win-2 cp-rounded-md p-4">
                    <div className="flex items-center justify-between gap-4">
                        <span className="cp-text-txt-5">
                            {ITEM_LABEL} {offset + 1} to {Math.min(offset + limit, ITEMS.length)} of {ITEMS.length}
                        </span>
                        <Pagination
                            offset={offset}
                            limit={limit}
                            total={ITEMS.length}
                            onChange={setOffset}
                        />
                        <span className="cp-text-txt-5">
                            Page {Math.floor(offset / limit) + 1} of {Math.ceil(ITEMS.length / limit)}
                        </span>
                    </div>
                </div>
            </article>

            <article className="mb-12">
                <h3 className="mb-2">Notes</h3>
                <ul className="cp-text-txt-5" style={{ paddingLeft: '1.2em', listStyle: 'disc' }}>
                    <li className="mb-2">
                        The control fills its container: a flexible spacer at each end centers the
                        buttons, so it does not shrink to their width.
                    </li>
                    <li className="mb-2">
                        <code>offset</code> need not be a multiple of <code>limit</code> — the
                        current page is <code>Math.floor(offset / limit)</code> — but every page
                        button emits a clean multiple, so an offset that starts ragged snaps to
                        the grid on the first click.
                    </li>
                    <li className="mb-2">
                        <code>limit</code> is read, never changed. A rows-per-page selector has to
                        be built alongside it.
                    </li>
                    <li className="mb-2">
                        No <code>nav</code> element, no <code>aria-current</code> on the active
                        page, and the page buttons carry only their number as an accessible name.
                        The current page is distinguished by variant alone, so it does not
                        announce as current.
                    </li>
                </ul>
            </article>
        </section>
    );
}
