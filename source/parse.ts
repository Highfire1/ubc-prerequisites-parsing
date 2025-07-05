import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import type { CourseSaveFile, CourseParsedRequirements } from './types';
import { validateParsedRequirements, prettyPrintCourseParsedRequirements } from './utilities';

// Load environment variables
dotenv.config();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
if (!OPENROUTER_API_KEY) {
    console.error('OPENROUTER_API_KEY not found in environment variables');
    process.exit(1);
}

async function parseAllCourses() {
    const coursesDir = path.join(__dirname, 'data', 'courses');

    if (!fs.existsSync(coursesDir)) {
        console.error(`Courses directory not found: ${coursesDir}`);
        process.exit(1);
    }

    const files = fs.readdirSync(coursesDir).filter(file => file.endsWith('.json'));
    console.log(`Found ${files.length} course files to process`);

    // Read the type system documentation
    const typesDoc = fs.readFileSync(path.join(__dirname, 'types.md'), 'utf-8');

    let processed = 0;
    let parsed = 0;
    let blacklisted = 0;
    let errored = 0;

    for (const file of files) {
        const filePath = path.join(coursesDir, file);
        console.log(`\n⚙️  Processing ${file}`);

        try {
            // Step 1: Read and check status
            const courseData: CourseSaveFile = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

            if (courseData.status === 'error') {
                console.log(`  retrying. previously errored`);
            } else if (courseData.status !== 'unparsed') {
                console.log(`  ⏭️  Skipping because status is ${courseData.status}`);
                continue;
            }


            // Step 2: Check if prereq and coreq are both null
            if (!courseData.originalPrerequisite && !courseData.originalCorequisite) {
                console.log(`  ✅ ${file} - No prerequisites or corequisites, marking as parsed`);
                courseData.status = 'parsed';
                courseData.lastUpdated = new Date().toISOString();
                fs.writeFileSync(filePath, JSON.stringify(courseData, null, 2), 'utf-8');
                parsed++;
                processed++;
                continue;
            }

            // Print original prerequisites and corequisites
            if (courseData.originalPrerequisite !== null) {
                console.log(`  📜 Prerequisites: ${courseData.originalPrerequisite || 'None'}`);
            }
            if (courseData.originalCorequisite !== null) {
                console.log(`  📜 Corequisites: ${courseData.originalCorequisite || 'None'}`);
            }

            console.log('  ⏳ Asking LLM to parse requirements...');

            // Step 3: Ask LLM to parse the requirements
            const llmResult = await callLLM(courseData, typesDoc);

            if (llmResult.isError) {
                // Step 4: Set status to blacklisted
                console.log(`  🚫 ${file} - Blacklisted`);
                console.log(llmResult)
                courseData.status = 'blacklisted';
                courseData.blacklistReason = llmResult.errorMessage;
                courseData.lastUpdated = new Date().toISOString();
                fs.writeFileSync(filePath, JSON.stringify(courseData, null, 2), 'utf-8');
                blacklisted++;
                processed++;
                continue;
            }

            // Step 5: Validate the JSON schema
            console.log(`  📝 Parsed requirements:\n`);
            console.log(prettyPrintCourseParsedRequirements(llmResult.parsedRequirements!, 1));
            console.log()
            // console.log(`  ${file} - Raw JSON:`);
            // console.log(JSON.stringify(llmResult.parsedRequirements, null, 2));

            const validation = validateParsedRequirements(llmResult.parsedRequirements);

            if (!validation.isValid) {
                console.log(`  ❌ Schema validation failed: ${validation.error}`);
                console.log(` JSON: ${JSON.stringify(llmResult.parsedRequirements, null, 2)}`);
                courseData.status = 'error';
                courseData.errorMessage = validation.error;
                courseData.lastUpdated = new Date().toISOString();
                fs.writeFileSync(filePath, JSON.stringify(courseData, null, 2), 'utf-8');
                errored++;
                processed++;


                console.log('Press Enter to continue...');
                await new Promise(resolve => process.stdin.once('data', resolve));
                continue;
            }

            // Step 6: Save successful parse
            console.log(`  ✅ ${file} - Successfully parsed`);
            courseData.status = 'parsed';
            courseData.parsedRequirements = llmResult.parsedRequirements;
            courseData.lastUpdated = new Date().toISOString();
            fs.writeFileSync(filePath, JSON.stringify(courseData, null, 2), 'utf-8');
            parsed++;
            processed++;

            // Wait for 2 seconds before processing the next file
            // await new Promise(resolve => setTimeout(resolve, 2000));

        } catch (error) {
            console.error(`  ❌ Error processing ${file}:`, error);
            process.exit(1);
        }
    }

    console.log(`\nProcessing complete:`);
    console.log(`  Processed: ${processed}`);
    console.log(`  Parsed: ${parsed}`);
    console.log(`  Blacklisted: ${blacklisted}`);
    console.log(`  Errored: ${errored}`);
}

