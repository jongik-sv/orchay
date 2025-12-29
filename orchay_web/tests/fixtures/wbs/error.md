# WBS - Error Test

> version: 1.0
> depth: 4

---

## WP-01: Valid Package
- status: planned
- priority: high

## INVALID-01 Missing Colon
- status: planned

### ACT-01-01: Valid Activity
- status: todo

#### TSK-01-01-01: Valid Task
- category: development
- status: done [xx]
- priority: high

## WP-02 Also Missing Colon
- status: planned

### WRONG-FORMAT: Not Valid ID
- status: todo

#### TSK-01-02-01: Another Valid Task
- category: development
- status: todo [ ]
- priority: medium

## WP-03: Another Valid Package
- status: planned
- priority: medium

### TSK-03-01: Valid 3-Level Task
- category: defect
- status: analysis [an]
