export function formatRepository(repo: any): string {
  const isPrivate = repo.is_private === true ? 'private' : 'public';
  return `${repo.full_name} "${repo.language}" ${repo.size} ${isPrivate}\n`;
}

