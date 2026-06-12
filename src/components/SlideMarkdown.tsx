import { Fragment, useMemo } from 'react';

interface SlideMarkdownProps {
  content: string;
}

/** Render inline markdown (bold/italic) as React nodes — no innerHTML, XSS-safe */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Split on **bold** and *italic* tokens
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**')) {
      nodes.push(<strong key={`${keyPrefix}-b${i}`}>{token.slice(2, -2)}</strong>);
    } else {
      nodes.push(<em key={`${keyPrefix}-i${i}`}>{token.slice(1, -1)}</em>);
    }
    lastIndex = match.index + token.length;
    i++;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

interface Block {
  kind: 'h1' | 'h2' | 'h3' | 'ul' | 'ol' | 'p';
  lines: string[];
}

function parseBlocks(content: string): Block[] {
  const blocks: Block[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trimEnd();

    if (trimmed.startsWith('### ')) {
      blocks.push({ kind: 'h3', lines: [trimmed.slice(4)] });
    } else if (trimmed.startsWith('## ')) {
      blocks.push({ kind: 'h2', lines: [trimmed.slice(3)] });
    } else if (trimmed.startsWith('# ')) {
      blocks.push({ kind: 'h1', lines: [trimmed.slice(2)] });
    } else if (/^[-*] /.test(trimmed)) {
      const last = blocks[blocks.length - 1];
      const item = trimmed.slice(2);
      if (last?.kind === 'ul') {
        last.lines.push(item);
      } else {
        blocks.push({ kind: 'ul', lines: [item] });
      }
    } else if (/^\d+\. /.test(trimmed)) {
      const last = blocks[blocks.length - 1];
      const item = trimmed.replace(/^\d+\. /, '');
      if (last?.kind === 'ol') {
        last.lines.push(item);
      } else {
        blocks.push({ kind: 'ol', lines: [item] });
      }
    } else if (trimmed === '') {
      // Blank line separates blocks; nothing to push
    } else {
      const last = blocks[blocks.length - 1];
      if (last?.kind === 'p') {
        last.lines.push(trimmed);
      } else {
        blocks.push({ kind: 'p', lines: [trimmed] });
      }
    }
  }

  return blocks;
}

/**
 * Renders slide markdown content as React elements.
 * Supports: # ## ### headings, - bullet lists, 1. numbered lists,
 * **bold**, *italic*, paragraphs. Font sizes are relative (em) so the
 * element's fontSize controls overall scale.
 */
export function SlideMarkdown({ content }: SlideMarkdownProps) {
  const blocks = useMemo(() => parseBlocks(content), [content]);

  return (
    <>
      {blocks.map((block, bi) => {
        switch (block.kind) {
          case 'h1':
            return (
              <h1 key={bi} className="font-bold leading-tight" style={{ fontSize: '1.6em' }}>
                {renderInline(block.lines[0], `${bi}`)}
              </h1>
            );
          case 'h2':
            return (
              <h2 key={bi} className="font-bold leading-tight" style={{ fontSize: '1.3em' }}>
                {renderInline(block.lines[0], `${bi}`)}
              </h2>
            );
          case 'h3':
            return (
              <h3 key={bi} className="font-semibold leading-tight" style={{ fontSize: '1.1em' }}>
                {renderInline(block.lines[0], `${bi}`)}
              </h3>
            );
          case 'ul':
            return (
              <ul key={bi} className="list-disc list-outside" style={{ paddingLeft: '1.2em' }}>
                {block.lines.map((item, li) => (
                  <li key={li}>{renderInline(item, `${bi}-${li}`)}</li>
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={bi} className="list-decimal list-outside" style={{ paddingLeft: '1.2em' }}>
                {block.lines.map((item, li) => (
                  <li key={li}>{renderInline(item, `${bi}-${li}`)}</li>
                ))}
              </ol>
            );
          case 'p':
            return (
              <p key={bi}>
                {block.lines.map((line, li) => (
                  <Fragment key={li}>
                    {li > 0 && <br />}
                    {renderInline(line, `${bi}-${li}`)}
                  </Fragment>
                ))}
              </p>
            );
        }
      })}
    </>
  );
}
