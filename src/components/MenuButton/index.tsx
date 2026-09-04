import { useRef } from "react"
import { ChevronDown } from "lucide-react"
import { Button, ButtonProps } from "../Button/Button"
import "./MenuButton.scss"

export function MenuButton({
    children,
    menu,
    menuPositionX = 'left',
    menuPositionY = 'bottom',
    ...props
}: {
    children: React.ReactNode
    menu: React.ReactNode
    menuPositionX?: "left" | "right" | "center",
    menuPositionY?: "top" | "bottom" | "middle"
} & Omit<ButtonProps, "children">) {
    // The panel, so a press can be asked whether it landed inside it. A ref
    // rather than a comparison against the event target: the panel has children
    // of its own, and only containment answers the question for all of them.
    const menuRef = useRef<HTMLDivElement>(null)

    return (
        <Button
            className="cp-menu-button"
            virtual
            {...props}
            onMouseDown={e => {
                // Composed rather than replaced: this handler is written after
                // the spread, so without this a caller's own onMouseDown would
                // be dropped without a word.
                props.onMouseDown?.(e)

                // A press inside the panel is a press on a menu item, not on
                // the trigger, and must leave the menu open.
                if (menuRef.current?.contains(e.target as Node)) {
                    return
                }

                // Open means focus is somewhere inside this button — on the
                // button itself, or on a control in the panel, since the
                // stylesheet opens on :focus-within as well as :focus. So the
                // test is containment, not identity, and closing has to blur
                // whatever actually holds focus rather than the button
                // unconditionally.
                //
                // Asking about the button specifically got both wrong: a menu
                // whose checkbox had been clicked could no longer be closed
                // from its own trigger.
                const active = document.activeElement

                if (active instanceof HTMLElement && e.currentTarget.contains(active)) {
                    // Before the default action can focus the button and
                    // reopen what this just closed.
                    e.preventDefault()
                    active.blur()
                }
            }}
        >
            {children}
            {/* <div style={{ background: "currentColor", marginLeft: "0.1em", marginRight: "0.1em", flex: "0 0 1px", height: "70%", opacity: 0.2 }} /> */}
            <ChevronDown size={12} style={{ opacity: 0.3 }} />
            <div ref={menuRef} className="cp-menu-button-menu" style={{
                left        : menuPositionX === 'left'   ? 0      : menuPositionX === 'center' ? '50%'  : 'auto',
                right       : menuPositionX === 'right'  ? 0      : 'auto',
                top         : menuPositionY === 'top'    ? 'auto' : menuPositionY === 'middle' ? '50%'  : '100%',
                bottom      : menuPositionY === 'bottom' ? 'auto' : menuPositionY === 'middle' ? 'auto' : '100%',
                marginTop   : menuPositionY === 'bottom' ? 2      : 0,
                marginBottom: menuPositionY === 'top'    ? 2      : 0,
                marginLeft  : menuPositionX === 'right'  ? 2      : 0,
                marginRight : menuPositionX === 'left'   ? 2      : 0,
                transform   : `${menuPositionX === 'center' ? 'translateX(-50%)' : ''} ${menuPositionY === 'middle' ? 'translateY(-50%)' : ''}`,
            }}>
                { menu }
            </div>
        </Button>
    )
}