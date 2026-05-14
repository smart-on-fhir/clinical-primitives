import { Children, createContext, useContext, useState } from 'react';
import './Tabs.scss';

// --- Context ------------------------------------------------------------------

type TabsContextValue = {
    activeIndex: number;
    setActiveIndex: (index: number) => void;
};

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext() {
    const ctx = useContext(TabsContext);
    if (!ctx) throw new Error('Tab components must be used within <Tabs>.');
    return ctx;
}

// --- Tabs (root) --------------------------------------------------------------

export function Tabs({
    children,
    defaultIndex = 0,
    className,
    ...rest
}: React.HTMLAttributes<HTMLDivElement> & { defaultIndex?: number }) {
    const [activeIndex, setActiveIndex] = useState(defaultIndex);

    return (
        <TabsContext.Provider value={{ activeIndex, setActiveIndex }}>
            <div className={['cp-tabs', className].filter(Boolean).join(' ')} {...rest}>
                {children}
            </div>
        </TabsContext.Provider>
    );
}

// --- TabBar ------------------------------------------------------------------

export function TabBar({
    children,
    className,
    ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div className={['cp-tabs-bar', className].filter(Boolean).join(' ')} {...rest}>
            {Children.map(children, (child, index) =>
                // Inject the positional index into each Tab
                child != null
                    ? <TabIndexContext.Provider key={index} value={index}>{child}</TabIndexContext.Provider>
                    : null
            )}
        </div>
    );
}

// --- TabContentsWrapper ------------------------------------------------------

export function TabsBody({
    children,
    className,
    ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div className={['cp-tabs-body', className].filter(Boolean).join(' ')} {...rest}>
            {Children.map(children, (child, index) =>
                child != null
                    ? <TabIndexContext.Provider key={index} value={index}>{child}</TabIndexContext.Provider>
                    : null
            )}
        </div>
    );
}

// --- Tab ---------------------------------------------------------------------

const TabIndexContext = createContext<number>(0);

export function Tab({
    children,
    className,
    ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
    const { activeIndex, setActiveIndex } = useTabsContext();
    const index = useContext(TabIndexContext);
    const isActive = activeIndex === index;

    return (
        <div
            className={['cp-tab', isActive ? 'cp-tab--active' : '', className].filter(Boolean).join(' ')}
            onClick={() => setActiveIndex(index)}
            role="tab"
            aria-selected={isActive}
            {...rest}
        >
            {children}
        </div>
    );
}

// --- TabContents -------------------------------------------------------------

export function TabContents({
    children,
    className,
    ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
    const { activeIndex } = useTabsContext();
    const index = useContext(TabIndexContext);
    const isActive = activeIndex === index;

    return (
        <div
            className={['cp-tab-contents', isActive ? 'cp-tab-contents--active' : '', className].filter(Boolean).join(' ')}
            hidden={!isActive}
            role="tabpanel"
            {...rest}
        >
            {children}
        </div>
    );
}
