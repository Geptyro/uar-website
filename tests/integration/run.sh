#!/usr/bin/env bash
# Full-stack integration test for the replay upload API — everything local:
# throwaway MongoDB + MinIO containers, the real built server, real HTTP.
#
#   npm run test:integration        (requires docker; runs `npm run build` first)
#
# Covers: accept, exact-file dedupe (sha256, incl. the GET pre-check),
# no-save-data rejection, junk rejection, the replace-if-longer path
# (simulated by rewriting the stored doc's sha256/durationLoops — the only
# way to emulate a second, longer recording of the same lobby without one),
# and blob retention: a pruned replay still 410s, still answers the upload
# pre-check, and is still recognised as already processed on re-upload — plus
# the ingest-time half, where a game everyone has already played past is
# recorded without its bytes ever reaching the bucket.
set -euo pipefail
cd "$(dirname "$0")/../.."

MPORT=$((20000 + RANDOM % 10000))
SPORT=$((30000 + RANDOM % 10000))
APPPORT=$((40000 + RANDOM % 10000))
SUFFIX=$$
TMP=$(mktemp -d)
CLEANUP() {
	rm -rf "$TMP"
	docker rm -f "uar-it-mongo-$SUFFIX" "uar-it-minio-$SUFFIX" >/dev/null 2>&1 || true
	# SIGKILL, not TERM: adapter-node shuts down gracefully and lingers on
	# open connections, which leaves an orphan holding the script's stdout
	[ -n "${SERVER_PID:-}" ] && kill -9 "$SERVER_PID" 2>/dev/null || true
}
trap CLEANUP EXIT

echo "· containers (mongo:$MPORT minio:$SPORT app:$APPPORT)"
docker run -d --rm --name "uar-it-mongo-$SUFFIX" -p "$MPORT:27017" mongo:7 >/dev/null
docker run -d --rm --name "uar-it-minio-$SUFFIX" -p "$SPORT:9000" \
	-e MINIO_ROOT_USER=itkey -e MINIO_ROOT_PASSWORD=itsecret123 \
	quay.io/minio/minio server /data >/dev/null

