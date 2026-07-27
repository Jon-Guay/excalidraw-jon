#!/usr/bin/env bash
#
# Repo-wide verification gates. Run with no arguments for every gate, or name
# gates to run a subset: ./scripts/verify.sh typecheck test
#
# Every gate is expected green on a clean checkout. A red gate means the working
# tree regressed, not that the gate needs adjusting.

set -uo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

# The repo pins yarn 1.22.22 but a global yarn is not guaranteed on a fresh
# machine, and npm's global install is blocked in some sandboxes.
if command -v yarn >/dev/null 2>&1; then
  YARN=(yarn)
else
  YARN=(npx --yes yarn@1.22.22)
fi

DEV_PORT="${VITE_APP_PORT:-3001}"
SERVER_PORT="${EXCALIDRAW_SERVER_PORT:-3003}"
GATE_NAMES=()
GATE_RESULTS=()
GATE_DETAILS=()
FAILED=0

record() {
  GATE_NAMES+=("$1")
  GATE_RESULTS+=("$2")
  GATE_DETAILS+=("$3")
  [[ "$2" == FAIL ]] && FAILED=1
  printf '%s %s (%s)\n' "$2" "$1" "$3"
}

# Runs a command, hides its output unless it fails, and reports wall time.
gate() {
  local name="$1"
  shift
  local log
  log="$(mktemp)"
  local start=$SECONDS
  if "$@" >"$log" 2>&1; then
    record "$name" PASS "$((SECONDS - start))s"
  else
    record "$name" FAIL "$((SECONDS - start))s, see below"
    printf -- '---- %s output ----\n' "$name"
    tail -40 "$log"
    printf -- '---- end %s ----\n' "$name"
  fi
  rm -f "$log"
}

# A present node_modules proves nothing; it can be stale or built from a
# different lockfile. --check-files makes yarn compare the tree to the lockfile.
gate_deps() {
  if [[ ! -d node_modules ]]; then
    record deps FAIL "run: ${YARN[*]} install"
    return
  fi
  gate deps "${YARN[@]}" install --frozen-lockfile --check-files --non-interactive
}

gate_typecheck() { gate typecheck "${YARN[@]}" test:typecheck; }
gate_lint() { gate lint "${YARN[@]}" test:code; }
gate_format() { gate format "${YARN[@]}" test:other; }
gate_test() { gate test "${YARN[@]}" test:app --watch=false --reporter=basic; }

port_listener_pids() {
  lsof -nP -iTCP:"$1" -sTCP:LISTEN -t 2>/dev/null
}

# Only ever reclaims a port from this repo's own dev server. Killing whatever
# happens to hold the port would take out an unrelated process of the user's.
is_our_dev_server() {
  local pid="$1" argv
  argv="$(ps -o command= -p "$pid" 2>/dev/null)"
  [[ "$argv" == *vite* || "$argv" == *excalidraw-app* ]]
}

# Reclaims the port before and after the boot gate. Without this a server leaked
# by a crashed earlier run answers the probe and the gate passes green in
# milliseconds without ever starting the thing it claims to test.
free_port() {
  local port="$1" pids pid
  for _ in $(seq 1 15); do
    pids="$(port_listener_pids "$port")"
    [[ -z "$pids" ]] && return 0
    for pid in $pids; do
      if is_our_dev_server "$pid"; then
        kill -9 "$pid" 2>/dev/null
      else
        printf 'port %s held by pid %s which is not our dev server; refusing to kill it\n' \
          "$port" "$pid" >&2
        return 1
      fi
    done
    sleep 1
  done
  [[ -z "$(port_listener_pids "$port")" ]]
}

BOOT_PID=""
BOOT_PORT=""

# Kills the yarn wrapper, then the vite process actually holding the port. The
# wrapper and the server are separate processes, so stopping one leaves the other.
stop_boot_server() {
  if [[ -n "$BOOT_PID" ]]; then
    kill -TERM "$BOOT_PID" 2>/dev/null
    BOOT_PID=""
  fi
  [[ -n "$BOOT_PORT" ]] && free_port "$BOOT_PORT" >/dev/null 2>&1
  return 0
}

# Without this, cancelling the script between launch and cleanup leaks a vite
# process that silently satisfies the next run's probe.
trap 'stop_boot_server; stop_api_server' EXIT INT TERM

