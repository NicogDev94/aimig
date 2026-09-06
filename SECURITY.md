# Security

## Status of the legacy prototype (January–February 2023)

The pre-Milestone-0 prototype was a single-page React app that opened a Neo4j
connection **directly from the browser**. The database credentials were
hard-coded in `src/services/neo4j.service.ts` and therefore compiled into a
JavaScript bundle that was published publicly via Azure Static Web Apps.

Anyone who loaded that page could read the credentials and obtain full
read/write access to the database.

### Exposure

| Item | Location | Status |
|---|---|---|
| Neo4j basic-auth credentials | `src/services/neo4j.service.ts` (legacy) | **Must be revoked by the repository owner** |
| Neo4j endpoint `neo4j-dev-bolt.saliez.be:443` | same file | Must be verified unreachable with the old credentials |
| Azure Static Web Apps deploy token | GitHub Actions secret `AZURE_STATIC_WEB_APPS_API_TOKEN_HAPPY_GLACIER_01AE35C03` | Not exposed in source; revoke with the deployment |

A scan of the current HEAD found no other real secret. `.env` was empty and has
been removed; a bare `.env` is now git-ignored.

### Actions completed in the repository

- Removed the legacy Azure Static Web Apps deployment workflow.
- Removed the empty `.env` file and ignored it going forward.
- The credential-bearing legacy application is deleted from HEAD by the
  Milestone 0 foundation change that follows this one.

### Actions that must be performed outside the repository

These require access to the Neo4j and Azure consoles and cannot be done from
the codebase:

1. **Revoke the exposed Neo4j credentials.** This is the only step that
   actually ends the exposure.
2. Verify `neo4j-dev-bolt.saliez.be:443` no longer accepts the old
   credentials, or decommission the instance entirely — nothing in the
   Milestone 0 architecture depends on it.
3. Unpublish the Azure Static Web Apps site if it is no longer useful, and
   revoke its deployment token.

### On Git history

The credentials remain in the Git history and in any existing clone. This is
**not** a reason to rewrite history: once the credentials are revoked they
carry no value, while a history rewrite invalidates every existing clone for
no security gain. Revocation is the fix; history rewriting is not.

## Reporting

This is a research prototype. It is not a medical device, it holds no real
patient data, and it must not be used clinically. See the validation notice
rendered by the reasoning engine and its documentation.
