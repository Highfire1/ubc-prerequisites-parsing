export const SCHEMA_VERSION = 'UBCv0.1';

export interface CourseSaveFile {
    schemaVersion: string;
    course: string;

    originalPrerequisite: string | null;
    originalCorequisite: string | null;

    status: 'parsed' | 'unparsed' | 'blacklisted' | 'error';
    parsedRequirements?: CourseParsedRequirements;
    blacklistReason?: string;
    errorMessage?: string;
    lastUpdated: string; // ISO date string
}

export interface CourseParsedRequirements {
    department: string;
    code: string;
    prerequisites?: Requirements;
    corequisites?: Requirements;
    recommendedPrerequisites?: Requirements;
    recommendedCorequisites?: Requirements;
}

export type Requirements = RequirementGroup | RequirementCourse | RequirementCreditCount | RequirementCourseCount | RequirementStanding | RequirementProgram | RequirementPermission | RequirementOther;

interface RequirementGroup {
    type: 'group';
    logic: 'ALL_OF' | 'ONE_OF' | 'TWO_OF';
    children: Requirements[];
}

interface RequirementCourse {
    type: 'course';
    course: string; // e.g. "CPSC 110"
    minGrade?: number; // 0-100
    canBeTakenConcurrently?: boolean;
    mustBeTakenConcurrently?: boolean;
}

type courseLevels = '100' | '200' | '300' | '400';

interface RequirementCreditCount {
    type: 'credit_count';
    credits: number;
    department?: string | string[];
    level?: courseLevels | courseLevels[];
    minGrade?: number; // 0-100
}

interface RequirementCourseCount {
    type: 'course_count';
    count: number;
    department?: string | string[];
    level?: courseLevels | courseLevels[];
    minGrade?: number; // 0-100
}

interface RequirementStanding {
    type: 'standing';
    standing: '1st' | '2nd' | '3rd' | '4th' | 'graduate';
}

interface RequirementProgram {
    type: 'program';
    program: string;
}

interface RequirementPermission {
    type: 'permission';
    note: string;
}

interface RequirementOther {
    type: 'other';
    note: string;
}