# Testing Strategy

## Current test scaffolding

- Vitest validates dashboard-summary values and conversion to the UI model.
- Playwright smoke tests verify the local demo dashboard and main navigation.

These tests are scaffolding only. They have not been run in the current build environment because dependencies and a Supabase runtime are not installed here.

## Required test layers

### Unit tests

- Assessment-category aggregation and weight precision
- Missing/pending/absent/excused mark handling
- Mark maximum validation
- Grade boundary mapping and grade scale validation
- SGPA weighted by eligible course credits
- CGPA over course attempts, not mean of semester GPAs
- Every approved repeat/improvement rule
- Non-credit courses and failed courses
- Rounding modes and policy version pinning
- Incomplete-result prevention

### Database integration/security tests

Use a local Supabase project with multiple users and departments. Test the Data API/RPC directly, not only route visibility.

- Student A cannot read Student B's profile, enrollments, marks, or results by changing a UUID.
- Student cannot read draft/submitted/unapproved results.
- Teacher cannot read/update marks for an unassigned offering.
- Teacher cannot update marks after a submitted/approved/published result.
- Department admin cannot read/write another department.
- Department-scoped exam controller cannot cross department boundaries.
- Student cannot call result processing/publication RPCs.
- Ordinary users cannot grant themselves roles or change department scope.
- A correction produces a new revision and preserves the old snapshot.

### End-to-end tests

- Sign in/out and auth callback
- Protected admin, student, and teacher routes
- Student result list and semester detail when implemented
- Teacher marks entry and submission when implemented
- Review, approve, publish, and correction lifecycle when implemented

## Run

```bash
npm test
npm run test:e2e
```

Before production use, add the database integration suite and run it against a clean local Supabase database with the exact migrations applied.
