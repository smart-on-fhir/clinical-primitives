import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { DocsApp } from './DocsApp';
import './tailwind.css';
import './docs.scss';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Preview root element was not found.');
}

createRoot(rootElement).render(
  <StrictMode>
    <DocsApp />
  </StrictMode>
);