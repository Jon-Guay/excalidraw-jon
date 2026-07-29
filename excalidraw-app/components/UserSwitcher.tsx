import React, { useEffect, useState } from "react";

import type { User } from "@excalidraw/api-types";

import { useAtom, useSetAtom } from "../app-jotai";
import { isServerConfigured, listUsers } from "../data/serverApi";
import {
  activeDrawingIdAtom,
  currentUserIdAtom,
  persistCurrentUserId,
} from "../data/currentUser";

let cachedUsers: User[] = [];
let usersRequest: ReturnType<typeof listUsers> | null = null;

const loadUsers = () => {
  usersRequest ??= listUsers().then((response) => {
    if (response?.users.length) {
      cachedUsers = response.users;
    } else {
      usersRequest = null;
    }
    return response;
  });
  return usersRequest;
};

export const preloadUsers = loadUsers;

export const UserSwitcher = ({ style }: { style?: React.CSSProperties }) => {
  const [currentUserId, setCurrentUserId] = useAtom(currentUserIdAtom);
  const setActiveDrawingId = useSetAtom(activeDrawingIdAtom);
  const [users, setUsers] = useState<User[]>(cachedUsers);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "error">(
    "idle",
  );

  useEffect(() => {
    if (!isServerConfigured()) {
      return;
    }
    if (users.length) {
      if (!currentUserId) {
        setCurrentUserId(users[0].id);
        persistCurrentUserId(users[0].id);
      }
      return;
    }
    setLoadState("loading");
    loadUsers().then((response) => {
      if (!response?.users.length) {
        setLoadState("error");
        return;
      }
      setUsers(response.users);
      setLoadState("idle");
      if (!currentUserId) {
        setCurrentUserId(response.users[0].id);
        persistCurrentUserId(response.users[0].id);
      }
    });
  }, [currentUserId, setCurrentUserId]);

  if (!isServerConfigured()) {
    return null;
  }

  return (
    <label
      className="user-switcher"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.25rem",
        width: "100%",
        ...style,
      }}
    >
      <span style={{ fontSize: "0.75rem", fontWeight: 600 }}>Persona</span>
      {users.length ? (
        <select
          className="dropdown-select"
          style={{ width: "100%" }}
          value={currentUserId || users[0].id}
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
      ) : (
        <span style={{ fontSize: "0.8rem" }}>
          {loadState === "error"
            ? "Users unavailable — is the API running on :3003?"
            : "Loading personas…"}
        </span>
      )}
    </label>
  );
};
