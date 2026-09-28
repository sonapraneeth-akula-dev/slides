export type Viewer = { name: string; ip?: string };

export function renderViewers(list: HTMLElement, viewers: Viewer[]): void {
  // Re-rendering an unchanged list would dismiss an open hover tooltip on every poll.
  const key = JSON.stringify(viewers);
  if (list.dataset.viewers === key) return;
  list.dataset.viewers = key;
  list.replaceChildren(...viewers.map(viewer => {
    const label = viewer.ip ? `${viewer.name} (${viewer.ip})` : viewer.name;
    const item = document.createElement('li');
    item.className = 'viewer-avatar';
    item.title = label;
    item.style.setProperty('--hue', String([...viewer.name].reduce((hash, char) => (hash * 31 + char.codePointAt(0)!) % 360, 7)));
    const initial = document.createElement('span');
    initial.setAttribute('aria-hidden', 'true');
    initial.textContent = [...viewer.name][0]?.toLocaleUpperCase() || '?';
    const text = document.createElement('span');
    text.className = 'sr-only';
    text.textContent = label;
    item.append(initial, text);
    return item;
  }));
}
