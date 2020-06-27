export function formatRepository(repo: any): string {
  const isPrivate = repo.is_private === true ? 'private' : 'public';
  return `${repo.full_name} "${repo.language}" ${repo.size} ${isPrivate}\n`;
}

export function formatPullrequest(pr: any): string {
  const srcBranch = pr.source.branch.name;
  const targetBranch = pr.destination.branch.name;
  return `${pr.title} ${pr.id} ${srcBranch} ${targetBranch} ${pr.state}\n`;
}

export function formatMember(member: any): string {
  return `${member.user.nickname}\n`;
}

export function formatWorkspace(workspace: any): string {
  const isPrivate = workspace.is_private === true ? 'private' : 'public';
  return `${workspace.slug} ${isPrivate}\n`;
}
