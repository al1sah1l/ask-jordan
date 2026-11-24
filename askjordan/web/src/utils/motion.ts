/** Keep departing list items in place while their neighbors move into the gap. */
export function freezeLeavingItem(element: Element) {
  const item = element as HTMLElement;
  const { width, height } = item.getBoundingClientRect();
  item.style.left = `${item.offsetLeft}px`;
  item.style.top = `${item.offsetTop}px`;
  item.style.width = `${width}px`;
  item.style.height = `${height}px`;
  item.inert = true;
}

export function restoreEnteringItem(element: Element) {
  const item = element as HTMLElement;
  for (const property of ["width", "height", "left", "top"]) item.style.removeProperty(property);
  item.inert = false;
}
