import {
  useCallback,
  useEffect,
  useRef,
  type CSSProperties,
  type ElementType,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import { readInlineEditableContent, writeInlineEditableContent } from '../../utils/builderRichText';
import { useBuilderInlineEdit } from './BuilderInlineEditContext';

interface BuilderInlineEditableProps {
  tag?: ElementType;
  className?: string;
  style?: CSSProperties;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  role?: string;
  'aria-multiline'?: boolean | 'true' | 'false';
  onPointerDown?: (event: PointerEvent<HTMLElement>) => void;
  onMouseDown?: (event: MouseEvent<HTMLElement>) => void;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
}

export default function BuilderInlineEditable({
  tag: Tag = 'div',
  className,
  style,
  value,
  placeholder,
  onChange,
  role,
  'aria-multiline': ariaMultiline,
  onPointerDown,
  onMouseDown,
  onClick,
}: BuilderInlineEditableProps) {
  const ref = useRef<HTMLElement>(null);
  const focusedRef = useRef(false);
  const valueRef = useRef(value);
  const inlineEdit = useBuilderInlineEdit();

  valueRef.current = value;

  const commit = useCallback(() => {
    if (!ref.current) return;
    const next = readInlineEditableContent(ref.current);
    if (next !== valueRef.current) onChange(next);
  }, [onChange]);

  useEffect(() => {
    const el = ref.current;
    if (!el || focusedRef.current) return;
    const domValue = readInlineEditableContent(el);
    const nextValue = value || '';
    if (domValue !== nextValue) {
      writeInlineEditableContent(el, nextValue);
    }
  }, [value]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !inlineEdit) return;
    return inlineEdit.registerCommit(el, commit);
  }, [inlineEdit, commit]);

  return (
    <Tag
      ref={ref}
      className={className ? `sites-inline-editable ${className}` : 'sites-inline-editable'}
      style={style}
      contentEditable
      suppressContentEditableWarning
      role={role}
      aria-multiline={ariaMultiline}
      data-placeholder={placeholder}
      onFocus={() => {
        focusedRef.current = true;
      }}
      onBlur={() => {
        focusedRef.current = false;
        commit();
      }}
      onInput={commit}
      onKeyUp={() => inlineEdit?.saveSelection()}
      onMouseUp={() => inlineEdit?.saveSelection()}
      onPointerDown={onPointerDown}
      onMouseDown={onMouseDown}
      onClick={onClick}
    />
  );
}
