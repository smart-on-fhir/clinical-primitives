import "./Menu.scss";


export function MenuItem({
    children,
    icon,
    suffix,
}: {
    children: React.ReactNode
    icon?: React.ReactNode
    suffix?: React.ReactNode
}) {
    return (
        <div className="cp-menu-item">
            {icon && <div className="cp-menu-item-icon">
                {icon}
            </div> }
            <div className="cp-menu-item-content">
                {children}
            </div>
            {suffix && (
                <div className="cp-menu-item-suffix">
                    {suffix}
                </div>
            )}
        </div>
    )
}

export function MenuSeparator() {
    return (
        <div className="cp-menu-separator"/>
    )
}

export function MenuItemGroupHeader({ title, suffix }: { title: React.ReactNode, suffix?: React.ReactNode }) {
    return (
        <div className="cp-menu-item-group-header">
            <div>{title}</div>
            {suffix && <div>{suffix}</div>}
        </div>
    )
}   

export function Menu({ children }: { children: React.ReactNode }) {
    return (
        <div className="cp-menu">
            {children}
        </div>
    )
}