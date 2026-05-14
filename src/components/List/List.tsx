import "./List.scss";

export function List({ children }: { children: React.ReactNode }) {
    return (
        <div className='cp-list scrollable'>
            {children}
        </div>
    );
}