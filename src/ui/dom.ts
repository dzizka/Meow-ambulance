/** Malé pomocníky na tvorbu DOM prvkov (rozhranie aj vývojárske menu). */
export type Attrs = Record<string, string | number | boolean | undefined>;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: (Node | string | null | undefined | false)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k === 'class') node.className = String(v);
    else if (k === 'text') node.textContent = String(v);
    else if (k === 'style') node.setAttribute('style', String(v));
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) if (c) node.append(c);
  return node;
}

export function button(label: string, onClick: () => void, attrs: Attrs = {}): HTMLButtonElement {
  const b = el('button', { class: 'btn', type: 'button', ...attrs }, label);
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
  });
  return b;
}
