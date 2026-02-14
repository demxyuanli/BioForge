import React from 'react';

const VAR_REGEX = /\{\{([^}]+)\}\}/g;

export interface VariableHighlightProps {
  text: string;
  className?: string;
  asPre?: boolean;
  onVariableDoubleClick?: (varName: string) => void;
}

/**
 * Renders text with {{variableName}} wrapped in spans for highlighting.
 * Variables indicate prompts to focus on when generating from template.
 */
export const VariableHighlight: React.FC<VariableHighlightProps> = ({
  text,
  className = '',
  asPre = true,
  onVariableDoubleClick
}) => {
  const parts: Array<{ key: string; type: 'text' | 'var'; value: string }> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  VAR_REGEX.lastIndex = 0;
  while ((match = VAR_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        key: `t-${lastIndex}`,
        type: 'text',
        value: text.slice(lastIndex, match.index)
      });
    }
    parts.push({
      key: `v-${match.index}`,
      type: 'var',
      value: match[1].trim()
    });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ key: `t-${lastIndex}`, type: 'text', value: text.slice(lastIndex) });
  }
  if (parts.length === 0 && text) {
    parts.push({ key: 't0', type: 'text', value: text });
  }

  const content = (
    <>
      {parts.map((p) =>
        p.type === 'var' ? (
          <span
            key={p.key}
            className="eval-template-var"
            title={p.value}
            role="button"
            tabIndex={0}
            onDoubleClick={() => onVariableDoubleClick?.(p.value)}
            onKeyDown={(e) => e.key === 'Enter' && onVariableDoubleClick?.(p.value)}
          >
            {'{{' + p.value + '}}'}
          </span>
        ) : (
          <React.Fragment key={p.key}>{p.value}</React.Fragment>
        )
      )}
    </>
  );

  if (asPre) {
    return (
      <pre className={`eval-variable-highlight ${className}`.trim()}>
        {content}
      </pre>
    );
  }
  return (
    <span className={`eval-variable-highlight eval-variable-highlight-inline ${className}`.trim()}>
      {content}
    </span>
  );
};

export default VariableHighlight;
