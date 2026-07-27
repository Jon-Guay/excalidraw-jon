export type User = {
  id: string;
  name: string;
  createdAt: string;
};

export type ListUsersResponse = {
  users: User[];
};
