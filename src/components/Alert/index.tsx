import './Alert.scss';

interface AlertProps extends React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
    variant?: 'danger' | 'warning' | 'success' | 'info' | 'neutral' | 'muted' | 'link';
    radius?: 'none' | 'sm' | 'md' | 'lg' | 'full' | 'pill';
    hard?: boolean;
    virtual?: boolean;
};

export function Alert({ children, variant = 'neutral', radius = 'lg', hard = false, virtual = false, className, ...rest }: AlertProps) {

    let classes = [
        'cp-alert',
        `cp-rounded-${radius}`,
        hard ? `cp-alert--${variant}-hard` : `cp-alert--${variant}`,
        virtual ? 'cp-alert--virtual' : ''
    ];

    if (className) {
        classes.push(className);
    }

    return <div className={classes.join(' ')} {...rest}>{children}</div>;
}