# Boots the dev server on a throwaway port and asserts the app actually serves,
# because a compiling bundle is not proof the app serves.
gate_boot() {
  if ! command -v lsof >/dev/null 2>&1; then
    record boot FAIL "lsof not available, cannot tell a free port from a leaked one"
    return
  fi

  local port=$((DEV_PORT + 500))
  local log
  log="$(mktemp)"
  BOOT_PORT="$port"

  if ! free_port "$port"; then
    record boot FAIL "port ${port} occupied and could not be reclaimed"
    rm -f "$log"
    return
  fi

  # Deliberately no job control here. Backgrounding into a separate process
  # group makes esbuild's service child take a stop signal mid-transform, which
  # kills the dev server. Teardown finds the real listener by port instead.
  VITE_APP_PORT="$port" "${YARN[@]}" start >"$log" 2>&1 </dev/null &
  BOOT_PID=$!

  local body=""
  for _ in $(seq 1 60); do
    body="$(curl -fsS "http://localhost:${port}/" 2>/dev/null)" && break
    sleep 1
  done

  local detail="" served=FAIL
  if [[ "$body" != *"<title>Excalidraw"* ]]; then
    detail="no app HTML on :${port} after 60s"
  elif [[ "$body" != *'id="root"'* ]]; then
    detail="served HTML but no #root mount point"
  else
    # Title-bearing HTML can be served by a stale build or an error page, so
    # follow the entry module and confirm the bundler actually compiles it.
    # Skip /@vite/client, which is the injected HMR client rather than the app.
    local entry status
    entry="$(printf '%s' "$body" \
      | tr '<' '\n' \
      | sed -n 's/^script .*type="module".*src="\([^"]*\)".*/\1/p' \
      | grep -v '@vite' | head -1)"
    # The entry src is relative in index.html, so it needs a leading slash.
    [[ -n "$entry" && "$entry" != /* ]] && entry="/${entry}"
    # Reads the whole body to /dev/null. Truncating the stream breaks vite's
    # pipe mid-write, which kills its esbuild service and takes the server down.
    status="$(curl -s -o /dev/null -w '%{http_code}' --max-time 120 "http://localhost:${port}${entry}" 2>/dev/null)"
    if [[ -z "$entry" ]]; then
      detail="served HTML but found no app entry module"
    elif [[ "$status" != 200 ]]; then
      detail="entry module ${entry} returned ${status}"
    else
      served=PASS
      detail="app HTML, #root and entry ${entry} served on :${port}"
    fi
  fi

  stop_boot_server

  if [[ "$served" == PASS ]]; then
    if [[ -z "$(port_listener_pids "$port")" ]]; then
      record boot PASS "$detail"
    else
      record boot FAIL "served correctly but leaked a server on :${port}"
    fi
  else
    record boot FAIL "$detail"
    tail -20 "$log"
  fi
  BOOT_PORT=""
  rm -f "$log"
}

gate_migrate() {
  if ! command -v node >/dev/null 2>&1; then
    record migrate FAIL "node not available"
    return
  fi

  local tmpdir db_path log first second
  tmpdir="$(mktemp -d /tmp/excalidraw-verify-XXXXXX)"
  db_path="${tmpdir}/verify.db"
  log="$(mktemp)"

  DB_FILE_NAME="$db_path" "${YARN[@]}" --cwd server migrate >"$log" 2>&1
  if [[ $? -ne 0 ]]; then
    record migrate FAIL "first migration run failed, see below"
    tail -40 "$log"
    rm -rf "$log" "$tmpdir"
    return
  fi

  first="$(DB_FILE_NAME="$db_path" "${YARN[@]}" --cwd server migrate 2>>"$log")"
  second="$(DB_FILE_NAME="$db_path" "${YARN[@]}" --cwd server migrate 2>>"$log")"

  rm -f "$log"
  rm -rf "$tmpdir"

  if [[ "$first" == *"0001_init"* && "$second" == *"0001_init"* ]]; then
    record migrate PASS "migrations idempotent on throwaway db"
  else
    record migrate FAIL "second migration run did not no-op cleanly"
  fi
}

SERVER_PID=""
SERVER_TEST_PORT=""

# Reclaims a throwaway port after the api gate. Call only for ports this script
# just bound; anything still listening after teardown is from our own run.
force_free_port() {
  local port="$1" pids pid
  for _ in $(seq 1 15); do
    pids="$(port_listener_pids "$port")"
    [[ -z "$pids" ]] && return 0
    for pid in $pids; do
      kill -9 "$pid" 2>/dev/null
    done
    sleep 1
  done
  [[ -z "$(port_listener_pids "$port")" ]]
}

stop_api_server() {
  if [[ -n "$SERVER_PID" ]]; then
    pkill -TERM -P "$SERVER_PID" 2>/dev/null
    kill -TERM "$SERVER_PID" 2>/dev/null
    sleep 1
    pkill -KILL -P "$SERVER_PID" 2>/dev/null
    kill -KILL "$SERVER_PID" 2>/dev/null
    SERVER_PID=""
  fi
  [[ -n "$SERVER_TEST_PORT" ]] && force_free_port "$SERVER_TEST_PORT" >/dev/null 2>&1
  return 0
}

is_our_api_server() {
  local pid="$1" argv
  argv="$(ps -o args= -p "$pid" 2>/dev/null)"
  [[ "$argv" == *server/src/index.ts* || "$argv" == *src/index.ts* ]]
}

free_api_port() {
  local port="$1" pids pid
  for _ in $(seq 1 15); do
    pids="$(port_listener_pids "$port")"
    [[ -z "$pids" ]] && return 0
    for pid in $pids; do
      if is_our_api_server "$pid"; then
        kill -9 "$pid" 2>/dev/null
      else
        printf 'port %s held by pid %s which is not our api server; refusing to kill it\n' \
          "$port" "$pid" >&2
        return 1
      fi
    done
    sleep 1
  done
  [[ -z "$(port_listener_pids "$port")" ]]
}

gate_api() {
  if ! command -v lsof >/dev/null 2>&1; then
    record api FAIL "lsof not available, cannot tell a free port from a leaked one"
    return
  fi

  local port=$((SERVER_PORT + 500)) log body
  log="$(mktemp)"
  SERVER_TEST_PORT="$port"

  if ! free_api_port "$port"; then
    record api FAIL "port ${port} occupied and could not be reclaimed"
    rm -f "$log"
    return
  fi

  local tmpdir db_path
  tmpdir="$(mktemp -d /tmp/excalidraw-api-verify-XXXXXX)"
  db_path="${tmpdir}/verify.db"

  PORT="$port" DB_FILE_NAME="$db_path" "${YARN[@]}" --cwd server start >"$log" 2>&1 </dev/null &
  SERVER_PID=$!

  body=""
  for _ in $(seq 1 60); do
    body="$(curl -fsS "http://localhost:${port}/health" 2>/dev/null)" && break
    sleep 1
  done

  stop_api_server

  if [[ "$body" == *'"status":"ok"'* && "$body" == *'"migrationVersion":"0001_init"'* ]]; then
    if [[ -z "$(port_listener_pids "$port")" ]]; then
      record api PASS "GET /health returned expected body on :${port}"
    else
      record api FAIL "health check passed but leaked a server on :${port}"
    fi
  else
    record api FAIL "GET /health did not return expected body on :${port}"
    tail -20 "$log"
  fi

  rm -rf "$tmpdir"
  rm -f "$log"
  SERVER_TEST_PORT=""
}

ALL_GATES=(deps typecheck lint format test boot migrate api)
REQUESTED=("$@")
[[ ${#REQUESTED[@]} -eq 0 ]] && REQUESTED=("${ALL_GATES[@]}")

for name in "${REQUESTED[@]}"; do
  if ! printf '%s\n' "${ALL_GATES[@]}" | grep -qx "$name"; then
    printf 'unknown gate: %s\nknown gates: %s\n' "$name" "${ALL_GATES[*]}" >&2
    exit 2
  fi
  "gate_${name}"
done

printf '\n%-12s %-6s %s\n' GATE RESULT DETAIL
for i in "${!GATE_NAMES[@]}"; do
  printf '%-12s %-6s %s\n' "${GATE_NAMES[$i]}" "${GATE_RESULTS[$i]}" "${GATE_DETAILS[$i]}"
done

exit "$FAILED"
