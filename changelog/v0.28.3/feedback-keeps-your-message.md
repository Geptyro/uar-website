---
title: A failed feedback send no longer eats your message
type: fix
area: site
impact: minor
---
If the database was briefly unreachable when you hit send, the feedback page
used to throw you to an error screen with everything you had typed gone. It now
tells you it could not save it and leaves your message in the box, so sending
again is one click.
