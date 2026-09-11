import { Menu, MenuItem, MenuItemGroupHeader, MenuSeparator } from '../../components/Menu';
import { MenuButton } from '../../components/MenuButton';
import { CheckBox } from '../../components/CheckBox';
import { Cog, Download, FileText, MoreVertical, Pencil, Printer, Share2, Trash2 } from 'lucide-react';

const X_VALUES = ['left', 'center', 'right'] as const;
const Y_VALUES = ['bottom', 'middle', 'top'] as const;

/** The menu reused across the placement grid, so only the position varies. */
function SampleMenu() {
    return (
        <Menu>
            <MenuItem icon={<Pencil />}>Edit</MenuItem>
            <MenuItem icon={<Share2 />}>Share</MenuItem>
            <MenuItem icon={<Trash2 />}>Delete</MenuItem>
        </Menu>
    );
}

export function MenuButtonPage() {
    return (
        <section>
            <header className="text-sky-500 uppercase mb-8">MenuButton</header>

            <article className="mb-12">
                <h3 className="mb-2">Basics</h3>
                <p className="mb-4 cp-text-txt-5">
                    A <code>Button</code> that reveals a panel beneath it. The trigger&apos;s
                    content is the children; the panel is the <code>menu</code> prop, and is
                    usually a <code>Menu</code>. A chevron is appended automatically.
                </p>
                <p className="mb-4 cp-text-txt-5">
                    There is no open state to manage. The panel is shown by CSS on{' '}
                    <code>:focus</code> and <code>:focus-within</code>, so it opens when the
                    trigger takes focus and closes when focus leaves — clicking anywhere else on
                    the page dismisses it for free.
                </p>
                <p className="mb-4 cp-text-txt-5">
                    Pressing the trigger again closes it. That one case cannot come from CSS, so{' '}
                    <code>MenuButton</code> adds a single <code>mousedown</code> handler: if focus
                    is already inside the button, it blurs whatever holds it and prevents the
                    press from focusing the button back. A press landing inside the panel is
                    exempt — that is a menu item being chosen, not the trigger being pressed.
                </p>
                <div className="flex gap-4 flex-wrap items-start">
                    <MenuButton tabIndex={0} menu={<SampleMenu />}>Actions</MenuButton>
                    <MenuButton tabIndex={0} menu={<SampleMenu />}>
                        <Cog size="1.2em" />
                    </MenuButton>
                    <MenuButton tabIndex={0} menu={<SampleMenu />}>
                        <MoreVertical size="1.2em" />
                    </MenuButton>
                </div>
            </article>

            <article className="mb-12">
                <h3 className="mb-2">Button props pass through</h3>
                <p className="mb-4 cp-text-txt-5">
                    Everything but <code>children</code> is forwarded to <code>Button</code>, so{' '}
                    <code>variant</code>, <code>radius</code>, <code>hard</code> and{' '}
                    <code>disabled</code> all work as they do there. The component sets{' '}
                    <code>virtual</code> itself, which is what lets the panel escape the
                    button&apos;s own box.
                </p>
                <div className="flex gap-4 flex-wrap items-start">
                    <MenuButton tabIndex={0} variant="info" menu={<SampleMenu />}>Info</MenuButton>
                    <MenuButton tabIndex={0} variant="danger" menu={<SampleMenu />}>Danger</MenuButton>
                    <MenuButton tabIndex={0} variant="muted" menu={<SampleMenu />}>Muted</MenuButton>
                    <MenuButton tabIndex={0} radius="pill" menu={<SampleMenu />}>Pill</MenuButton>
                </div>
            </article>

            <article className="mb-12">
                <h3 className="mb-2">Placement</h3>
                <p className="mb-4 cp-text-txt-5">
                    <code>menuPositionX</code> and <code>menuPositionY</code> place the panel
                    against the trigger — nine combinations, defaulting to{' '}
                    <code>left</code>/<code>bottom</code>. The panel is positioned with plain CSS
                    offsets and is <strong>not</strong> flipped away from a window edge, so a
                    trigger near the right of the viewport wants{' '}
                    <code>menuPositionX=&quot;right&quot;</code> chosen by hand.
                </p>
                <div
                    className="grid gap-4"
                    style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', minHeight: '6rem' }}
                >
                    {Y_VALUES.map(y => X_VALUES.map(x => (
                        <div key={`${x}-${y}`} className="flex justify-center">
                            <MenuButton
                                tabIndex={0}
                                menuPositionX={x}
                                menuPositionY={y}
                                menu={<SampleMenu />}
                            >
                                {x} / {y}
                            </MenuButton>
                        </div>
                    )))}
                </div>
            </article>

            <article className="mb-12">
                <h3 className="mb-2">A settings menu</h3>
                <p className="mb-4 cp-text-txt-5">
                    The pattern <code>DataGrid</code> uses for its column picker: an icon
                    trigger anchored to the right, and rows written as <code>&lt;label&gt;</code>{' '}
                    elements so a click anywhere on the row reaches the checkbox. Because the
                    panel closes on blur, controls inside it have to be focusable — which
                    checkboxes are, so the menu stays open while they are used, and the trigger
                    still closes it afterwards.
                </p>
                <MenuButton
                    tabIndex={0}
                    menuPositionX="left"
                    menuPositionY="top"
                    menu={
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
                            <MenuSeparator />
                            <MenuItemGroupHeader title="Export" />
                            <MenuItem icon={<FileText />}>CSV</MenuItem>
                            <MenuItem icon={<Download />}>JSON</MenuItem>
                            <MenuItem icon={<Printer />}>Print</MenuItem>
                        </Menu>
                    }
                >
                    <Cog size="1.4em" />
                </MenuButton>
            </article>

            <article className="mb-12">
                <h3 className="mb-2">Notes</h3>
                <ul className="cp-text-txt-5" style={{ paddingLeft: '1.2em', listStyle: 'disc' }}>
                    <li className="mb-2">
                        <code>tabIndex={0}</code> is on every trigger here because the CSS opens
                        the panel on focus. A <code>&lt;button&gt;</code> is focusable already, so
                        this is belt and braces — but it is what the existing call site in{' '}
                        <code>DataGrid</code> does.
                    </li>
                    <li className="mb-2">
                        The panel is rendered inside the button rather than portalled, so it is
                        clipped by any ancestor with <code>overflow: hidden</code> and stacks
                        against ancestor stacking contexts. <code>Tooltip</code> takes the other
                        approach and portals to <code>document.body</code>.
                    </li>
                    <li className="mb-2">
                        No <code>role</code>, no <code>aria-expanded</code>, no arrow-key
                        navigation, and no Escape to close. As with <code>Menu</code>, this is
                        styling rather than a finished ARIA menu.
                    </li>
                    <li className="mb-2">
                        Because open state lives in the DOM&apos;s focus rather than in React,
                        nothing can open or close the menu programmatically — there is no{' '}
                        <code>open</code> prop and no <code>onOpenChange</code>. Calling{' '}
                        <code>focus()</code> on the button is the only handle.
                    </li>
                </ul>
            </article>
        </section>
    );
}
