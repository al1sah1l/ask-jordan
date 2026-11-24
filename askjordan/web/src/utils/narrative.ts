/** Preserve dialogue lines and break older dense passages into readable paragraphs. */
export function narrativeParagraphs(text: string): string[] {
  const segmenter = new Intl.Segmenter("en", { granularity: "sentence" });
  return text.replace(/\r\n?/g, "\n").split(/\n+/).flatMap(line => {
    const paragraph = line.trim();
    if (!paragraph) return [];
    if (/^[“"‘]/u.test(paragraph)) return [paragraph];
    const sentences = Array.from(segmenter.segment(paragraph), part => part.segment.trim());
    const result: string[] = [];
    let group: string[] = [];
    for (const sentence of sentences) {
      if (group.length && (group.length >= 2 || `${group.join(" ")} ${sentence}`.split(/\s+/).length > 50)) {
        result.push(group.join(" "));
        group = [];
      }
      group.push(sentence);
    }
    if (group.length) result.push(group.join(" "));
    return result;
  });
}