interface LLMResult {
    isError: boolean;
    errorMessage?: string;
    parsedRequirements?: CourseParsedRequirements;
}

async function callLLM(courseData: CourseSaveFile, typesDoc: string): Promise<LLMResult> {
    const prompt = `You are a system that parses UBC course prerequisites and corequisites into a structured JSON format.

COURSE: ${courseData.course}
PREREQUISITES: ${courseData.originalPrerequisite || 'None'}
COREQUISITES: ${courseData.originalCorequisite || 'None'}

TYPE SYSTEM:
${typesDoc}

TASK: Analyze the prerequisites and corequisites above. Can they be represented unambiguously using the provided type system?

If YES: Return the following JSON object.
{
  "success": true,
  "parsedRequirements": CourseParsedRequirements
}

If NO: Return a JSON object explaining why:
{
  "success": false,
  "error": "Detailed explanation of why the requirements cannot be represented unambiguously"
}

Important notes:
- Be very careful about logical grouping (ALL_OF vs ONE_OF vs TWO_OF)
- For "two of" requirements, use TWO_OF logic with all courses as children
- Use RequirementOther for high school courses, external requirements, AP credits, etc. - DO NOT blacklist these
- Pay attention to grade requirements, concurrent enrollment, etc.
- If something is unclear or ambiguous, return an error
- Only include corequisites in the response if there are actual corequisites
- Use recommendedPrerequisites and recommendedCorequisites for any requirements that are recommended but not required
- If a requirement text says "recommended" or "suggested", put it in the recommended fields instead of the required fields
- PREFER using RequirementOther over blacklisting - only blacklist if truly impossible to represent
- You MUST follow the type system exactly as defined in the provided documentation.`;

    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://github.com/ubc-parse-prerequisites',
                'X-Title': 'UBC Prerequisites Parser'
            },
            body: JSON.stringify({
                model: 'google/gemini-flash-1.5',
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                config: {
                    thinkingConfig: {
                        thinkingBudget: 10000,
                    }

                }})
        });

        if (!response.ok) {
            console.error(`OpenRouter API error: ${response.status} ${response.statusText}`);
            process.exit(1);
        }

        const result = await response.json() as any;
        const content = result.choices[0].message.content;

        // Parse the JSON response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error('No JSON found in LLM response');
            console.log('Response content:', content);
            process.exit(1);
        }

        let parsedResponse;
        try {
            parsedResponse = JSON.parse(jsonMatch[0]);
        } catch (error) {
            console.error('Failed to parse JSON response:', error);
            console.log('Response content that failed to parse:', content);
            process.exit(1);
        }

        if (parsedResponse.success) {
            return {
                isError: false,
                parsedRequirements: parsedResponse.parsedRequirements
            };
        } else {
            return {
                isError: true,
                errorMessage: parsedResponse.error
            };
        }

    } catch (error) {
        console.error('Error calling LLM:', error);
        process.exit(1);
    }
}

// Run the parser
parseAllCourses().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
