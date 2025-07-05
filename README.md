# UBC Course Prerequisites Parser

It parses course prerequisites at UBC from text into data.

initialize with `bun run init`

provide an `OPENROUTER_API_KEY` in the environment or in a `.env` file.

run with `bun run parse`

print some stats with `bun run stats`

export nodes and edges with `bun run export`

DISCLAIMERS:
- the course data is outdated and predates the migration to workday. Unfortunately, UBC does not make their course data public.
- I make no guarantees about the accuracy of the parsed data. There may be errors or omissions. You should always check the official UBC website for the most accurate information.


### Stuff that claude generated

A TypeScript-based system for parsing and analyzing UBC course prerequisites and corequisites into structured data. This project fetches course data from UBCFinder, uses AI to parse natural language requirements into a structured format, and exports the data for analysis and visualization.

## 🎯 Features

- **Automated Data Fetching**: Downloads course data from UBCFinder API
- **AI-Powered Parsing**: Uses OpenRouter's Gemini Flash to parse natural language prerequisites
- **Structured Type System**: Converts requirements into a well-defined TypeScript schema
- **Comprehensive Validation**: Validates parsed data against strict schemas
- **Export Capabilities**: Generates CSV files for network analysis and visualization
- **Statistics & Analytics**: Provides detailed insights into parsing progress and course structure
- **Error Tracking**: Categorizes and tracks parsing errors and blacklisted courses

## 🏗️ Project Structure

```
├── source/
│   ├── data/
│   │   ├── courses/          # Individual course JSON files
│   │   └── fetch/            # Raw fetched data
│   ├── initialize.ts         # Fetch and initialize course data
│   ├── parse.ts             # Main parsing logic with LLM
│   ├── stats.ts             # Generate parsing statistics
│   ├── export.ts            # Export to CSV for analysis
│   ├── utilities.ts         # Validation and pretty printing
│   ├── types.ts             # TypeScript type definitions
│   └── types.md             # Type system documentation for LLM
├── package.json
├── tsconfig.json
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- [Bun](https://bun.sh/) runtime
- OpenRouter API key (for AI parsing)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd ubc-parse-prerequisites
```

2. Install dependencies:
```bash
bun install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env and add your OPENROUTER_API_KEY
```

### Usage

#### 1. Initialize Course Data
Fetch course data from UBCFinder and create individual course files:

```bash
bun run source/initialize.ts
```

This creates JSON files in `source/data/courses/` with the structure:
```typescript
{
  "schemaVersion": "UBCv0.1",
  "course": "CPSC 110",
  "originalPrerequisite": "One of MATH 100, MATH 102, MATH 104, MATH 180, MATH 184.",
  "originalCorequisite": null,
  "status": "unparsed",
  "lastUpdated": "2025-01-04T..."
}
```

#### 2. Parse Prerequisites
Use AI to parse natural language requirements into structured data:

```bash
bun run source/parse.ts
```

This processes each `unparsed` course and updates the status to:
- `parsed` - Successfully converted to structured format
- `blacklisted` - Cannot be represented in current type system
- `error` - Failed validation or other errors

#### 3. View Statistics
Get insights into parsing progress and course structure:

```bash
bun run source/stats.ts
```

#### 4. Export Data
Generate CSV files for analysis and visualization:

```bash
bun run source/export.ts
```

Creates:
- `nodes.csv` - Course nodes with metadata
- `links.csv` - Prerequisite relationships

## 📊 Type System

The parser converts natural language into a structured type system:

### Core Types

- **RequirementCourse**: Specific course (e.g., "CPSC 110")
- **RequirementGroup**: Logical groupings with ALL_OF/ONE_OF logic
- **RequirementCreditCount**: Credit hour requirements (e.g., "6 credits of MATH")
- **RequirementCourseCount**: Number of courses (e.g., "one 200-level BIOL course")
- **RequirementStanding**: Academic standing requirements
- **RequirementProgram**: Program enrollment requirements
- **RequirementPermission**: Permission-based requirements
- **RequirementOther**: Catch-all for other requirements

### Example Parsed Structure

```json
{
  "department": "CPSC",
  "code": "213",
  "prerequisites": {
    "type": "group",
    "logic": "ALL_OF",
    "children": [
      {
        "type": "course",
        "course": "CPSC 110",
        "minGrade": 60
      },
      {
        "type": "group",
        "logic": "ONE_OF",
        "children": [
          {"type": "course", "course": "MATH 100"},
          {"type": "course", "course": "MATH 102"}
        ]
      }
    ]
  }
}
```

## 🔧 Configuration

### Course Status Workflow

1. **unparsed** → Initial state for courses with requirements
2. **parsed** → Successfully converted to structured format
3. **blacklisted** → Cannot be represented (stored reason)
4. **error** → Failed validation (stored error message)

### LLM Configuration

The system uses OpenRouter's Gemini Flash model with specific prompts designed for course prerequisite parsing. The AI is instructed to:

- Distinguish between credits and course counts
- Handle logical groupings (AND/OR logic)
- Recognize grade requirements and concurrent enrollment
- Identify ambiguous requirements that cannot be structured

## 📈 Output Files

### nodes.csv
- `id`: Course identifier (e.g., "CPSC 110")
- `title`: Full course title
- `dept`: Department code
- `size`: Number of courses that depend on this course
- `depth`: Prerequisite depth (levels of dependencies)

### links.csv
- `source`: Prerequisite course ID
- `target`: Dependent course ID  
- `value`: Relationship strength (based on requirement logic)

## 🎯 Use Cases

- **Academic Planning**: Help students understand prerequisite chains
- **Curriculum Analysis**: Analyze course dependency structures
- **Network Visualization**: Create interactive course dependency graphs
- **Data Mining**: Extract patterns from course requirements
- **API Development**: Provide structured course data for applications

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and test thoroughly
4. Commit with clear messages: `git commit -m "Add feature description"`
5. Push to your fork and submit a pull request

### Development Guidelines

- Follow TypeScript best practices
- Add comprehensive type definitions
- Include error handling for all external API calls
- Update documentation for new features
- Test with various course requirement patterns

## 🙏 Acknowledgments

- [UBCFinder](https://ubcfinder.com) for providing course data
- [OpenRouter](https://openrouter.ai) for AI model access
- UBC for making course information publicly available

## 📞 Support

If you encounter issues or have questions:

1. Check existing issues in the repository
2. Review the type system documentation in `types.md`
3. Run the stats script to understand parsing status
4. Create a new issue with detailed information about the problem

---

**Note**: This is an unofficial project and is not affiliated with the University of British Columbia.
