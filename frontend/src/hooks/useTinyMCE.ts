import { useEffect, useState } from 'react';

let isLoaded = false;
let isLoading = false;
const loadCallbacks: (() => void)[] = [];

export const useTinyMCE = () => {
  const [loaded, setLoaded] = useState(isLoaded);

  useEffect(() => {
    if (isLoaded) {
      return;
    }

    if (isLoading) {
      loadCallbacks.push(() => setLoaded(true));
      return;
    }

    isLoading = true;

    // Carregar TinyMCE dinamicamente usando require dinâmico
    const loadTinyMCE = async () => {
      try {
        // @ts-ignore
        await import('tinymce/tinymce');
        // @ts-ignore
        await import('tinymce/themes/silver');
        // @ts-ignore
        await import('tinymce/models/dom');
        // @ts-ignore
        await import('tinymce/icons/default');
        // @ts-ignore
        await import('tinymce/plugins/advlist');
        // @ts-ignore
        await import('tinymce/plugins/autolink');
        // @ts-ignore
        await import('tinymce/plugins/lists');
        // @ts-ignore
        await import('tinymce/plugins/link');
        // @ts-ignore
        await import('tinymce/plugins/image');
        // @ts-ignore
        await import('tinymce/plugins/charmap');
        // @ts-ignore
        await import('tinymce/plugins/preview');
        // @ts-ignore
        await import('tinymce/plugins/anchor');
        // @ts-ignore
        await import('tinymce/plugins/searchreplace');
        // @ts-ignore
        await import('tinymce/plugins/visualblocks');
        // @ts-ignore
        await import('tinymce/plugins/code');
        // @ts-ignore
        await import('tinymce/plugins/fullscreen');
        // @ts-ignore
        await import('tinymce/plugins/insertdatetime');
        // @ts-ignore
        await import('tinymce/plugins/media');
        // @ts-ignore
        await import('tinymce/plugins/table');
        // @ts-ignore
        await import('tinymce/plugins/help');
        // @ts-ignore
        await import('tinymce/plugins/wordcount');
        
        isLoaded = true;
        isLoading = false;
        setLoaded(true);
        
        // Executar callbacks pendentes
        loadCallbacks.forEach(callback => callback());
        loadCallbacks.length = 0;
      } catch (error) {
        console.error('Erro ao carregar TinyMCE:', error);
        isLoading = false;
      }
    };

    loadTinyMCE();
  }, []);

  return { loaded };
};