npm run build --silent >/dev/null
# static/replays/*.SC2Replay is gitignored seed data — absent in CI, present on
# a maintainer's machine, where adapter-node serves it ahead of the
# /replays/[file] route and masks the bucket entirely. Match the clean checkout
# so these checks exercise the route rather than a stale copy on disk.
rm -f build/client/replays/*.SC2Replay

for i in $(seq 1 30); do
	curl -sf "http://localhost:$SPORT/minio/health/live" >/dev/null && break
	sleep 0.5
done
curl -sf -X PUT -u itkey:itsecret123 --aws-sigv4 "aws:amz:auto:s3" \
	"http://localhost:$SPORT/uar-it" -o /dev/null

export MONGODB_URI="mongodb://localhost:$MPORT" MONGODB_DB=uar-it
export AWS_ACCESS_KEY_ID=itkey AWS_SECRET_ACCESS_KEY=itsecret123
export AWS_ENDPOINT_URL_S3="http://localhost:$SPORT" BUCKET_NAME=uar-it
# on, or the ingest-time half of the retention rule is never reached — and the
# deployment this rig stands in for runs with it on
export REPLAY_PRUNE=1
export PORT=$APPPORT ORIGIN="http://localhost:$APPPORT" BODY_SIZE_LIMIT=16M
# server.js, not `node build`: that wrapper is what the Dockerfile starts, so
# this rig would otherwise be exercising an entry point production does not use
node server.js &
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
# the class boards are derived on ingest and read by the SSR players tab; the
# fixture's recording stopped before a hero was picked, so this is the empty
# state — the page itself is what is checked, not a board
R=$(curl -s "http://localhost:$APPPORT/mos/CombatEngineer/players")
check "class players tab SSR" 'No recorded game has had a Combat Engineer' "$R"
R=$(curl -s -o /dev/null -w '%{http_code} %{size_download}' "http://localhost:$APPPORT/replays/20260723-1808.SC2Replay")
check "download streams from bucket" "200 $(stat -c%s tests/fixtures/20260723-1808.SC2Replay)" "$R"

# --- retention: a pruned blob keeps its record, its identity and its dedupe --
# The sweep deletes bytes and stamps blobPrunedAt; reproduce that end state
# directly rather than arranging a whole second game to unpin this one.
SHA=$(sha256sum tests/fixtures/20260723-1808.SC2Replay | cut -d' ' -f1)
node -e "
const {MongoClient}=require('mongodb');
(async()=>{const c=new MongoClient(process.env.MONGODB_URI);await c.connect();
await c.db(process.env.MONGODB_DB).collection('replays').updateOne(
  {_id:'20260723-1808.SC2Replay'},
  {\$set:{sha256:'$SHA',blobPrunedAt:new Date().toISOString()}});
await c.close();})()"
# drop the bytes through the same helper the sweep uses, so this also covers
# deleteObject against a real S3 endpoint
node --input-type=module -e "
const {deleteObject} = await import('./src/lib/server/replay/s3.ts');
await deleteObject('replays/20260723-1808.SC2Replay');"

R=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$APPPORT/replays/20260723-1808.SC2Replay")
check "pruned download -> 410 not 404" "410" "$R"
# load-bearing: if this ever answers false, every companion re-uploads every
# pruned file on its next backfill and the sweep undoes itself in a loop
R=$(curl -s "http://localhost:$APPPORT/api/replays?sha256=$SHA")
check "pruned replay still known to the upload pre-check" '"exists":true' "$R"
R=$(upload tests/fixtures/20260723-1808.SC2Replay)
check "re-upload of a pruned replay -> already processed" 'already processed' "$R"

# --- retention at ingest: a game that arrives already superseded ------------
# The other half of the rule: the sweep can only release a blob on a later
# pass, so an old game found by a companion's backfill would otherwise be
# uploaded, stored, and deleted again for nothing. Stage it by giving the
# fixture's players a game a day newer than the fixture and forgetting the
# fixture itself, then offering the fixture as a brand-new upload.
# A copy, not a hand-written doc: the players rebuild reads these sightings.
node -e "
const {MongoClient}=require('mongodb');
(async()=>{const c=new MongoClient(process.env.MONGODB_URI);await c.connect();
const col=c.db(process.env.MONGODB_DB).collection('replays');
const doc=await col.findOne({_id:'20260723-1808.SC2Replay'});
delete doc.blobPrunedAt;
await col.insertOne({...doc,_id:'20260724-1808.SC2Replay',
  playedAt:new Date(Date.parse(doc.playedAt)+86400000).toISOString(),
  // distinct lobby and hash, or the upload below resolves to this doc as a
  // duplicate and never reaches the retention question
  sha256:'1'.repeat(64),lobbyId:(doc.lobbyId||0)+1});
await col.deleteOne({_id:'20260723-1808.SC2Replay'});
await c.close();})()"
# its bytes went with the sweep simulation above, so the bucket is already clear
R=$(upload tests/fixtures/20260723-1808.SC2Replay)
check "superseded replay accepted" '"ok":true' "$R"
check "superseded replay not stored" '"stored":false' "$R"
R=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$APPPORT/replays/20260723-1808.SC2Replay")
check "unstored replay download -> 410, not 404" "410" "$R"
# the game is on record even though the file never was
R=$(curl -s "http://localhost:$APPPORT/replays/20260723-1808")
check "unstored replay keeps its page" 'KanaxStratz' "$R"

# --- Companion reports (POST /api/report) ---------------------------------
# Last, because the flood guard spends the endpoint's budget for the rest of
# the run: five ACCEPTED reports per address per hour, held in process memory
# (CLAUDE.md), so nothing after this could post another one.
report() { # json body -> response
	curl -s -X POST -H "Origin: http://localhost:$APPPORT" \
		-H 'content-type: application/json' \
		-d "$1" "http://localhost:$APPPORT/api/report"
}
status() { # json body -> http status only
	curl -s -o /dev/null -w '%{http_code}' -X POST -H "Origin: http://localhost:$APPPORT" \
		-H 'content-type: application/json' -d "$1" "http://localhost:$APPPORT/api/report"
}
stored() { # id -> one JSON line about the stored document
	node -e "
const {MongoClient,ObjectId}=require('mongodb');
(async()=>{const c=new MongoClient(process.env.MONGODB_URI);await c.connect();
const d=await c.db(process.env.MONGODB_DB).collection('feedback')
  .findOne({_id:new ObjectId(process.argv[1])});
console.log(JSON.stringify({source:d.source,message:d.message,app:d.app,
  anonymous:!d.account,invented:'note' in (d.app||{}),
  // whole thing when it is short enough to read back, so a check can assert
  // on what was actually sent rather than on its length
  log:d.log.length<=200?d.log:undefined,
  logLength:d.log.length,logHead:d.log.slice(0,23),logTail:d.log.slice(-9)}));
await c.close();})()" "$1"
}
idOf() { printf '%s' "$1" | sed -n 's/.*\"id\":\"\([a-f0-9]*\)\".*/\1/p'; }

