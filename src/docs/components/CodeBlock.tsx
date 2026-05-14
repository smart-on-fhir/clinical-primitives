import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { oneDark }  from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useDocsTheme } from './DocsThemeContext';

SyntaxHighlighter.registerLanguage('tsx', tsx);

interface CodeBlockProps {
    children: string;
    language?: string;
}

export function CodeBlock({ children, language = 'tsx' }: CodeBlockProps) {
    const isDark = useDocsTheme() === 'dark';

    return (
        <SyntaxHighlighter
            language={language}
            style={isDark ? oneDark : oneLight}
            customStyle={{
                borderRadius: '0.5rem',
                marginBottom: '2rem',
                fontSize  : '0.875rem',
            }}
        >
            {children}
        </SyntaxHighlighter>
    );
}
