# Result Workflow

## Intended lifecycle

```mermaid
flowchart TD
  A[Create academic structures] --> B[Create course offering]
  B --> C[Enroll students and assign teachers]
  C --> D[Configure assessment scheme and events]
  D --> E[Teacher enters draft marks]
  E --> F[Validate completeness and mark limits]
  F --> G[Teacher submits marks]
  G --> H[Department / exam controller reviews]
  H --> I[Calculate course results, SGPA, and CGPA]
  I --> J[Approve results]
  J --> K[Publish semester snapshot]
  K --> L[Student views own published result]
  K --> M[Authorized correction request]
  M --> N[Review, recalculate, audit, and republish]
```

## States

The database result status enum includes `draft`, `submitted`, `under_review`, `approved`, `published`, and `locked`.

## Current implementation

- The data model and enum are in place.
- Marks are related to course enrollment and assessment; validation prevents invalid ranges.
- Marks linked to result records at `submitted` or later states are locked from ordinary mark updates.
- Published result snapshots reject ordinary update/delete operations.
- `result_corrections` records a scoped request structure.

The transactional submit/review/calculate/approve/publish/reopen/correction RPCs are not implemented yet. Until those exist, the lifecycle cannot be used end to end and no official result can be published by this starter.
