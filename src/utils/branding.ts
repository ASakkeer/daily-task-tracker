/**
 * Cleans the workspace subtitle to ensure the project title / company name
 * is never duplicated in the second line.
 * e.g. If title is "Daily Task Tracker" and tagline is "Daily Task Tracker • Engineering & QA Workspace",
 * this returns: "Engineering & QA Workspace • Interactive Workspace".
 */
export function getCleanWorkspaceSubtitle(companyName?: string, teamTagline?: string): string {
  const title = (companyName || 'Daily Task Tracker').trim();
  let tagline = (teamTagline || 'Engineering & QA Workspace').trim();

  // 1. Remove company/project title (case-insensitive) anywhere it appears
  if (title) {
    const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    tagline = tagline.replace(new RegExp(escaped, 'gi'), '');
  }

  // 2. Remove standard project name variants anywhere (Daily Task Tracker, daily-task-tracker, Daily Sprint...)
  tagline = tagline.replace(/daily[\s-_]*task[\s-_]*tracker/gi, '');
  tagline = tagline.replace(/daily[\s-_]*sprint[^\s•\-–:|]*/gi, '');

  // 3. Remove "Interactive Workspace" if already in tagline to avoid duplicate suffix
  tagline = tagline.replace(/interactive[\s-_]*workspace/gi, '');

  // 4. Split by common separators (bullets, dashes, pipes, colons), filter empty strings, and join neatly
  tagline = tagline
    .split(/[•\-–:|]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .join(' • ');

  const displayTagline = tagline || 'Engineering & QA Workspace';
  return `${displayTagline} • Interactive Workspace`;
}
