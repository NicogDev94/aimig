export function renderHoverInfo(
  id: any,
  label: any,
  labels: any,
  properties: any,
) {
  const lines = [];
  lines.push(`<h3>${label}</h3>`);
  if (labels.length > 1) lines.push(`[${labels.join(',')}]`);
  lines.push('<dl style="">');
  if (properties)
    Object.keys(properties).forEach((key) => {
      lines.push(`<dt>${key}</dt><dd>${properties[key]}</dd>`);
    });
  lines.push('</dl>');
  return lines.join('\n');
}
