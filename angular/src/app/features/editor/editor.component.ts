import {Component, computed, ElementRef, model, signal, ViewChild} from '@angular/core';
import {matchingCurly, syntaxHighlight} from './editor-highlight';

@Component({
  selector:'bq-editor',
  template:`
    <div class="editor-body">
      <pre class="code-gutter" #gutter aria-hidden="true">{{lineNumbers()}}</pre>
      <div class="code-stage">
        <pre class="syntax-layer" #mirror aria-hidden="true"><code [innerHTML]="highlighted()"></code></pre>
        <textarea #sourceBox class="source-input" aria-label="Java solution code"
          [value]="value()" (input)="onInput($event)" (keydown)="onKeyDown($event)"
          (click)="updateCaret($event)" (keyup)="updateCaret($event)"
          (select)="updateCaret($event)" (focus)="updateCaret($event)"
          (blur)="caret.set(-1)" (scroll)="syncScroll($event)"
          spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off"
          wrap="off"></textarea>
      </div>
    </div>
    <footer class="editor-footer"><span>Java 17 · Draft editor</span>
      <span>Spaces: 4 <span class="editor-separator">|</span> UTF-8</span>
    </footer>
  `
})
export class EditorComponent {
  readonly value=model('');
  readonly caret=signal(-1);
  readonly selectionEnd=signal(-1);
  readonly highlighted=computed(()=>syntaxHighlight(this.value(),matchingCurly(this.value(),this.caret(),this.selectionEnd())));
  readonly lineNumbers=computed(()=>Array.from({length:this.value().split('\n').length},(_,i)=>String(i+1)).join('\n'));
  @ViewChild('mirror') mirror?:ElementRef<HTMLPreElement>;
  @ViewChild('gutter') gutter?:ElementRef<HTMLPreElement>;

  onInput(event:Event):void{
    const el=event.target as HTMLTextAreaElement;
    this.value.set(el.value);
    this.caret.set(el.selectionStart);
    this.selectionEnd.set(el.selectionEnd);
  }
  updateCaret(event:Event):void{
    const el=event.target as HTMLTextAreaElement;
    this.caret.set(el.selectionStart);
    this.selectionEnd.set(el.selectionEnd);
  }
  syncScroll(event:Event):void{
    const el=event.target as HTMLTextAreaElement;
    if(this.mirror){
      this.mirror.nativeElement.scrollTop=el.scrollTop;
      this.mirror.nativeElement.scrollLeft=el.scrollLeft;
    }
    if(this.gutter)this.gutter.nativeElement.scrollTop=el.scrollTop;
  }
  onKeyDown(event:KeyboardEvent):void{
    if(event.ctrlKey||event.metaKey||event.altKey)return;
    const el=event.target as HTMLTextAreaElement;
    const before=el.selectionStart,after=el.selectionEnd;
    const source=this.value(),opening:Record<string,string>={'(':')','[':']','{':'}'};
    if(event.key==='Tab'){
      event.preventDefault();this.apply(el,source.slice(0,before)+'    '+source.slice(after),before+4);return;
    }
    if(event.key==='Backspace'&&before===after&&before>0
      &&opening[source[before-1]]===source[before]){
      event.preventDefault();this.apply(el,source.slice(0,before-1)+source.slice(after+1),before-1);return;
    }
    if([')',']','}'].includes(event.key)&&before===after&&source[before]===event.key){
      event.preventDefault();el.setSelectionRange(before+1,before+1);this.updateCaret(event);return;
    }
    const close=opening[event.key];
    if(close&&(!source[before]||/[\s\])};,]/.test(source[before]))){
      event.preventDefault();
      const selection=source.slice(before,after);
      const next=source.slice(0,before)+event.key+selection+close+source.slice(after);
      this.apply(el,next,before+1,selection?after+1:before+1);
    }
  }
  private apply(el:HTMLTextAreaElement,next:string,start:number,end=start):void{
    this.value.set(next);this.caret.set(start);this.selectionEnd.set(end);
    // Angular's bound textarea value may render after the keydown microtask.
    // Restore the caret after rendering; do not override later user input.
    requestAnimationFrame(()=>{
      if(this.value()===next && document.activeElement===el)
        el.setSelectionRange(start,end);
    });
  }
}
