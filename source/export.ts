import fs from 'fs';
import path from 'path';
import type { CourseSaveFile, Requirements } from './types';

/**
 * Link Value Logic:
 * - ALL_OF: Each child gets the full value (default: 1)
 * - ONE_OF: Value is split among children (value / number_of_children)
 * - TWO_OF: Value is doubled then split among children ((value * 2) / number_of_children)
 * 
 * This reflects the "strength" of each requirement:
 * - ALL_OF requirements are mandatory, so each has full weight
 * - ONE_OF requirements are alternatives, so weight is distributed
 * - TWO_OF requirements need two choices, so they're weighted higher but still distributed
 */

interface Node {
    id: string;
    title: string;
    dept: string;
    size: number;
    depth: number; // Number of prerequisite levels needed to reach this course
}

interface Link {
    source: string;
    target: string;
    value: number;
}

// Extract course requirements from a Requirements node recursively with link values
function extractCourseRequirementsWithValues(node: Requirements, baseValue: number = 1): Array<{ course: string, value: number }> {
    const courses: Array<{ course: string, value: number }> = [];

    switch (node.type) {
        case 'course':
            courses.push({
                course: node.course,
                value: baseValue
            });
            break;

        case 'group':
            let childValue = baseValue;

            if (node.logic === 'ONE_OF') {
                // Split the value by the number of children in ONE_OF
                childValue = baseValue / node.children.length;
            } else if (node.logic === 'TWO_OF') {
                // For TWO_OF, double the value but split by children
                childValue = (baseValue * 2) / node.children.length;
            }
            // For ALL_OF, keep the same value

            // Recursively extract from all children with the calculated value
            for (const child of node.children) {
                courses.push(...extractCourseRequirementsWithValues(child, childValue));
            }
            break;

        // Ignore other types (credit_count, course_count, standing, etc.)
        default:
            break;
    }

    return courses;
}

// Calculate the prerequisite depth for a course
function calculatePrerequisiteDepth(node: Requirements, courseDepths: Map<string, number>): number {
    switch (node.type) {
        case 'course':
            // Return the depth of this course (0 if no prerequisites, or calculated depth + 1)
            return (courseDepths.get(node.course) || 0) + 1;

        case 'group':
            if (node.children.length === 0) return 0;

            const childDepths = node.children.map(child =>
                calculatePrerequisiteDepth(child, courseDepths)
            ).filter(depth => depth > 0); // Filter out courses with no prerequisites

            if (childDepths.length === 0) return 0;

            if (node.logic === 'ONE_OF') {
                // For ONE_OF, take the minimum depth (easiest path)
                return Math.min(...childDepths);
            } else if (node.logic === 'TWO_OF') {
                // For TWO_OF, take the second minimum depth (need two courses)
                const sorted = childDepths.sort((a, b) => a - b);
                return sorted.length >= 2 ? sorted[1]! : sorted[0]!;
            } else {
                // For ALL_OF, take the maximum depth (need all courses)
                return Math.max(...childDepths);
            }

        // Ignore other types (credit_count, course_count, standing, etc.)
        default:
            return 0;
    }
}

