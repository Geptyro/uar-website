#!/usr/bin/env bash
# Full-stack integration test for the replay upload API — everything local:
# throwaway MongoDB + MinIO containers, the real built server, real HTTP.
#
#   npm run test:integration        (requires docker; runs `npm run build` first)
#
# Covers: accept, exact-file dedupe (sha256, incl. the GET pre-check),
# no-save-data rejection, junk rejection, and the replace-if-longer path
# (simulated by rewriting the stored doc's sha256/durationLoops — the only
# way to emulate a second, longer recording of the same lobby without one).
set -euo pipefail
cd "$(dirname "$0")/../.."

MPORT=$((20000 + RANDOM % 10000))
SPORT=$((30000 + RANDOM % 10000))
APPPORT=$((40000 + RANDOM % 10000))
SUFFIX=$$
CLEANUP() {
	docker rm -f "uar-it-mongo-$SUFFIX" "uar-it-minio-$SUFFIX" >/dev/null 2>&1 || true
	[ -n "${SERVER_PID:-}" ] && kill "$SERVER_PID" 2>/dev/null || true
}
trap CLEANUP EXIT

echo "· containers (mongo:$MPORT minio:$SPORT app:$APPPORT)"
docker run -d --rm --name "uar-it-mongo-$SUFFIX" -p "$MPORT:27017" mongo:7 >/dev/null
docker run -d --rm --name "uar-it-minio-$SUFFIX" -p "$SPORT:9000" \
	-e MINIO_ROOT_USER=itkey -e MINIO_ROOT_PASSWORD=itsecret123 \
	quay.io/minio/minio server /data >/dev/null

npm run build --silent >/dev/null

for i in $(seq 1 30); do
	curl -sf "http://localhost:$SPORT/minio/health/live" >/dev/null && break
	sleep 0.5
done
curl -sf -X PUT -u itkey:itsecret123 --aws-sigv4 "aws:amz:auto:s3" \
	"http://localhost:$SPORT/uar-it" -o /dev/null

export MONGODB_URI="mongodb://localhost:$MPORT" MONGODB_DB=uar-it
export AWS_ACCESS_KEY_ID=itkey AWS_SECRET_ACCESS_KEY=itsecret123
export AWS_ENDPOINT_URL_S3="http://localhost:$SPORT" BUCKET_NAME=uar-it
export PORT=$APPPORT ORIGIN="http://localhost:$APPPORT" BODY_SIZE_LIMIT=16M
node build &
SERVER_PID=$!
for i in $(seq 1 30); do
	curl -sf "http://localhost:$APPPORT/" >/dev/null && break
	sleep 0.5
done

FAILS=0
check() { # name, expected-substring, actual
	if echo "$3" | grep -q "$2"; then echo "  ✔ $1"; else
		echo "  ✖ $1 — expected '$2', got: $3"
		FAILS=$((FAILS + 1))
	fi
}
upload() {
	curl -s -X POST -H "Origin: http://localhost:$APPPORT" \
		-F "replay=@$1" "http://localhost:$APPPORT/api/replays"
}

R=$(upload tests/fixtures/20260723-1808.SC2Replay)
check "accept real replay" '"ok":true' "$R"
check "canonical name" '20260723-1808.SC2Replay' "$R"

R=$(upload tests/fixtures/20260723-1808.SC2Replay)
check "sha256 duplicate -> 409" 'exact replay file is already ingested' "$R"

SHA=$(sha256sum tests/fixtures/20260723-1808.SC2Replay | cut -d' ' -f1)
R=$(curl -s "http://localhost:$APPPORT/api/replays?sha256=$SHA")
check "GET pre-check knows the file" '"exists":true' "$R"
R=$(curl -s "http://localhost:$APPPORT/api/replays?sha256=$(printf 'a%.0s' $(seq 64))")
check "GET pre-check unknown hash" '"exists":false' "$R"

R=$(upload tests/fixtures/20260723-1802.SC2Replay)
check "no-save-data replay -> 400" 'No player save data' "$R"

R=$(upload package.json)
check "junk file -> 400" 'Not a readable' "$R"

# simulate a second, longer recording of the same lobby: same bytes would hit
# the sha check, so rewrite the stored doc's hash and shrink its duration
node -e "
const {MongoClient}=require('mongodb');
(async()=>{const c=new MongoClient(process.env.MONGODB_URI);await c.connect();
await c.db(process.env.MONGODB_DB).collection('replays').updateOne(
  {_id:'20260723-1808.SC2Replay'},
  {\$set:{sha256:'0'.repeat(64),durationLoops:10}});
await c.close();})()"
R=$(upload tests/fixtures/20260723-1808.SC2Replay)
check "longer recording replaces stored one" '"replaced":true' "$R"
R=$(upload tests/fixtures/20260723-1808.SC2Replay)
check "replacement is deduped again" 'exact replay file is already ingested' "$R"

R=$(curl -s "http://localhost:$APPPORT/players")
check "/players SSR shows the player" 'KanaxStratz' "$R"
R=$(curl -s -o /dev/null -w '%{http_code} %{size_download}' "http://localhost:$APPPORT/replays/20260723-1808.SC2Replay")
check "download streams from bucket" "200 $(stat -c%s tests/fixtures/20260723-1808.SC2Replay)" "$R"

echo
if [ "$FAILS" -gt 0 ]; then echo "FAILED: $FAILS check(s)"; exit 1; fi
echo "integration: all checks passed"
