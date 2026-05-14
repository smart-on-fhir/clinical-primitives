export function ListItem({
    children,
    onClick
}: {
    children?: React.ReactNode;
    onClick? : () => void;
}) {
    return (
        <div
            className='cp-list-item cp-py-4 cp-px-4 cp-gap-4'
            style={onClick ? { cursor: 'pointer' } : undefined}
            onClick={onClick}
        >
            {children}
        </div>
    );
}