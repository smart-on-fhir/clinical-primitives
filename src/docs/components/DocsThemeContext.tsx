import { createContext, useContext } from 'react';

export const DocsThemeContext = createContext<'light' | 'dark'>('light');

export function useDocsTheme() {
    return useContext(DocsThemeContext);
}
