import './Button.scss';

interface ButtonProps extends React.HTMLAttributes<HTMLButtonElement> {
    variant?: 'danger' | 'warning' | 'success' | 'info' | 'neutral' | 'muted' | 'link';
    radius?: 'none' | 'sm' | 'md' | 'lg' | 'full' | 'pill';
    hard?: boolean;
    virtual?: boolean;
};

export function Button({ children, variant = 'neutral', radius = 'lg', hard = false, virtual = false, className, ...rest }: ButtonProps) {

    let classes = [
        'cp-button',
        `cp-rounded-${radius}`,
        hard ? `cp-button--${variant}-hard` : `cp-button--${variant}`,
        virtual ? 'cp-button--virtual' : ''
    ];

    if (className) {
        classes.push(className);
    }

    return <button className={classes.join(' ')} {...rest}>{children}</button>;
}