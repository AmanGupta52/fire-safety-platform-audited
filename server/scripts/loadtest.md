# Load test (autocannon)

Measures how the API behaves under concurrent traffic. Run it **after** deploying the performance changes so you
compare like with like.

> **Do not run this against production without telling the team first.** 20-50 simultaneous connections will use real
> Render CPU/RAM and Atlas connections, can trip your own rate limiter (every request counts, and you will see 429s),
> and can slow real customers down. Prefer a staging copy, or run it locally against `npm run dev`.

## Setup

```bash
# nothing to install: npx downloads autocannon on first use
export API_URL=http://localhost:5000      # or your staging URL, e.g. https://fire-safety-staging.onrender.com
```

Wake a free Render service first (the first request after idle takes 30-60 s and would ruin the numbers):

```bash
curl -s $API_URL/health
```

## Commands

20 connections for 20 seconds (a normal busy period):

```bash
npx autocannon -c 20 -d 20 $API_URL/api/products
npx autocannon -c 20 -d 20 $API_URL/api/categories
```

50 connections for 20 seconds (a spike):

```bash
npx autocannon -c 50 -d 20 $API_URL/api/products
npx autocannon -c 50 -d 20 $API_URL/api/categories
```

Optional: a product detail page and the sitemap (both cached), using a real slug:

```bash
npx autocannon -c 20 -d 20 $API_URL/api/products/<a-real-slug>
npx autocannon -c 20 -d 20 $API_URL/sitemap.xml
```

Write each result to a file to compare runs: add `-j > result-products-c20.json`.

## Reading the output

| Row / field | What it means | Good / worrying |
|---|---|---|
| **Latency p50** (median) | Half of requests were faster than this. What a typical visitor feels. | Under ~300 ms on Render free + Atlas in a different region is typical; far lower in the same region. |
| **Latency p97.5 / p99** | The slow tail: 1 in 100 requests was slower than this. | A p99 many times the p50 means queueing (pool exhausted, CPU saturated) or cold-start hiccups. |
| **Latency max** | Worst single request. | One huge value is often a cold start; ignore unless p99 is also high. |
| **Req/Sec (avg)** | Throughput: requests completed per second. | Higher is better. `/api/categories` should be far higher than `/api/products` once cached. |
| **Bytes/Sec** | Response data rate. | Large responses (big product lists) lower req/sec: check payload size too. |
| **"2xx responses" vs "non 2xx responses"** | Autocannon prints e.g. `1234 2xx responses, 56 non 2xx responses`. | **Any non-2xx is a finding.** 429 = your rate limiter, 502/503/504 = Render or the app falling over, 500 = a bug. |
| **errors / timeouts** | Connection resets and 10 s timeouts. | Should be 0. Timeouts mean the server could not keep up. |

Rules of thumb:

1. **Look at non-2xx first.** If it is not 0, the latency numbers are not trustworthy (error responses are fast).
   429 means the rate limiter kicked in: that is the limiter working, not a performance problem; lower `-c` or test
   against a copy with limits relaxed.
2. **Compare p50 and p99.** A small gap = healthy. A big gap that appears only at `-c 50` = you have hit a limit
   (Mongo pool is 10 connections; Render free is a fraction of one CPU).
3. **Compare `-c 20` with `-c 50`.** If req/sec stays flat while p50 roughly doubles, the server is saturated:
   adding connections only adds waiting.
4. **Run each test twice and use the second.** The first run warms the in-memory caches and Mongo's working set.
5. **Cached endpoints** (`/api/categories`, `/api/banners`, `/api/settings/public`, `/sitemap.xml`) should show much
   higher req/sec and lower latency than uncached ones (`/api/products`). If they do not, check the cache is enabled
   (it is switched off only when `NODE_ENV=test`).

## Before / after

Keep the numbers from a run made *before* these changes (check out the previous commit) next to a run after, with the
same `-c`, `-d` and URL, and the same region/instance, otherwise the comparison means nothing.