// Generate nodes and links from parsed requirements
function generateNodesAndLinks(courses: CourseSaveFile[]): { nodes: Node[], links: Link[] } {
    const nodesMap = new Map<string, Node>();
    const linkMap = new Map<string, Link>(); // Use map to consolidate duplicate links

    // Filter to only parsed courses
    const parsedCourses = courses.filter(course => 
        course.status === 'parsed' && course.parsedRequirements
    );

    console.log(`Processing ${parsedCourses.length} parsed courses out of ${courses.length} total courses`);

    // First pass: Calculate prerequisite depths
    const courseDepths = new Map<string, number>();

    // Initialize all courses with depth 0 (no prerequisites known yet)
    parsedCourses.forEach(course => {
        const courseId = course.course;
        courseDepths.set(courseId, 0);
    });

    // Calculate depths based on prerequisites (multiple passes to handle dependencies)
    let maxIterations = 10; // Prevent infinite loops
    let changed = true;
    
    while (changed && maxIterations > 0) {
        changed = false;
        maxIterations--;

        parsedCourses.forEach(course => {
            const courseId = course.course;
            let maxDepth = 0;
            const req = course.parsedRequirements!;

            if (req.prerequisites) {
                const prereqDepth = calculatePrerequisiteDepth(req.prerequisites, courseDepths);
                maxDepth = Math.max(maxDepth, prereqDepth);
            }

            if (req.corequisites) {
                const coreqDepth = calculatePrerequisiteDepth(req.corequisites, courseDepths);
                maxDepth = Math.max(maxDepth, coreqDepth);
            }

            const currentDepth = courseDepths.get(courseId) || 0;
            if (maxDepth > currentDepth) {
                courseDepths.set(courseId, maxDepth);
                changed = true;
            }
        });
    }

    // Second pass: Generate nodes and links
    for (const course of parsedCourses) {
        const targetId = course.course;
        const dept = course.parsedRequirements!.department;
        const depth = courseDepths.get(targetId) || 0;

        // Add the target course as a node
        if (!nodesMap.has(targetId)) {
            nodesMap.set(targetId, {
                id: targetId,
                title: targetId, // We'll update the title later
                dept: dept,
                size: 0, // Will be calculated as incoming links
                depth: depth
            });
        }

        const req = course.parsedRequirements!;

        // Extract prerequisite courses with values
        if (req.prerequisites) {
            const prerequisiteCourses = extractCourseRequirementsWithValues(req.prerequisites);

            for (const { course: prereqId, value } of prerequisiteCourses) {
                // Extract department from course ID
                const prereqDept = prereqId.split(' ')[0] || 'UNKNOWN';

                // Add prerequisite as a node
                if (!nodesMap.has(prereqId)) {
                    const prereqDepth = courseDepths.get(prereqId) || 0;
                    nodesMap.set(prereqId, {
                        id: prereqId,
                        title: prereqId,
                        dept: prereqDept,
                        size: 0,
                        depth: prereqDepth
                    });
                }

                // Create unique key for this link
                const linkKey = `${prereqId}->${targetId}`;
                const roundedValue = Math.round(value * 100) / 100;

                // Keep only the link with the highest value if duplicate exists
                if (!linkMap.has(linkKey) || linkMap.get(linkKey)!.value < roundedValue) {
                    linkMap.set(linkKey, {
                        source: prereqId,
                        target: targetId,
                        value: roundedValue
                    });
                }
            }
        }

        // Extract corequisite courses with values
        if (req.corequisites) {
            const corequisiteCourses = extractCourseRequirementsWithValues(req.corequisites);

            for (const { course: coreqId, value } of corequisiteCourses) {
                // Extract department from course ID
                const coreqDept = coreqId.split(' ')[0] || 'UNKNOWN';

                // Add corequisite as a node
                if (!nodesMap.has(coreqId)) {
                    const coreqDepth = courseDepths.get(coreqId) || 0;
                    nodesMap.set(coreqId, {
                        id: coreqId,
                        title: coreqId,
                        dept: coreqDept,
                        size: 0,
                        depth: coreqDepth
                    });
                }

                // Create unique key for this link (bidirectional for corequisites)
                const linkKey1 = `${coreqId}->${targetId}`;
                const linkKey2 = `${targetId}->${coreqId}`;
                const roundedValue = Math.round(value * 100) / 100;

                // Add both directions for corequisites
                if (!linkMap.has(linkKey1) || linkMap.get(linkKey1)!.value < roundedValue) {
                    linkMap.set(linkKey1, {
                        source: coreqId,
                        target: targetId,
                        value: roundedValue
                    });
                }
                if (!linkMap.has(linkKey2) || linkMap.get(linkKey2)!.value < roundedValue) {
                    linkMap.set(linkKey2, {
                        source: targetId,
                        target: coreqId,
                        value: roundedValue
                    });
                }
            }
        }
    }

    // Calculate size (number of incoming links) for each node
    const linkArray = Array.from(linkMap.values());
    const incomingCounts = new Map<string, number>();
    
    linkArray.forEach(link => {
        incomingCounts.set(link.target, (incomingCounts.get(link.target) || 0) + 1);
    });

    // Update node sizes
    nodesMap.forEach((node, id) => {
        node.size = incomingCounts.get(id) || 0;
    });

    // Prune nodes that have no links (neither incoming nor outgoing)
    const linkedNodeIds = new Set<string>();

    // Collect all node IDs that have links
    linkArray.forEach(link => {
        linkedNodeIds.add(link.source);
        linkedNodeIds.add(link.target);
    });

    // Filter nodes to keep only those with links
    const prunedNodes = Array.from(nodesMap.values()).filter(node =>
        linkedNodeIds.has(node.id)
    );

    return {
        nodes: prunedNodes,
        links: linkArray
    };
}

