Spec:

```
Programming Exercise

This exercise should be completed in 4 hours or less. The solution must be runnable, and can be written in any programming language. 

The challenge is to build a HTTP-based RESTful API for managing Short URLs and redirecting clients similar to bit.ly or goo.gl. Be thoughtful that the system must eventually support millions of short urls. Please include a README with documentation on how to build, and run and test the system. Clearly state all assumptions and design decisions in the README. 

A Short Url: 

1. Has one long url 
2. Permanent; Once created 
3. Is Unique; If a long url is added twice it should result in two different short urls. 
4. Not easily discoverable; incrementing an already existing short url should have a low probability of finding a working short url. 

Your solution must support: 

1. Generating a short url from a long url 
2. Redirecting a short url to a long url within 10 ms. 
3. Listing the number of times a short url has been accessed in the last 24 hours, past week and all time. 
4. Persistence (data must survive computer restarts) 

Shortcuts 

1. No authentication is required 
2. No html, web UI is required 
3. Transport/Serialization format is your choice, but the solution should be testable via curl 
```

Initial thoughts & ideas:

- Use Node.js Express w/ SQLite for the sake of moving fast & providing a deliverable that's easily ran locally.
- Consider TypeScript, likely unnecessary given time constraints.
- Use Sqids (formerly Hashids) to generate the slugs in a way that avoids collisions and isn't trivially enumerated.
  - Use a human-friendly alphabet (I should write a blog post on this) e.g. `23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ`
- Using a language that doesn't have garbage collection e.g. Rust would likely help long-term performance, but I'm considerably less productive given the time constraints.
- In terms of scaling to _millions_ of short URLs I would think in terms of adding some sort of cache:
  - Redis could be a good option, mapping slugs to their URLs and using a least-recently-used (LRU) eviction strategy.
  - Could simply load a subset of the slug -> URL mappings into application memory too. A "frecency" (frequent + recent) strategy would make sense i.e. how often _and_ recent has the slug been created and requested?
- I prefer HTTP 302 for URL shorteners because it's not uncommon to want to _change_ where you're redirecting to e.g. a new marketing campaign and non-302 methods are typically aggressively cached by the client and yields unexpected behavior that's hard to debug.

Normally I'd think to use a single table/collection e.g. `urls` and increment a field/column e.g. `hits` each request. However, part of the spec is listing the number for past 24 hours, week, and all time. Because of this I'm thinking two tables and doing a join for the statistics.

URL shorteners, sort of by design, are non-REST compliant: a requirement I personally want in a URL shortener is to easily create one within a web browser so I'll want to use a HTTP GET request to be able to create shortened URLs, which is counter intuitive.

Here's the architecture I'm thinking:

API:

```
GET /__create__?url=<url-encoded-string>

Creates a new shortened URL. Returns HTTP 201, else 400.

Obscurely named to avoid slug collisions, but kept as a GET to make it easily done via a web browser.

Optional URL query param:
- ?slug=<string> to specify slug instead of auto-generated


GET /:slug:

Gets a slug. If found, redirect HTTP 302, else 404.

Optional URL query params:
- ?debug=1 to dump the record for a slug, doesn't redirect (HTTP 200)
- ?stats=1 to dump the stats for a slug, doesn't redirect (HTTP 200)
```

DB:

```
urls
  id, int, primary key & auto-inc not null
  slug, varchar, unique not null
  url, varchar, not null
  created_at, date not null

reqs
  id, int, primary key & auto-inc not null
  url_id, int, foreign key to urls.id
  created_at, date not null
```
