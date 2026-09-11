import { Menu, MenuItem, MenuItemGroupHeader, MenuSeparator } from '../../components/Menu';
import { CheckBox } from '../../components/CheckBox';
import { Badge } from '../../components/Badge/Badge';
import {
    Check,
    ClipboardCopy,
    Download,
    FileText,
    Pencil,
    Printer,
    Share2,
    Trash2
} from 'lucide-react';

/**
 * Menu is presentation only — it draws a panel and its rows, and knows nothing
 * about opening, closing, or what a row does when picked. Every example here is
 * therefore a static panel rendered inline, which is also the honest way to show
 * it: what you see is the whole component.
 */
export function MenuPage() {
    return (
        <section>
            <header className="text-sky-500 uppercase mb-8">Menu</header>

            <article className="mb-12">
                <h3 className="mb-2">Basics</h3>
                <p className="mb-4 cp-text-txt-5">
                    <code>Menu</code> is a styled panel; <code>MenuItem</code> is one row inside it.
                    Neither opens or closes anything — that belongs to whatever puts the menu
                    on screen. Pair it with <code>MenuButton</code> for a dropdown, or render it
                    inline as these examples do.
                </p>
                <div className="flex gap-6 flex-wrap items-start">
                    <Menu>
                        <MenuItem>Open</MenuItem>
                        <MenuItem>Rename</MenuItem>
                        <MenuItem>Duplicate</MenuItem>
                    </Menu>
                </div>
            </article>

            <article className="mb-12">
                <h3 className="mb-2">Icons and suffixes</h3>
                <p className="mb-4 cp-text-txt-5">
                    A row has three slots: <code>icon</code> on the left, the children in the
                    middle, and <code>suffix</code> on the right. The suffix takes any node, so it
                    carries shortcuts, counts, badges or a check mark equally well.
                </p>
                <div className="flex gap-6 flex-wrap items-start">
                    <Menu>
                        <MenuItem icon={<Pencil />}>Edit</MenuItem>
                        <MenuItem icon={<ClipboardCopy />} suffix={<code>⌘C</code>}>Copy</MenuItem>
                        <MenuItem icon={<Share2 />}>Share</MenuItem>
                        <MenuItem icon={<Trash2 />}>Delete</MenuItem>
                    </Menu>

                    <Menu>
                        <MenuItem suffix={<Check />}>Compact rows</MenuItem>
                        <MenuItem suffix={<Check />}>Show units</MenuItem>
                        <MenuItem>Show reference ranges</MenuItem>
                        <MenuItem suffix={<Badge>3</Badge>}>Flagged results</MenuItem>
                    </Menu>
                </div>
            </article>

            <article className="mb-12">
                <h3 className="mb-2">Grouping</h3>
                <p className="mb-4 cp-text-txt-5">
                    <code>MenuItemGroupHeader</code> labels a run of rows, and takes its own
                    optional <code>suffix</code>. <code>MenuSeparator</code> divides two runs
                    without naming either — reach for it when the grouping is obvious from the
                    rows themselves and a heading would only add noise.
                </p>
                <div className="flex gap-6 flex-wrap items-start">
                    <Menu>
                        <MenuItemGroupHeader title="Export" suffix={<span>4 rows</span>} />
                        <MenuItem icon={<FileText />}>CSV</MenuItem>
                        <MenuItem icon={<Download />}>JSON</MenuItem>

                        <MenuItemGroupHeader title="Report" />
                        <MenuItem icon={<Printer />}>Print summary</MenuItem>
                    </Menu>

                    <Menu>
                        <MenuItem>Zoom in</MenuItem>
                        <MenuItem>Zoom out</MenuItem>
                        <MenuSeparator />
                        <MenuItem>Fit to data</MenuItem>
                        <MenuItem>Reset</MenuItem>
                    </Menu>
                </div>
            </article>

            <article className="mb-12">
                <h3 className="mb-2">Rows the component does not supply</h3>
                <p className="mb-4 cp-text-txt-5">
                    <code>MenuItem</code> takes no <code>onClick</code>, <code>className</code> or{' '}
                    <code>disabled</code> prop, so a row that has to do something is written
                    directly against the <code>cp-menu-item</code> class instead. That is what{' '}
                    <code>DataGrid</code>&apos;s column picker does — its rows are{' '}
                    <code>&lt;label&gt;</code> elements, so clicking anywhere on one toggles its
                    checkbox.
                </p>
                <p className="mb-4 cp-text-txt-5">
                    The stylesheet also defines a <code>disabled</code> modifier that no prop
                    reaches; it is applied by hand below.
                </p>
                <div className="flex gap-6 flex-wrap items-start">
                    <Menu>
                        <MenuItemGroupHeader title="Visible columns" />
                        <label className="cp-menu-item">
                            <CheckBox defaultChecked className="mr-1" />
                            <span className='pe-1'>Date</span>
                        </label>
                        <label className="cp-menu-item">
                            <CheckBox defaultChecked className="mr-1" />
                            <span className='pe-1'>Analyte</span>
                        </label>
                        <label className="cp-menu-item">
                            <CheckBox className="mr-1" />
                            <span className='pe-1'>Reference range</span>
                        </label>
                    </Menu>

                    <Menu>
                        <MenuItem icon={<Pencil />}>Edit</MenuItem>
                        <div className="cp-menu-item disabled">
                            <div className="cp-menu-item-icon"><Trash2 /></div>
                            <div className="cp-menu-item-content">Delete</div>
                        </div>
                    </Menu>
                </div>
            </article>

            <article className="mb-12">
                <h3 className="mb-2">Notes</h3>
                <ul className="cp-text-txt-5" style={{ paddingLeft: '1.2em', listStyle: 'disc' }}>
                    <li className="mb-2">
                        The panel carries its own background, border, shadow and{' '}
                        <code>z-index: 100</code>, so it is ready to overlay whatever it is
                        rendered above without further styling.
                    </li>
                    <li className="mb-2">
                        <code>user-select: none</code> is set on the panel — rows are for picking,
                        not for reading text out of.
                    </li>
                    <li className="mb-2">
                        There is no keyboard handling and no <code>role</code>: this is not an
                        ARIA menu, and assistive tech sees a group of divs. Anything shipping to
                        users needs roles and arrow-key navigation added around it.
                    </li>
                </ul>
            </article>
        </section>
    );
}
