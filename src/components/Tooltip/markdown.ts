import { createElement, Fragment, type ReactNode } from 'react';

/**
 * A deliberately small Markdown subset for tooltip content.
 *
 * Tooltip text arrives as a DOM attribute, which frequently means it is built
 * from user- or FHIR-derived strings. Rendering it as an HTML string would make
 * every `data-tooltip` an injection point, so this parser emits React nodes
 * directly and never touches `innerHTML`. Anything it does not recognize stays
 * plain text, which fails safe.
 *
 * Supported: **bold**, *italic*, `code`, ~~strike~~, `-` lists, blank-line
 * paragraphs, and single newlines as hard breaks. Backslash escapes any of the
 * markers. Links are intentionally unsupported: they are unreachable in a hover
 * tooltip, and honoring hrefs would reopen the injection hole this avoids.
 */

// Order matters: escapes win, then code spans (which suppress formatting
// inside), then the double-character markers before their single-character
// counterparts so `**x**` is not read as two empty italics.
// The escape class covers the list markers too, so escaping a leading `-` in
// interpolated data consumes the backslash instead of printing it.
const INLINE_SOURCE =
    /\\([\\`*_~+-])|(`+)([\s\S]+?)\2|\*\*([\s\S]+?)\*\*|__([\s\S]+?)__|~~([\s\S]+?)~~|\*(?!\s)([\s\S]+?)\*|_(?!\s)([\s\S]+?)_/.source;

function parseInline(text: string, keyPrefix: string): ReactNode[] {
    // Must be constructed per call: this function recurses to parse nested
    // emphasis, and a shared /g/ regex would have its `lastIndex` reset by the
    // inner call, restarting the outer scan forever.
    const inlineRe = new RegExp(INLINE_SOURCE, 'g');

    const nodes: ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let key = 0;

    while ((match = inlineRe.exec(text)) !== null) {
        if (match.index > lastIndex) {
            nodes.push(text.slice(lastIndex, match.index));
        }

        const [, escaped, , code, strongStar, strongUnderscore, strike, emStar, emUnderscore] = match;
        const childKey = `${keyPrefix}-${key++}`;

        if (escaped !== undefined) {
            nodes.push(escaped);
        }
        else if (code !== undefined) {
            // Code spans are opaque: no nested parsing.
            nodes.push(createElement('code', { key: childKey }, code));
        }
        else {
            const [tag, content] =
                strongStar       !== undefined ? ['strong', strongStar] as const :
                strongUnderscore !== undefined ? ['strong', strongUnderscore] as const :
                strike           !== undefined ? ['s',      strike] as const :
                emStar           !== undefined ? ['em',     emStar] as const :
                                                 ['em',     emUnderscore!] as const;

            nodes.push(createElement(tag, { key: childKey }, ...parseInline(content, childKey)));
        }

        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
        nodes.push(text.slice(lastIndex));
    }

    return nodes;
}

/** Join the lines of one paragraph, turning single newlines into hard breaks. */
function renderParagraphLines(lines: string[], keyPrefix: string): ReactNode[] {
    const nodes: ReactNode[] = [];

    lines.forEach((line, index) => {
        if (index > 0) {
            nodes.push(createElement('br', { key: `${keyPrefix}-br-${index}` }));
        }
        nodes.push(...parseInline(line, `${keyPrefix}-${index}`));
    });

    return nodes;
}

const LIST_ITEM_RE = /^\s*[-*+]\s+(.*)$/;

/**
 * Neutralize Markdown syntax in a string that is data, not markup.
 *
 * Callers building tooltip content from a template must run every interpolated
 * value through this. Clinical strings contain the markers for real: product
 * names carry `*` and `_`, free-text sigs contain both, and an unescaped one
 * silently swallows the text up to the next marker.
 */
export function escapeTooltipMarkdown(text: string): string {
    return text
        .replace(/([\\`*_~])/g, '\\$1')
        // `-` and `+` only mean anything at the start of a line, where they
        // would turn an interpolated value into a list item.
        .replace(/^([-+])(\s)/gm, '\\$1$2');
}

/**
 * Parse a tooltip string into React nodes. Returns `null` for empty content so
 * callers can skip showing an empty bubble.
 */
export function renderTooltipMarkdown(text: string): ReactNode {
    const source = text.replace(/\r\n?/g, '\n').trim();

    if (!source) {
        return null;
    }

    const blocks: ReactNode[] = [];
    const lines = source.split('\n');

    let paragraph: string[] = [];
    let listItems: string[] = [];

    const flushParagraph = () => {
        if (!paragraph.length) return;
        const key = `p-${blocks.length}`;
        blocks.push(createElement('p', { key }, ...renderParagraphLines(paragraph, key)));
        paragraph = [];
    };

    const flushList = () => {
        if (!listItems.length) return;
        const key = `ul-${blocks.length}`;
        blocks.push(createElement(
            'ul',
            { key },
            ...listItems.map((item, index) =>
                createElement('li', { key: `${key}-${index}` }, ...parseInline(item, `${key}-${index}`))
            )
        ));
        listItems = [];
    };

    for (const line of lines) {
        const listMatch = LIST_ITEM_RE.exec(line);

        if (listMatch) {
            flushParagraph();
            listItems.push(listMatch[1]);
        }
        else if (!line.trim()) {
            flushParagraph();
            flushList();
        }
        else {
            flushList();
            paragraph.push(line);
        }
    }

    flushParagraph();
    flushList();

    // A single paragraph is the common case; unwrap it so simple tooltips do not
    // pay for block margins.
    if (blocks.length === 1) {
        return blocks[0];
    }

    return createElement(Fragment, null, ...blocks);
}
