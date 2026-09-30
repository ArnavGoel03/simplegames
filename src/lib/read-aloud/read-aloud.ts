/** Browser-only speech adapter. Offsets are UTF-16, matching utterance boundaries and DOM ranges. */
export interface Passage { text: string; range(start: number, end: number): Range }
export interface SpokenSpan { start: number; end: number }
export function sentenceAt(text: string, offset: number): SpokenSpan {
  if (typeof Intl.Segmenter === "function") {
    for (const part of new Intl.Segmenter(undefined, { granularity: "sentence" }).segment(text)) {
      if (offset >= part.index && offset < part.index + part.segment.length) return { start: part.index, end: part.index + part.segment.length };
    }
  } else {
    for (const part of text.matchAll(/[^.!?।]+(?:[.!?।]+\s*|$)/gu)) {
      if (offset >= part.index && offset < part.index + part[0].length) return { start: part.index, end: part.index + part[0].length };
    }
  }
  return { start: 0, end: text.length };
}
export function wordAt(text: string, offset: number): SpokenSpan {
  if (typeof Intl.Segmenter === "function") {
    for (const part of new Intl.Segmenter(undefined, { granularity: "word" }).segment(text)) {
      if (part.isWordLike && offset >= part.index && offset < part.index + part.segment.length) return { start: part.index, end: part.index + part.segment.length };
    }
  } else {
    for (const part of text.matchAll(/[\p{L}\p{M}\p{N}]+/gu)) {
      if (offset >= part.index && offset < part.index + part[0].length) return { start: part.index, end: part.index + part[0].length };
    }
  }
  return { start: offset, end: offset };
}
const EXCLUDED = "button,input,select,textarea,nav,script,style,[hidden],[aria-hidden=true],[data-read-aloud-control],[data-read-aloud-ignore]";
const BLOCKS = "h1,h2,h3,h4,h5,h6,p,li,dt,dd,figcaption,td,th,blockquote";
export function passagesFrom(root: HTMLElement): Passage[] {
  const groups: Text[][] = [];
  let previous: Element | null = null;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const parent = node.parentElement;
    if (!parent || parent.closest(EXCLUDED)) { previous = null; continue; }
    const style = getComputedStyle(parent);
    if (style.display === "none" || style.visibility === "hidden" || parent.getClientRects().length === 0) { previous = null; continue; }
    const block = parent.closest(BLOCKS) ?? parent;
    if (block !== previous) { groups.push([]); previous = block; }
    groups.at(-1)!.push(node);
  }
  return groups.flatMap(nodes => {
    const text = nodes.map(node => node.data).join("");
    if (!text.trim()) return [];
    return [{ text, range(start: number, end: number) {
      const result = document.createRange();
      let position = 0;
      for (const node of nodes) {
        if (start >= position && start <= position + node.length) { result.setStart(node, start - position); break; }
        position += node.length;
      }
      position = 0;
      for (const node of nodes) {
        if (end >= position && end <= position + node.length) { result.setEnd(node, end - position); break; }
        position += node.length;
      }
      return result;
    } }];
  });
}
export interface SpeechPort {
  speak(utterance: SpeechSynthesisUtterance): void;
  cancel(): void;
}
export function readingSession(passages: readonly Passage[], port: SpeechPort,
  create: (text: string) => SpeechSynthesisUtterance,
  highlight: (sentence: Range, word: Range) => void, clear: () => void, finished: () => void) {
  let stopped = false;
  let index = 0;
  const next = () => {
    if (stopped) return;
    const passage = passages[index++];
    if (!passage) { stopped = true; clear(); finished(); return; }
    const utterance = create(passage.text);
    const show = (offset: number, hasWord: boolean) => {
      if (stopped) return;
      const sentence = sentenceAt(passage.text, offset), word = hasWord ? wordAt(passage.text, offset) : { start: offset, end: offset };
      highlight(passage.range(sentence.start, sentence.end), passage.range(word.start, word.end));
    };
    utterance.onstart = () => show(0, false);
    utterance.onboundary = event => show(event.charIndex, event.name !== "sentence");
    utterance.onend = next;
    utterance.onerror = () => { if (!stopped) { stopped = true; clear(); finished(); } };
    port.speak(utterance);
  };
  return {
    start: next,
    stop() { if (stopped) return; stopped = true; port.cancel(); clear(); finished(); },
  };
}

/** CSS Highlight keeps source markup intact; old engines get inert range overlays. */
export function rangeHighlighter(root: HTMLElement) {
  const overlays: HTMLElement[] = [];
  const registry = typeof CSS !== "undefined" ? (CSS as unknown as { highlights?: Map<string, unknown> }).highlights : undefined;
  const HighlightConstructor = (globalThis as unknown as { Highlight?: new (...ranges: Range[]) => unknown }).Highlight;
  const sentenceKey = "play-reading-sentence", wordKey = "play-reading-word";
  let active: { sentence: Range; word: Range } | null = null;
  const remove = () => {
    registry?.delete(sentenceKey); registry?.delete(wordKey);
    for (const overlay of overlays.splice(0)) overlay.remove();
  };
  const paint = () => {
    remove();
    if (!active || !root.isConnected) return;
    const { sentence, word } = active;
    if (registry && HighlightConstructor) {
      registry.set(sentenceKey, new HighlightConstructor(sentence)); registry.set(wordKey, new HighlightConstructor(word));
    } else {
      for (const [range, className] of [[sentence, "play-reading-sentence"], [word, "play-reading-word"]] as const) {
        for (const box of range.getClientRects()) {
          const overlay = document.createElement("span");
          overlay.className = `play-reading-overlay ${className}`;
          overlay.setAttribute("aria-hidden", "true");
          Object.assign(overlay.style, { left: `${box.left + window.scrollX}px`, top: `${box.top + window.scrollY}px`, width: `${box.width}px`, height: `${box.height}px` });
          document.body.append(overlay); overlays.push(overlay);
        }
      }
    }
  };
  const clear = () => {
    active = null; remove();
    window.removeEventListener("scroll", paint, true); window.removeEventListener("resize", paint);
  };
  return { clear, show(sentence: Range, word: Range) {
    active = { sentence, word };
    const element = sentence.startContainer.parentElement;
    const box = element?.getBoundingClientRect();
    if (box && (box.top < 0 || box.bottom > window.innerHeight)) element?.scrollIntoView({ block: "center", behavior: "auto" });
    paint();
    window.addEventListener("scroll", paint, true); window.addEventListener("resize", paint);
  } };
}
