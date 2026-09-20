# Resilient Distributed Webhook Ingestion Engine

A production-grade, fault-tolerant webhook ingestion engine built with **Node.js**, **Express**, **MongoDB Atlas**, **Upstash Redis**, and **BullMQ**. 

Engineered to solve real-world distributed systems challenges: cryptographic tampering, cache penetration, database connection exhaustion, downstream service failures, and webhook delivery timeouts.

---

## Architecture Overview

```text
[ Incoming Webhook ] ──► [ Raw Buffer Capture ]
                               │
                               ▼
               [ Cryptographic HMAC Verification ] ──(Invalid)──► 401 Unauthorized
                               │ (Valid)
                               ▼
                   [ Fast RAM Idempotency Shield ] ──(Key Exists)──► 200 IGNORED_DUPLICATE
                     (Redis SETNX - 24h TTL)
                               │ (New Event)
                               ▼
               [ Persistent Database Storage ] ──(Duplicate 11000)──► 200 IGNORED_DUPLICATE
                     (MongoDB Unique Index)
                               │
                               ▼
                   [ BullMQ Job Enqueue ]
                               │
                               ▼
                 [ Fast HTTP 201 Acknowledgment ] (< 50ms)
                               │
                      (Async Processing)
                               │
                               ▼
                   [ Asynchronous Worker ]
                               │
              ┌────────────────┴────────────────┐
              ▼                                 ▼
      [ Work Succeeded ]                [ Work Failed ]
              │                                 │
              ▼                                 ▼
       MongoDB Status:                 BullMQ Exponential Backoff
          COMPLETED                       (Max 3 Attempts)
                                                │
                                       (Retries Exhausted)
                                                │
                                                ▼
                                         MongoDB Status:
                                        FAILED (Dead Letter)