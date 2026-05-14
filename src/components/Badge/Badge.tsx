import './Badge.scss';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    variant?: 'danger' | 'warning' | 'success' | 'info' | 'neutral' | 'muted' | 'link';
    radius?: 'none' | 'sm' | 'md' | 'lg' | 'pill' | 'full';
    hard?: boolean;
};

export function Badge({ children, variant = 'neutral', radius = 'pill', hard = false, className, ...rest }: BadgeProps) {

    let classes = [
        'cp-badge',
        `cp-rounded-${radius}`,
        hard ? `cp-badge--${variant}-hard` : `cp-badge--${variant}`
    ];
    
    if (className) {
        classes.push(className);
    }

    return <span className={classes.join(' ')} {...rest}>{children}</span>;
}