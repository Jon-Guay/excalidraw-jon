import type {
  CreateDrawingRequest,
  CreateDrawingResponse,
  DeleteDrawingResponse,
  Drawing,
  GetDrawingResponse,
  ListDrawingsResponse,
  ListUsersResponse,
  UpdateDrawingRequest,
  UpdateDrawingResponse,
} from "@excalidraw/api-types";

const SERVER_URL = import.meta.env.VITE_APP_SERVER_URL;

export const isServerConfigured = (): boolean => Boolean(SERVER_URL);

const request = async <T>(
  path: string,
  init?: RequestInit,
): Promise<T | null> => {
  if (!SERVER_URL) {
    return null;
  }

  try {
    const response = await fetch(`${SERVER_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      console.warn(`server request failed: ${path} (${response.status})`);
      return null;
    }

    return (await response.json()) as T;
  } catch (error) {
    console.warn(`server request error: ${path}`, error);
    return null;
  }
};

export const listUsers = () => request<ListUsersResponse>("/users");

export const listDrawings = (ownerId: string) =>
  request<ListDrawingsResponse>(
    `/drawings?ownerId=${encodeURIComponent(ownerId)}`,
  );

export const getDrawing = (id: string) =>
  request<GetDrawingResponse>(`/drawings/${encodeURIComponent(id)}`);

export const createDrawing = (payload: CreateDrawingRequest) =>
  request<CreateDrawingResponse>("/drawings", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateDrawing = (id: string, payload: UpdateDrawingRequest) =>
  request<UpdateDrawingResponse>(`/drawings/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const deleteDrawing = (id: string) =>
  request<DeleteDrawingResponse>(`/drawings/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });

export type { Drawing };
