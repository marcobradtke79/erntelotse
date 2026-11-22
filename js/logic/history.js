// Undo/redo stack of serialised states. Pure module.

export function createHistory(limit = 100) {
  let undoStack = [];
  let redoStack = [];

  return {
    /** Call before a change with the state as it is now. */
    record(state) {
      undoStack.push(state);
      if (undoStack.length > limit) undoStack.shift();
      redoStack = [];
    },
    /** Returns the state to restore, or null. `current` becomes redoable. */
    undo(current) {
      if (undoStack.length === 0) return null;
      redoStack.push(current);
      return undoStack.pop();
    },
    redo(current) {
      if (redoStack.length === 0) return null;
      undoStack.push(current);
      return redoStack.pop();
    },
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
    clear() {
      undoStack = [];
      redoStack = [];
    },
  };
}
