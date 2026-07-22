export function storiesBasePath(ctx) {
  return ctx.mode === 'org' ? `/publishers/${ctx.orgId}/stories` : '/me/stories';
}

export function storyPath(ctx, id) {
  return `${storiesBasePath(ctx)}/${id}`;
}