R=$(report '{"message":"an error box appeared when I turned the PC off","log":"2026-01-01T00:00:00.000Z uncaught exception: boom","app":{"version":"0.11.0","platform":"win32","note":"invented"}}')
check "report accepted, id returned" '"id"' "$R"
D=$(stored "$(idOf "$R")")
check "filed as a companion report" '"source":"companion"' "$D"
check "the log is stored" 'uncaught exception: boom' "$D"
check "the app's own version kept" '"version":"0.11.0"' "$D"
check "a field the site does not keep is dropped" '"invented":false' "$D"
check "accepted with no session" '"anonymous":true' "$D"

# An over-long log is trimmed, not refused: the app that sends one is an old
# build, and an old build's report is exactly the one worth having.
node -e "
const lines=Array.from({length:3000},(_,i)=>'2026-01-01T00:00:00.000Z line '+i);
process.stdout.write(JSON.stringify({log:lines.join('\\n')}))" > "$TMP/big.json"
R=$(curl -s -X POST -H "Origin: http://localhost:$APPPORT" -H 'content-type: application/json' \
	--data-binary "@$TMP/big.json" "http://localhost:$APPPORT/api/report")
check "over-long log accepted" '"id"' "$R"
D=$(stored "$(idOf "$R")")
check "log trimmed to the 64 KB cap" '"logLength":6[0-4][0-9][0-9][0-9]' "$D"
check "the trim says so" '"logHead":"\[earlier lines trimmed\]"' "$D"
check "the trim keeps the END of the log" '"logTail":"line 2999"' "$D"

# Bigger than any trimmed log can be: refused on the way in, before the body
# is read at all.
node -e "process.stdout.write(JSON.stringify({log:'x'.repeat(400000)}))" > "$TMP/huge.json"
R=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H "Origin: http://localhost:$APPPORT" \
	-H 'content-type: application/json' --data-binary "@$TMP/huge.json" \
	"http://localhost:$APPPORT/api/report")
check "a body over the cap -> 413" '413' "$R"

check "a report saying nothing -> 400" '400' "$(status '{}')"
check "a report of only whitespace -> 400" '400' "$(status '{"message":"  ","log":"\n"}')"

# Two accepted so far, and the refusals above must not have been charged: the
# next three fill the budget and the one after is the first refusal.
for i in 1 2 3; do report '{"log":"filling the budget"}' >/dev/null; done
check "sixth accepted report in an hour -> 429" '429' "$(status '{"log":"one too many"}')"

echo
if [ "$FAILS" -gt 0 ]; then echo "FAILED: $FAILS check(s)"; exit 1; fi
echo "integration: all checks passed"
