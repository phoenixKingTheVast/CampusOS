export type LegacyOrganizationPost = {
  id: string;
  organizationId: string;
  authorId: string;
  body: string;
  visibility: string;
  status: string;
  kind: string;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export function mapOrganizationPostToPost(row: LegacyOrganizationPost) {
  const visibility = row.visibility === 'MEMBERS' || row.visibility === 'MEMBERS_ONLY' ? 'CONTEXT_ONLY' : row.visibility;
  return {
    id: row.id,
    authorId: row.authorId,
    contextType: 'ORGANIZATION' as const,
    contextId: row.organizationId,
    organizationId: row.organizationId,
    body: row.body,
    status: row.status,
    visibility,
    kind: row.kind === 'ANNOUNCEMENT' ? 'POST' : row.kind,
    publishedAt: row.publishedAt ?? row.createdAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    removedAt: row.status === 'REMOVED' ? row.updatedAt : null,
  };
}
