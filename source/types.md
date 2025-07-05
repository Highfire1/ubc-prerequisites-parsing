# UBC Course Prerequisites Type System

This document describes the type system used to represent UBC course prerequisites and corequisit6. **"X of" requirements**: When a requirement says "two of", "three of", etc. from a list of specific courses:
   - "Two of POLI 260, POLI 360, POLI 361" → `group` with `logic: "TWO_OF"` and courses as children
   - "One of MATH 100, MATH 102, MATH 104" → `group` with `logic: "ONE_OF"` and courses as children
   - "Three of..." or other counts → use `other` type with detailed explanation (not supported by current type system)
7. **External/High school requirements**: Use appropriate types for external requirements:
   - "High-school calculus" → `course` type with course "HS Calculus" or similar identifier
   - "BC Principles of Mathematics 12" → `course` type with course "BC Math 12" 
   - "80% in BC Math 12" → `course` type with course "BC Math 12" and minGrade 80
   - Use `other` type only for non-course requirements (entrance exams, placement tests, etc.)
   - Do NOT blacklist courses just because they have high school or external requirements

## Main Types

### Requirements
The root type that can represent any requirement:
```typescript
type Requirements = RequirementGroup | RequirementCourse | RequirementCreditCount | RequirementCourseCount | RequirementStanding | RequirementProgram | RequirementPermission | RequirementOther;
```

### Requirement Types

#### RequirementGroup
Groups multiple requirements with logical operators:
```typescript
interface RequirementGroup {
    type: 'group';
    logic: 'ALL_OF' | 'ONE_OF' | 'TWO_OF';  // ALL_OF = AND logic, ONE_OF = OR logic, TWO_OF = choose any 2
    children: Requirements[];     // Array of nested requirements
    recommended?: 'true';         // Optional: marks as recommended rather than required
}
```

**Special case for TWO_OF**: Use when you need to choose exactly 2 from a list:
- `TWO_OF` = choose any 2 from the children
- For "three of" or other counts, use the "other" type with detailed explanation

#### RequirementCourse
Represents a specific course requirement:
```typescript
interface RequirementCourse {
    type: 'course';
    course: string;                      // Course code, e.g. "CPSC 110" or "HS Calculus 12"
    minGrade?: number;                   // Minimum grade required (0-100)
    canBeTakenConcurrently?: boolean;    // Can be taken at the same time
    mustBeTakenConcurrently?: boolean;   // Must be taken at the same time (corequisite)
}
```

**Use for:**
- UBC courses (e.g., "CPSC 110", "MATH 100")
- High school courses (e.g., "HS Calculus 12", "HS Physics 12", "BC Math 12")
- External courses that can be identified as specific courses

#### RequirementCreditCount
Requires a certain number of **credits** (credit hours):
```typescript
type courseLevels = '100' | '200' | '300' | '400';

interface RequirementCreditCount {
    type: 'credit_count';
    credits: number;                     // Number of credits required (e.g. 3, 6, 12)
    department?: string | string[];     // Optional: restrict to specific department(s)
    level?: courseLevels | courseLevels[]; // Optional: restrict to course level(s)
    minGrade?: number;                   // Optional: minimum grade in those credits (0-100)
}
```

**Use when:** The requirement specifies credit hours (e.g., "6 credits of MATH", "12 credits of upper-level courses")

#### RequirementCourseCount
Requires a certain number of **courses** (individual course units):
```typescript
interface RequirementCourseCount {
    type: 'course_count';
    count: number;                       // Number of courses required (e.g. 1, 2, 3)
    department?: string | string[];     // Optional: restrict to specific department(s)
    level?: courseLevels | courseLevels[]; // Optional: restrict to course level(s)
    minGrade?: number;                   // Optional: minimum grade in those courses (0-100)
}
```

**Use when:** The requirement specifies number of courses (e.g., "one 200-level BIOL course", "two upper-level electives", "three courses from MATH")

