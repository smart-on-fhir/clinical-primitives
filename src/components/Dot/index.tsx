interface DotProps extends React.HTMLAttributes<HTMLSpanElement> {
    color?: string;
}

export function Dot({ color = 'var(--cp-color-win-7)', style, ...props }: DotProps) {
    return <span style={{
        display: 'inline-block',
        width: '0.75em',
        height: '0.75em',
        borderRadius: '50%',
        border: `1px solid rgba(from ${color} r g b / 0.75)`,
        backgroundColor: `rgba(from ${color} r g b / 0.5)`,
        position: 'relative',
        top: '0.1em',
        ...style,
    }} {...props} />;
}
