// Keyboard shortcuts of the map views: Esc, Enter, Delete/Backspace, undo/redo.

import { onMounted, onBeforeUnmount } from 'vue';
import { undo, redo } from '../stores/gardens.js';

function isTyping(target) {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName));
}

/**
 * @param {{ onEscape: Function, onEnter?: Function, onDelete?: Function, canUndo?: () => boolean }} handlers
 */
export function useMapKeys({ onEscape, onEnter, onDelete, canUndo = () => true }) {
  function onKeydown(event) {
    if (document.querySelector('dialog[open]')) return;
    const mod = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    if (mod && (key === 'z' || key === 'y') && !isTyping(event.target)) {
      event.preventDefault();
      if (!canUndo()) return;
      if (key === 'y' || event.shiftKey) redo();
      else undo();
      return;
    }
    if (isTyping(event.target)) return;
    if (event.key === 'Escape') onEscape();
    else if (event.key === 'Enter') onEnter?.();
    else if (event.key === 'Delete' || event.key === 'Backspace') {
      if (onDelete?.()) event.preventDefault();
    }
  }
  onMounted(() => window.addEventListener('keydown', onKeydown));
  onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));
}