// Convert array of objects to CSV string
function arrayToCSV<T>(data: T[]): string {
    if (data.length === 0) return '';

    // Get headers from the first object
    const headers = Object.keys(data[0] as any);
    const csvRows: string[] = [];

    // Add header row
    csvRows.push(headers.join(','));

    // Add data rows
    for (const row of data) {
        const values = headers.map(header => {
            const value = (row as any)[header];
            // Escape values that contain commas or quotes
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
        });
        csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
}

async function main() {
    try {
        const coursesDir = path.join(__dirname, 'data', 'courses');
        const NODES_OUTPUT_PATH = path.join(__dirname, 'data', 'nodes.csv');
        const LINKS_OUTPUT_PATH = path.join(__dirname, 'data', 'links.csv');

        console.log('Loading course data...');

        if (!fs.existsSync(coursesDir)) {
            console.error(`Courses directory not found: ${coursesDir}`);
            process.exit(1);
        }

        // Load all course files
        const files = fs.readdirSync(coursesDir).filter(file => file.endsWith('.json'));
        const courses: CourseSaveFile[] = [];

        for (const file of files) {
            const filePath = path.join(coursesDir, file);
            try {
                const courseData: CourseSaveFile = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                courses.push(courseData);
            } catch (error) {
                console.error(`Error reading ${file}:`, error);
            }
        }

        console.log(`Loaded ${courses.length} courses`);

        // Generate nodes and links
        console.log('Generating nodes and links...');
        const { nodes, links } = generateNodesAndLinks(courses);

        console.log(`Generated ${nodes.length} nodes and ${links.length} links`);

        // Convert to CSV
        const nodesCSV = arrayToCSV(nodes);
        const linksCSV = arrayToCSV(links);

        // Ensure output directory exists
        fs.mkdirSync(path.dirname(NODES_OUTPUT_PATH), { recursive: true });

        // Write CSV files
        fs.writeFileSync(NODES_OUTPUT_PATH, nodesCSV, 'utf-8');
        fs.writeFileSync(LINKS_OUTPUT_PATH, linksCSV, 'utf-8');

        console.log(`✅ Nodes saved to: ${NODES_OUTPUT_PATH}`);
        console.log(`✅ Links saved to: ${LINKS_OUTPUT_PATH}`);

        // Print some statistics
        const departmentCounts = new Map<string, number>();
        nodes.forEach(node => {
            departmentCounts.set(node.dept, (departmentCounts.get(node.dept) || 0) + 1);
        });

        console.log('\n📊 Node Statistics by Department:');
        const sortedDepts = Array.from(departmentCounts.entries()).sort((a, b) => b[1] - a[1]);
        sortedDepts.slice(0, 10).forEach(([dept, count]) => {
            console.log(`   ${dept}: ${count} courses`);
        });

        if (sortedDepts.length > 10) {
            console.log(`   ... and ${sortedDepts.length - 10} more departments`);
        }

        // Count outgoing links for each node (how many courses each course is a prerequisite for)
        const outgoingLinkCounts = new Map<string, number>();
        links.forEach(link => {
            outgoingLinkCounts.set(link.source, (outgoingLinkCounts.get(link.source) || 0) + 1);
        });

        console.log('\n📈 Top 10 Courses (Prerequisites for most courses):');
        const sortedByLinks = Array.from(outgoingLinkCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        sortedByLinks.forEach(([courseId, linkCount], index) => {
            console.log(`   ${index + 1}. ${courseId} (prerequisite for ${linkCount} courses)`);
        });

        // Show courses with highest incoming links (most prerequisites needed)
        console.log('\n🎯 Top 10 Courses (Most prerequisites required):');
        const sortedBySize = nodes
            .sort((a, b) => b.size - a.size)
            .slice(0, 10);

        sortedBySize.forEach((node, index) => {
            console.log(`   ${index + 1}. ${node.id} (${node.size} prerequisites, depth ${node.depth})`);
        });

        // Show depth distribution
        const depthCounts = new Map<number, number>();
        nodes.forEach(node => {
            depthCounts.set(node.depth, (depthCounts.get(node.depth) || 0) + 1);
        });

        console.log('\n📊 Prerequisite Depth Distribution:');
        const sortedDepths = Array.from(depthCounts.entries()).sort((a, b) => a[0] - b[0]);
        sortedDepths.forEach(([depth, count]) => {
            console.log(`   Depth ${depth}: ${count} courses`);
        });

        // Show some examples of deep courses
        const deepCourses = nodes
            .filter(node => node.depth > 0)
            .sort((a, b) => b.depth - a.depth)
            .slice(0, 5);

        if (deepCourses.length > 0) {
            console.log('\n🏔️  Top 5 Deepest Courses:');
            deepCourses.forEach((node, index) => {
                console.log(`   ${index + 1}. ${node.id} (depth ${node.depth}, ${node.size} prerequisites)`);
            });
        }

    } catch (error) {
        console.error('Error generating exports:', error);
        process.exit(1);
    }
}

// Export for potential use in other modules
export { generateNodesAndLinks, extractCourseRequirementsWithValues };

// Run the export
main().catch(console.error);
