import fs from 'fs';
import path from 'path';
import type { CourseSaveFile, Requirements } from './types';

interface Stats {
    total: number;
    parsed: number;
    unparsed: number;
    blacklisted: number;
    error: number;
    
    // Course distribution
    departmentCounts: Record<string, number>;
    
    // Requirement analysis
    coursesWithPrerequisites: number;
    coursesWithCorequisites: number;
    coursesWithRecommendedPrereq: number;
    coursesWithRecommendedCoreq: number;
    coursesWithNoRequirements: number;
    
    // Requirement type analysis
    requirementTypes: Record<string, number>;
    
    // Complexity analysis
    maxRequirementDepth: number;
    averageRequirementDepth: number;
    
    // Error analysis
    errorTypes: Record<string, number>;
    blacklistReasons: Record<string, number>;
    
    // Department breakdown
    departmentStats: Record<string, {
        total: number;
        parsed: number;
        unparsed: number;
        blacklisted: number;
        error: number;
    }>;
}

async function generateStats(): Promise<Stats> {
    const coursesDir = path.join(__dirname, 'data', 'courses');
    
    if (!fs.existsSync(coursesDir)) {
        console.error(`Courses directory not found: ${coursesDir}`);
        process.exit(1);
    }

    const files = fs.readdirSync(coursesDir).filter(file => file.endsWith('.json'));
    console.log(`Analyzing ${files.length} course files...\n`);

    const stats: Stats = {
        total: 0,
        parsed: 0,
        unparsed: 0,
        blacklisted: 0,
        error: 0,
        departmentCounts: {},
        coursesWithPrerequisites: 0,
        coursesWithCorequisites: 0,
        coursesWithRecommendedPrereq: 0,
        coursesWithRecommendedCoreq: 0,
        coursesWithNoRequirements: 0,
        requirementTypes: {},
        maxRequirementDepth: 0,
        averageRequirementDepth: 0,
        errorTypes: {},
        blacklistReasons: {},
        departmentStats: {}
    };

    let totalDepth = 0;
    let coursesWithRequirements = 0;

    for (const file of files) {
        const filePath = path.join(coursesDir, file);
        
        try {
            const courseData: CourseSaveFile = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            stats.total++;

            // Extract department from course code
            const department = courseData.course.split(' ')[0] || 'UNKNOWN';
            stats.departmentCounts[department] = (stats.departmentCounts[department] || 0) + 1;

            // Initialize department stats if needed
            if (!stats.departmentStats[department]) {
                stats.departmentStats[department] = {
                    total: 0,
                    parsed: 0,
                    unparsed: 0,
                    blacklisted: 0,
                    error: 0
                };
            }
            stats.departmentStats[department].total++;

            // Status counts
            switch (courseData.status) {
                case 'parsed':
                    stats.parsed++;
                    stats.departmentStats[department].parsed++;
                    break;
                case 'unparsed':
                    stats.unparsed++;
                    stats.departmentStats[department].unparsed++;
                    break;
                case 'blacklisted':
                    stats.blacklisted++;
                    stats.departmentStats[department].blacklisted++;
                    if (courseData.blacklistReason) {
                        stats.blacklistReasons[courseData.blacklistReason] = 
                            (stats.blacklistReasons[courseData.blacklistReason] || 0) + 1;
                    }
                    break;
                case 'error':
                    stats.error++;
                    stats.departmentStats[department].error++;
                    if (courseData.errorMessage) {
                        const errorType = extractErrorType(courseData.errorMessage);
                        stats.errorTypes[errorType] = (stats.errorTypes[errorType] || 0) + 1;
                    }
                    break;
            }

            // Analyze parsed requirements
            if (courseData.status === 'parsed' && courseData.parsedRequirements) {
                const req = courseData.parsedRequirements;
                
                if (req.prerequisites) {
                    stats.coursesWithPrerequisites++;
                    const depth = getRequirementDepth(req.prerequisites);
                    totalDepth += depth;
                    coursesWithRequirements++;
                    stats.maxRequirementDepth = Math.max(stats.maxRequirementDepth, depth);
                    analyzeRequirementTypes(req.prerequisites, stats.requirementTypes);
                }
                
                if (req.corequisites) {
                    stats.coursesWithCorequisites++;
                    const depth = getRequirementDepth(req.corequisites);
                    totalDepth += depth;
                    coursesWithRequirements++;
                    stats.maxRequirementDepth = Math.max(stats.maxRequirementDepth, depth);
                    analyzeRequirementTypes(req.corequisites, stats.requirementTypes);
                }
                
                if (req.recommendedPrerequisites) {
                    stats.coursesWithRecommendedPrereq++;
                    analyzeRequirementTypes(req.recommendedPrerequisites, stats.requirementTypes);
                }
                
                if (req.recommendedCorequisites) {
                    stats.coursesWithRecommendedCoreq++;
                    analyzeRequirementTypes(req.recommendedCorequisites, stats.requirementTypes);
                }
                
                if (!req.prerequisites && !req.corequisites && 
                    !req.recommendedPrerequisites && !req.recommendedCorequisites) {
                    stats.coursesWithNoRequirements++;
                }
            }

        } catch (error) {
            console.error(`Error reading ${file}:`, error);
        }
    }

    stats.averageRequirementDepth = coursesWithRequirements > 0 ? totalDepth / coursesWithRequirements : 0;

    return stats;
}

