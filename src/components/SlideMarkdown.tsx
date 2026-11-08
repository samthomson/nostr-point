import { Fragment, useMemo } from 'react';

interface SlideMarkdownProps {
  content: string;
}

/** Render inline markdown (bold/italic/strikethrough) as React nodes — no innerHTML, XSS-safe */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Split on ~~strikethrough~~, **bold**, then *italic* tokens (order matters)
  const regex = /(~~[^~]+~~|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    const key = `${keyPrefix}-${i++}`;

    if (token.startsWith('~~')) {
      nodes.push(<s key={key}>{token.slice(2, -2)}</s>);
    } else if (token.startsWith('**')) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

/** One bullet/numbered item; indented sub-lists hang off `children` */
interface ListItem {
  text: string;
  children: ListBlock[];
}

/** A ul/ol at one nesting level */
interface ListBlock {
  kind: 'ul' | 'ol';
  /** For 'ol': the number of the first item, so pasted lists keep their start */
  start?: number;
  items: ListItem[];
}

type Block =
  | { kind: 'h1' | 'h2' | 'h3' | 'p' | 'code'; lines: string[] }
  | ListBlock;

/** List marker at the start of a (dedented) line: `- `, `* `, or `N. ` */
const LIST_MARKER_RE = /^([-*] |\d+\. )/;

/** Nesting depth: 4 spaces (or one tab) per level */
function indentLevelOf(line: string): number {
  const spaces = line.length - line.trimStart().length;
  return Math.floor(spaces / 4);
}

function parseBlocks(content: string): Block[] {
  const blocks: Block[] = [];
  const lines = content.split('\n');

  // Open list nesting: innermost last. Blank lines, headings, and code fences
  // close the whole stack (a blank line ends the list, as before).
  const stack: { level: number; block: ListBlock }[] = [];
  let lastItem: ListItem | null = null;

  const closeLists = () => {
    stack.length = 0;
    lastItem = null;
  };

  // Fenced code block state — preserves exact whitespace/indentation
  let inCode = false;
  let codeLines: string[] = [];

  for (const line of lines) {
    // Fenced code block delimiter (``` optionally followed by a language)
    if (/^```/.test(line.trim())) {
      if (inCode) {
        blocks.push({ kind: 'code', lines: codeLines });
        codeLines = [];
        inCode = false;
      } else {
        closeLists();
        inCode = true;
        codeLines = [];
      }
      continue;
    }

    if (inCode) {
      // Keep the raw line verbatim (preserve leading spaces)
      codeLines.push(line);
      continue;
    }

    const trimmed = line.trimEnd();

    if (trimmed === '') {
      // Blank line closes the current block and any open lists
      closeLists();
      continue;
    }

    if (trimmed.startsWith('### ')) {
      closeLists();
      blocks.push({ kind: 'h3', lines: [trimmed.slice(4)] });
    } else if (trimmed.startsWith('## ')) {
      closeLists();
      blocks.push({ kind: 'h2', lines: [trimmed.slice(3)] });
    } else if (trimmed.startsWith('# ')) {
      closeLists();
      blocks.push({ kind: 'h1', lines: [trimmed.slice(2)] });
    } else if (LIST_MARKER_RE.test(trimmed.trimStart())) {
      const level = indentLevelOf(trimmed);
      const body = trimmed.trimStart();
      const marker = body.match(LIST_MARKER_RE)![0];

      let text: string;
      let kind: 'ul' | 'ol';
      let start: number | undefined;
      if (marker === '- ' || marker === '* ') {
        kind = 'ul';
        text = body.slice(2);
      } else {
        kind = 'ol';
        start = parseInt(marker, 10) || undefined;
        text = body.replace(/^\d+\. /, '');
      }

      // Pop deeper levels, then append (same level + kind), nest (deeper),
      // or start a sibling list (same level, different marker kind).
      while (stack.length > 0 && stack[stack.length - 1].level > level) stack.pop();
      const top = stack[stack.length - 1];

      if (top && top.level === level && top.block.kind === kind) {
        top.block.items.push({ text, children: [] });
      } else {
        if (top && top.level === level) stack.pop();
        const block: ListBlock = { kind, start, items: [{ text, children: [] }] };
        const parent = stack[stack.length - 1];
        if (parent) {
          parent.block.items[parent.block.items.length - 1].children.push(block);
        } else {
          blocks.push(block);
        }
        stack.push({ level, block });
      }
      lastItem = stack[stack.length - 1].block.items[stack[stack.length - 1].block.items.length - 1];
    } else {
      // Paragraph-ish line. If a list is open, lazily continue its last item;
      // otherwise join into the current paragraph block.
      const dedented = trimmed.trimStart();
      if (lastItem) {
        lastItem.text += `\n${dedented}`;
      } else {
        const last = blocks[blocks.length - 1];
        if (last && last.kind === 'p') {
          last.lines.push(dedented);
        } else {
          blocks.push({ kind: 'p', lines: [dedented] });
        }
      }
    }
  }

  // Flush an unterminated code fence
  if (inCode && codeLines.length > 0) {
    blocks.push({ kind: 'code', lines: codeLines });
  }

  return blocks;
}

/** Render a (possibly nested) list block. Markers are `list-inside` so
 *  multi-digit numbers can't be clipped by the element's overflow. */
function renderListBlock(block: ListBlock, key: string, nested: boolean): React.ReactNode {
  const Tag = block.kind === 'ol' ? 'ol' : 'ul';
  return (
    <Tag
      key={key}
      className={block.kind === 'ol' ? 'list-decimal list-inside' : 'list-disc list-inside'}
      start={block.kind === 'ol' ? block.start : undefined}
      style={nested ? { paddingLeft: '1.2em', marginTop: '0.3em' } : undefined}
    >
      {block.items.map((item, i) => (
        <li key={i} style={item.children.length > 0 ? { marginBottom: '0.25em' } : undefined}>
          {renderInline(item.text, `${key}-${i}`)}
          {item.children.map((child, ci) => renderListBlock(child, `${key}-${i}-${ci}`, true))}
        </li>
      ))}
    </Tag>
  );
}

/**
 * Renders slide markdown content as React elements.
 * Supports: # ## ### headings, - bullet lists (nestable by 4-space indent),
 * 1. numbered lists (first number preserved), ``` code fences, **bold**,
 * *italic*, ~~strikethrough~~, paragraphs. Font sizes are relative (em) so
 * the element's fontSize controls overall scale.
 */
export function SlideMarkdown({ content }: SlideMarkdownProps) {
  const blocks = useMemo(() => parseBlocks(content), [content]);

  return (
    <>
      {blocks.map((block, bi) => {
        // Vertical gap between blocks (except the first) so paragraphs and
        // lists are visually separated. Relative to font size.
        const spacing = bi > 0 ? { marginTop: '0.6em' } : undefined;

        switch (block.kind) {
          case 'h1':
            return (
              <h1 key={bi} className="font-bold leading-tight" style={{ fontSize: '1.6em', ...spacing }}>
                {renderInline(block.lines[0], `${bi}`)}
              </h1>
            );
          case 'h2':
            return (
              <h2 key={bi} className="font-bold leading-tight" style={{ fontSize: '1.3em', ...spacing }}>
                {renderInline(block.lines[0], `${bi}`)}
              </h2>
            );
          case 'h3':
            return (
              <h3 key={bi} className="font-semibold leading-tight" style={{ fontSize: '1.1em', ...spacing }}>
                {renderInline(block.lines[0], `${bi}`)}
              </h3>
            );
          case 'ul':
          case 'ol':
            return renderListBlock(block, `${bi}`, false);
          case 'p':
            return (
              <p key={bi} style={spacing}>
                {block.lines.map((line, li) => (
                  <Fragment key={li}>
                    {li > 0 && <br />}
                    {renderInline(line, `${bi}-${li}`)}
                  </Fragment>
                ))}
              </p>
            );
          case 'code':
            return (
              <pre
                key={bi}
                className="rounded-md bg-black/30 overflow-x-auto"
                style={{
                  ...spacing,
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                  fontSize: '0.7em',
                  lineHeight: 1.5,
                  padding: '0.75em 1em',
                  whiteSpace: 'pre',
                }}
              >
                {block.lines.join('\n')}
              </pre>
            );
        }
      })}
    </>
  );
}