#### RequirementStanding
Requires a certain academic standing:
```typescript
interface RequirementStanding {
    type: 'standing';
    standing: '1st' | '2nd' | '3rd' | '4th' | 'graduate';
}
```

#### RequirementProgram
Requires enrollment in a specific program:
```typescript
interface RequirementProgram {
    type: 'program';
    program: string;  // Program name or code
}
```

#### RequirementPermission
Requires explicit permission:
```typescript
interface RequirementPermission {
    type: 'permission';
    note: string;  // Description of what permission is needed
}
```

#### RequirementOther
For requirements that don't fit other categories:
```typescript
interface RequirementOther {
    type: 'other';
    note: string;  // Description of the requirement
}
```

**Use for:**
- Admission requirements or entrance exams (e.g., "satisfactory performance on placement test")
- Complex grade/score requirements that aren't specific courses (e.g., "overall average of 80%")
- Permission-based requirements that aren't covered by RequirementPermission
- Any requirement that cannot be represented by the other specific types
- General requirements that don't map to specific courses, credits, or standing

## Expected Response Format

When parsing is successful, return a JSON object with this structure:
```typescript
interface CourseParsedRequirements {
    
    department: string;      // Course department (e.g., "CPSC")
    code: string;           // Course number (e.g., "110")

    // all of the following are optional - only include if they exist
    prerequisites?: Requirements;    // Required prerequisites
    corequisites?: Requirements;   // Optional corequisites
    recommendedPrerequisites?: Requirements;
    recommendedCorequisites?: Requirements;
}
```

**IMPORTANT:** Only include fields if they have actual requirements. Do NOT include empty groups or null/undefined fields.

## Key Parsing Rules

1. **Only include fields that exist**: If there are no prerequisites, do NOT include the `prerequisites` field at all
2. **No empty groups**: Never create groups with empty `children` arrays
3. **Single items don't need groups**: If there's only one requirement, don't wrap it in a group
4. **Credits vs Courses**: 
   - "6 credits of MATH" → `credit_count` with `credits: 6`
   - "one BIOL course" → `course_count` with `count: 1`
   - "two upper-level electives" → `course_count` with `count: 2`
5. **Combined requirements**: When a requirement mentions multiple types (e.g., "fourth-year standing in Engineering"), break it into separate requirements:
   - "fourth-year standing in Engineering" → standing requirement AND program requirement
   - "third-year standing in Mathematics Option" → standing requirement AND program requirement
6. **"X of" requirements**: When a requirement says "two of", "three of", etc. from a list of specific courses, use `course_count` with specific courses:
   - "Two of POLI 260, POLI 360, POLI 361" → `course_count` with count 2 and specific courses listed
   - "One of MATH 100, MATH 102, MATH 104" → `course_count` with count 1 and specific courses listed

## Examples

### Simple course requirement:
```json
{
  "type": "course",
  "course": "CPSC 110"
}
```

### Multiple course options (OR logic):
```json
{
  "type": "group",
  "logic": "ONE_OF",
  "children": [
    {"type": "course", "course": "CPSC 110"},
    {"type": "course", "course": "CPSC 103"}
  ]
}
```

### Multiple requirements (AND logic):
```json
{
  "type": "group",
  "logic": "ALL_OF",
  "children": [
    {"type": "course", "course": "CPSC 110"},
    {"type": "course", "course": "MATH 100"}
  ]
}
```

### Credit requirement:
```json
{
  "type": "credit_count",
  "credits": 6,
  "department": "MATH",
  "level": "100"
}
```

### Course count requirement:
```json
{
  "type": "course_count",
  "count": 1,
  "department": "BIOL",
  "level": "200"
}
```

### Multiple course requirement:
```json
{
  "type": "course_count",
  "count": 2,
  "department": ["MATH", "STAT"],
  "level": ["300", "400"]
}
```

### Combined standing and program requirement:
For "fourth-year standing in the Thermofluids Option":
```json
{
  "type": "group",
  "logic": "ALL_OF",
  "children": [
    {
      "type": "standing",
      "standing": "4th"
    },
    {
      "type": "program",
      "program": "Thermofluids Option"
    }
  ]
}
```

