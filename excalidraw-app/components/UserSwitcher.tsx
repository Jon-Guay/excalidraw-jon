import React, { useEffect, useState } from "react";

import type { User } from "@excalidraw/api-types";

import { useAtom, useSetAtom } from "../app-jotai";
import { listUsers } from "../data/serverApi";
import {
  activeDrawingIdAtom,
  currentUserIdAtom,
  persistCurrentUserId,
} from "../data/currentUser";

export const UserSwitcher = ({ style }: { style?: React.CSSProperties }) => {
  const [currentUserId, setCurrentUserId] = useAtom(currentUserIdAtom);
  const setActiveDrawingId = useSetAtom(activeDrawingIdAtom);
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    listUsers().then((response) => {
      if (!response?.users.length) {
        return;
      }
      setUsers(response.users);
      if (!currentUserId) {
        setCurrentUserId(response.users[0].id);
        persistCurrentUserId(response.users[0].id);
      }
    });
  }, [currentUserId, setCurrentUserId]);

  if (!users.length) {
    return null;
  }

  return (
    <select
      className="dropdown-select"
      style={style}
      value={currentUserId}
      aria-label="Current user"
      onChange={({ target }) => {
        setCurrentUserId(target.value);
        persistCurrentUserId(target.value);
        setActiveDrawingId(null);
      }}
    >
      {users.map((user) => (
        <option key={user.id} value={user.id}>
          {user.name}
        </option>
      ))}
    </select>
  );
};