function extractErrorType(errorMessage: string): string {
    if (errorMessage.includes('validation')) return 'Validation Error';
    if (errorMessage.includes('schema')) return 'Schema Error';
    if (errorMessage.includes('JSON')) return 'JSON Parse Error';
    if (errorMessage.includes('prerequisites')) return 'Prerequisites Error';
    if (errorMessage.includes('corequisites')) return 'Corequisites Error';
    return 'Other Error';
}

function getRequirementDepth(req: Requirements): number {
    if (req.type === 'group') {
        return 1 + Math.max(...req.children.map(child => getRequirementDepth(child)));
    }
    return 1;
}

function analyzeRequirementTypes(req: Requirements, typeCounts: Record<string, number>): void {
    typeCounts[req.type] = (typeCounts[req.type] || 0) + 1;
    
    if (req.type === 'group') {
        req.children.forEach(child => analyzeRequirementTypes(child, typeCounts));
    }
}

function printStats(stats: Stats): void {
    console.log('📊 COURSE PREREQUISITES PARSING STATISTICS');
    console.log('=' .repeat(50));
    
    // Overall status
    console.log('\n📈 OVERALL STATUS:');
    console.log(`Total courses: ${stats.total}`);
    console.log(`✅ Parsed: ${stats.parsed} (${(stats.parsed / stats.total * 100).toFixed(1)}%)`);
    console.log(`⏳ Unparsed: ${stats.unparsed} (${(stats.unparsed / stats.total * 100).toFixed(1)}%)`);
    console.log(`🚫 Blacklisted: ${stats.blacklisted} (${(stats.blacklisted / stats.total * 100).toFixed(1)}%)`);
    console.log(`❌ Error: ${stats.error} (${(stats.error / stats.total * 100).toFixed(1)}%)`);

    // Requirements analysis
    console.log('\n📋 REQUIREMENTS ANALYSIS:');
    console.log(`Courses with prerequisites: ${stats.coursesWithPrerequisites}`);
    console.log(`Courses with corequisites: ${stats.coursesWithCorequisites}`);
    console.log(`Courses with recommended prerequisites: ${stats.coursesWithRecommendedPrereq}`);
    console.log(`Courses with recommended corequisites: ${stats.coursesWithRecommendedCoreq}`);
    console.log(`Courses with no requirements: ${stats.coursesWithNoRequirements}`);

    // Complexity analysis
    console.log('\n🔍 COMPLEXITY ANALYSIS:');
    console.log(`Maximum requirement depth: ${stats.maxRequirementDepth}`);
    console.log(`Average requirement depth: ${stats.averageRequirementDepth.toFixed(2)}`);

    // Requirement types
    console.log('\n🏗️  REQUIREMENT TYPES:');
    Object.entries(stats.requirementTypes)
        .sort(([,a], [,b]) => b - a)
        .forEach(([type, count]) => {
            console.log(`${type}: ${count}`);
        });

    // Top departments
    console.log('\n🏫 TOP DEPARTMENTS:');
    Object.entries(stats.departmentCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .forEach(([dept, count]) => {
            console.log(`${dept}: ${count}`);
        });

    // Error analysis
    if (Object.keys(stats.errorTypes).length > 0) {
        console.log('\n❌ ERROR TYPES:');
        Object.entries(stats.errorTypes)
            .sort(([,a], [,b]) => b - a)
            .forEach(([type, count]) => {
                console.log(`${type}: ${count}`);
            });
    }

    // Blacklist reasons
    if (Object.keys(stats.blacklistReasons).length > 0) {
        console.log('\n🚫 BLACKLIST REASONS (top 5):');
        Object.entries(stats.blacklistReasons)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .forEach(([reason, count]) => {
                console.log(`${count}x: ${reason.substring(0, 80)}${reason.length > 80 ? '...' : ''}`);
            });
    }

    // Department breakdown
    console.log('\n📊 DEPARTMENT BREAKDOWN (top 10):');
    Object.entries(stats.departmentStats)
        .sort(([,a], [,b]) => b.total - a.total)
        .slice(0, 10)
        .forEach(([dept, deptStats]) => {
            const parseRate = (deptStats.parsed / deptStats.total * 100).toFixed(1);
            console.log(`${dept.padEnd(8)}: ${deptStats.total.toString().padStart(3)} total, ` +
                       `${deptStats.parsed.toString().padStart(3)} parsed (${parseRate}%), ` +
                       `${deptStats.blacklisted} blacklisted, ${deptStats.error} errors`);
        });
}

// Run the stats generation
generateStats().then(stats => {
    printStats(stats);
}).catch(error => {
    console.error('Error generating stats:', error);
    process.exit(1);
});
