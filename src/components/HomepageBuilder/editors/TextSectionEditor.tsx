import React from 'react';
import { TextSection } from '../../../types/homepage';
import BuilderRichTextEditor from '../BuilderRichTextEditor';

interface TextSectionEditorProps {
  section: TextSection & { id: string };
  onUpdate: (updates: Partial<TextSection>) => void;
}

export default function TextSectionEditor({ section, onUpdate }: TextSectionEditorProps) {
  return (
    <BuilderRichTextEditor
      label="Content"
      value={section.content.text}
      onChange={(text) => onUpdate({ content: { ...section.content, text } })}
    />
  );
}
