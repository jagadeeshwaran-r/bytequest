// Ctrl+R runs code only on the Problems practice screen. Preserve browser
// refresh everywhere else and never intercept text fields or open dialogs.
export function shouldRunCodeShortcut(event,{practiceVisible=false,dialogOpen=false}={}){
  if(!practiceVisible||dialogOpen||event?.defaultPrevented||event?.isComposing||event?.repeat||
     !event?.ctrlKey||event?.metaKey||event?.altKey||event?.shiftKey||
     String(event?.key||'').toLowerCase()!=='r')return false;
  const target=event.target;
  const editable=target?.closest?.('input, textarea, select, [contenteditable="true"]');
  return !editable||editable.id==='codeEditor';
}
