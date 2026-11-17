// Browser-native copy is intentionally enabled. Paste/drop and cut remain
// blocked inside the editor, including keyboard, context menu and beforeinput.
export function blocksEditorClipboardEvent(type) {
  return type === 'paste' || type === 'drop' || type === 'cut';
}
export function blocksEditorShortcut(key, hasModifier) {
  return Boolean(hasModifier && (key === 'v' || key === 'x'));
}
export function blocksEditorBeforeInput(inputType = '') {
  return /^(insertFromPaste|insertFromDrop|insertFromYank|deleteByCut)/.test(inputType);
}
