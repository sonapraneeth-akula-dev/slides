export async function consumeEventStream(
  url: string,
  headers: Record<string, string>,
  signal: AbortSignal,
  onEvent: (event: string, data: unknown) => void | Promise<void>,
): Promise<'ended' | 'unauthorized' | 'closed'> {
  const response = await fetch(url, {
    headers: { Accept: 'text/event-stream', ...headers },
    cache: 'no-store',
    signal,
  });
  if (response.status === 404 || response.status === 410) return 'ended';
  if (response.status === 401 || response.status === 403) return 'unauthorized';
  if (!response.ok || !response.body) throw new Error(`Stream connection failed (${response.status}).`);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
      let boundary: number;
      while ((boundary = buffer.indexOf('\n\n')) >= 0) {
        const rawBlock = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        let eventName = 'message';
        const dataLines: string[] = [];
        for (const line of rawBlock.split('\n')) {
          if (!line || line.startsWith(':')) continue;
          if (line.startsWith('event:')) eventName = line.slice(6).trim();
          else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
        }
        if (!dataLines.length) continue;
        await onEvent(eventName, JSON.parse(dataLines.join('\n')));
        if (eventName === 'ended') return 'ended';
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return 'closed';
}
