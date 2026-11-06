/** Legado: títulos preventivos antigos incorporaram a chave técnica do ciclo. */
export function workOrderDisplayTitle(title: string, type: string) {
  if (type !== 'preventive') return title;
  const match = title.match(/^Preventiva\s+(?:interval|annual_calendar):[0-9a-f-]{36}:[0-9]{4}-[0-9]{2}-[0-9]{2}\s+-\s+(.+)$/i);
  return match ? `Preventiva — ${match[1]}` : title;
}
