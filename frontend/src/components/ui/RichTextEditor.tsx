import React, { useRef, useState, useEffect } from 'react';
import { Editor } from '@tinymce/tinymce-react';
import { useTinyMCE } from '../../hooks/useTinyMCE';

interface RichTextEditorProps {
  value: string;
  onChange: (content: string) => void;
  placeholder?: string;
  height?: number;
  disabled?: boolean;
  className?: string;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Digite suas anotações aqui...',
  height = 300,
  disabled = false,
  className = ''
}) => {
  const editorRef = useRef<any>(null);
  const { loaded } = useTinyMCE();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (loaded && !isReady) {
      setIsReady(true);
    }
  }, [loaded, isReady]);

  const handleEditorChange = (content: string) => {
    onChange(content);
  };

  const editorConfig = {
    height,
    menubar: false,
    plugins: [
      'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
      'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
      'insertdatetime', 'media', 'table', 'help', 'wordcount'
    ],
    toolbar: [
      'undo redo | blocks | bold italic underline strikethrough | alignleft aligncenter alignright alignjustify',
      'outdent indent | numlist bullist | forecolor backcolor removeformat | link image media table | code fullscreen help'
    ].join(' | '),
    content_style: `
      body { 
        font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif; 
        font-size: 14px;
        line-height: 1.6;
      }
      p { margin: 0.5em 0; }
    `,
    placeholder,
    branding: false,
    promotion: false,
    resize: false,
    statusbar: false,
    skin: 'oxide',
    content_css: 'default',
    // Configurações de imagem
    image_advtab: true,
    image_uploadtab: false,
    automatic_uploads: false,
    // Configurações de link
    link_assume_external_targets: true,
    link_context_toolbar: true,
    // Outras configurações
    convert_urls: false,
    relative_urls: false,
    remove_script_host: false,
    document_base_url: '',
  };

  if (!isReady) {
    return (
      <div className={`border border-gray-300 rounded-lg ${className}`} style={{ height }}>
        <div className="flex items-center justify-center h-full text-gray-500">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
            <p>Carregando editor...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <Editor
        onInit={(_evt, editor) => {
          editorRef.current = editor;
        }}
        value={value}
        init={editorConfig}
        onEditorChange={handleEditorChange}
        disabled={disabled}
      />
    </div>
  );
};

export default RichTextEditor;