### Complex mixed requirements:
For "All of MECH 325, MECH 327, MECH 328, MECH 360 and fourth-year standing in the Thermofluids Option":
```json
{
  "type": "group",
  "logic": "ALL_OF",
  "children": [
    {"type": "course", "course": "MECH 325"},
    {"type": "course", "course": "MECH 327"},
    {"type": "course", "course": "MECH 328"},
    {"type": "course", "course": "MECH 360"},
    {"type": "standing", "standing": "4th"},
    {"type": "program", "program": "Thermofluids Option"}
  ]
}
```

### "Two of" requirements:
For "Two of POLI 260, POLI 360, POLI 361, POLI 362, POLI 363, POLI 364, POLI 365, POLI 366, POLI 367, POLI 368, POLI 369, POLI 370":
```json
{
  "type": "group",
  "logic": "TWO_OF",
  "children": [
    {"type": "course", "course": "POLI 260"},
    {"type": "course", "course": "POLI 360"},
    {"type": "course", "course": "POLI 361"},
    {"type": "course", "course": "POLI 362"},
    {"type": "course", "course": "POLI 363"},
    {"type": "course", "course": "POLI 364"},
    {"type": "course", "course": "POLI 365"},
    {"type": "course", "course": "POLI 366"},
    {"type": "course", "course": "POLI 367"},
    {"type": "course", "course": "POLI 368"},
    {"type": "course", "course": "POLI 369"},
    {"type": "course", "course": "POLI 370"}
  ]
}
```

### Course with only corequisites (no prerequisites):
```json
{
  "department": "BIOL",
  "code": "447",
  "corequisites": {
    "type": "course",
    "course": "BIOL 449"
  }
}
```

### Course with only prerequisites (no corequisites):
```json
{
  "department": "CPSC",
  "code": "213",
  "prerequisites": {
    "type": "course",
    "course": "CPSC 110"
  }
}
```

### High school and external requirements:
For "High-school calculus and a score of 80% or higher in BC Principles of Mathematics 12 or Pre-calculus 12":
```json
{
  "department": "MATH",
  "code": "104",
  "prerequisites": {
    "type": "group",
    "logic": "ALL_OF",
    "children": [
      {
        "type": "course",
        "course": "HS Calculus"
      },
      {
        "type": "group",
        "logic": "ONE_OF",
        "children": [
          {
            "type": "course",
            "course": "BC Principles of Mathematics 12",
            "minGrade": 80
          },
          {
            "type": "course",
            "course": "Pre-calculus 12",
            "minGrade": 80
          }
        ]
      }
    ]
  }
}
```

## Key Distinctions

- **Credits** = credit hours/units (usually 3, 6, 9, 12, etc.)
- **Courses** = individual course count (usually 1, 2, 3, etc.)
- **Only include fields that exist** - don't create empty prerequisites or corequisites
- **No empty groups** - if there's only one item, don't wrap it in a group
- **No empty children arrays** - groups must have at least one child
- **Combined requirements** - Break down complex requirements into separate components:
  - "fourth-year standing in Engineering" → standing + program requirements
  - "second-year standing in Mathematics Option" → standing + program requirements

### Examples:
- "6 credits of MATH" → `credit_count` with `credits: 6`
- "one BIOL course" → `course_count` with `count: 1`
- "two upper-level electives" → `course_count` with `count: 2`
- "BIOL 449 corequisite only" → only include `corequisites` field, no `prerequisites` field
- "fourth-year standing in Thermofluids Option" → standing requirement AND program requirement (both in ALL_OF group)
- "High-school calculus" → `course` type with course "HS Calculus"
- "80% in BC Math 12" → `course` type with course "BC Math 12" and minGrade 80
- "AP Calculus AB" → `course` type with course "AP Calculus AB"
- "placement test" → `other` type with note describing the test requirement
