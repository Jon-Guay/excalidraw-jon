export type Drawing = {
  id: string;
  ownerId: string;
  title: string;
  scene: unknown;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ListDrawingsQuery = {
  ownerId?: string;
  includeArchived?: boolean;
};

export type ListDrawingsResponse = {
  drawings: Drawing[];
};

export type GetDrawingResponse = {
  drawing: Drawing;
};

export type CreateDrawingRequest = {
  ownerId: string;
  title: string;
  scene?: unknown;
};

export type CreateDrawingResponse = {
  drawing: Drawing;
};

export type UpdateDrawingRequest = {
  title?: string;
  scene?: unknown;
};

export type UpdateDrawingResponse = {
  drawing: Drawing;
};

export type DeleteDrawingResponse = {
  id: string;
};

export type ArchiveDrawingResponse = {
  drawing: Drawing;
};

export type RestoreDrawingResponse = {
  drawing: Drawing;
};
