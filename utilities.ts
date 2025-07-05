
/**
 * Validates that a parsed requirements object follows the correct schema
 */
export function validateParsedRequirements(data: any): { isValid: boolean; error?: string } {
    try {
        // Check if data has required top-level properties
        if (!data || typeof data !== 'object') {
            return { isValid: false, error: 'Data must be an object' };
        }

        if (!data.department || typeof data.department !== 'string') {
            return { isValid: false, error: 'Missing or invalid department field' };
        }

        if (!data.code || typeof data.code !== 'string') {
            return { isValid: false, error: 'Missing or invalid code field' };
        }

        // Validate prerequisites if present
        if (data.prerequisites) {
            const prereqValidation = validateRequirements(data.prerequisites);
            if (!prereqValidation.isValid) {
                return { isValid: false, error: `Invalid prerequisites: ${prereqValidation.error}` };
            }
        }

        // Validate corequisites if present
        if (data.corequisites) {
            const coreqValidation = validateRequirements(data.corequisites);
            if (!coreqValidation.isValid) {
                return { isValid: false, error: `Invalid corequisites: ${coreqValidation.error}` };
            }
        }

        // Validate recommended prerequisites if present
        if (data.recommendedPrerequisites) {
            const recPrereqValidation = validateRequirements(data.recommendedPrerequisites);
            if (!recPrereqValidation.isValid) {
                return { isValid: false, error: `Invalid recommended prerequisites: ${recPrereqValidation.error}` };
            }
        }

        // Validate recommended corequisites if present
        if (data.recommendedCorequisites) {
            const recCoreqValidation = validateRequirements(data.recommendedCorequisites);
            if (!recCoreqValidation.isValid) {
                return { isValid: false, error: `Invalid recommended corequisites: ${recCoreqValidation.error}` };
            }
        }

        return { isValid: true };
    } catch (error) {
        return { isValid: false, error: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
}

/**
 * Recursively validates a Requirements object
 */
function validateRequirements(req: any): { isValid: boolean; error?: string } {
    if (!req || typeof req !== 'object') {
        return { isValid: false, error: 'Requirement must be an object' };
    }

    if (!req.type || typeof req.type !== 'string') {
        return { isValid: false, error: 'Requirement must have a valid type field' };
    }

    switch (req.type) {
        case 'group':
            return validateRequirementGroup(req);
        case 'course':
            return validateRequirementCourse(req);
        case 'credit_count':
            return validateRequirementCreditCount(req);
        case 'course_count':
            return validateRequirementCourseCount(req);
        case 'standing':
            return validateRequirementStanding(req);
        case 'program':
            return validateRequirementProgram(req);
        case 'permission':
            return validateRequirementPermission(req);
        case 'other':
            return validateRequirementOther(req);
        default:
            return { isValid: false, error: `Unknown requirement type: ${req.type}` };
    }
}

function validateRequirementGroup(req: any): { isValid: boolean; error?: string } {
    if (!req.logic || !['ALL_OF', 'ONE_OF', 'TWO_OF'].includes(req.logic)) {
        return { isValid: false, error: 'Group must have logic field with value ALL_OF, ONE_OF, or TWO_OF' };
    }

    if (!Array.isArray(req.children)) {
        return { isValid: false, error: 'Group must have children array' };
    }

    if (req.children.length === 0) {
        return { isValid: false, error: 'Group must have at least one child' };
    }

    // Validate each child
    for (let i = 0; i < req.children.length; i++) {
        const childValidation = validateRequirements(req.children[i]);
        if (!childValidation.isValid) {
            return { isValid: false, error: `Invalid child at index ${i}: ${childValidation.error}` };
        }
    }

    // Validate optional fields
    if (req.recommended !== undefined && req.recommended !== 'true') {
        return { isValid: false, error: 'recommended field must be "true" if present' };
    }

    return { isValid: true };
}

function validateRequirementCourse(req: any): { isValid: boolean; error?: string } {
    if (!req.course || typeof req.course !== 'string') {
        return { isValid: false, error: 'Course requirement must have a course field' };
    }

    // Validate optional fields
    if (req.minGrade !== undefined && (typeof req.minGrade !== 'number' || req.minGrade < 0 || req.minGrade > 100)) {
        return { isValid: false, error: 'minGrade must be a number between 0 and 100' };
    }

    if (req.canBeTakenConcurrently !== undefined && typeof req.canBeTakenConcurrently !== 'boolean') {
        return { isValid: false, error: 'canBeTakenConcurrently must be a boolean' };
    }

    if (req.mustBeTakenConcurrently !== undefined && typeof req.mustBeTakenConcurrently !== 'boolean') {
        return { isValid: false, error: 'mustBeTakenConcurrently must be a boolean' };
    }

    return { isValid: true };
}

function validateRequirementCreditCount(req: any): { isValid: boolean; error?: string } {
    if (!req.credits || typeof req.credits !== 'number' || req.credits <= 0) {
        return { isValid: false, error: 'Credit count requirement must have a positive credits field' };
    }

    // Validate optional fields
    if (req.department !== undefined) {
        if (typeof req.department === 'string') {
            // Single department is valid
        } else if (Array.isArray(req.department)) {
            if (!req.department.every((d: any) => typeof d === 'string')) {
                return { isValid: false, error: 'department array must contain only strings' };
            }
        } else {
            return { isValid: false, error: 'department must be a string or array of strings' };
        }
    }

    if (req.level !== undefined) {
        if (typeof req.level === 'string') {
            if (!['100', '200', '300', '400'].includes(req.level)) {
                return { isValid: false, error: 'level must be one of: 100, 200, 300, 400' };
            }
        } else if (Array.isArray(req.level)) {
            if (!req.level.every((l: any) => typeof l === 'string' && ['100', '200', '300', '400'].includes(l))) {
                return { isValid: false, error: 'level array must contain only valid level strings (100, 200, 300, 400)' };
            }
        } else {
            return { isValid: false, error: 'level must be a string or array of strings' };
        }
    }

    if (req.minGrade !== undefined && (typeof req.minGrade !== 'number' || req.minGrade < 0 || req.minGrade > 100)) {
        return { isValid: false, error: 'minGrade must be a number between 0 and 100' };
    }

    return { isValid: true };
}

function validateRequirementCourseCount(req: any): { isValid: boolean; error?: string } {
    if (!req.count || typeof req.count !== 'number' || req.count <= 0) {
        return { isValid: false, error: 'Course count requirement must have a positive count field' };
    }

    // Use same validation as credit count for optional fields
    if (req.department !== undefined) {
        if (typeof req.department === 'string') {
            // Single department is valid
        } else if (Array.isArray(req.department)) {
            if (!req.department.every((d: any) => typeof d === 'string')) {
                return { isValid: false, error: 'department array must contain only strings' };
            }
        } else {
            return { isValid: false, error: 'department must be a string or array of strings' };
        }
    }

    if (req.level !== undefined) {
        if (typeof req.level === 'string') {
            if (!['100', '200', '300', '400'].includes(req.level)) {
                return { isValid: false, error: 'level must be one of: 100, 200, 300, 400' };
            }
        } else if (Array.isArray(req.level)) {
            if (!req.level.every((l: any) => typeof l === 'string' && ['100', '200', '300', '400'].includes(l))) {
                return { isValid: false, error: 'level array must contain only valid level strings (100, 200, 300, 400)' };
            }
        } else {
            return { isValid: false, error: 'level must be a string or array of strings' };
        }
    }

    if (req.minGrade !== undefined && (typeof req.minGrade !== 'number' || req.minGrade < 0 || req.minGrade > 100)) {
        return { isValid: false, error: 'minGrade must be a number between 0 and 100' };
    }

    return { isValid: true };
}

function validateRequirementStanding(req: any): { isValid: boolean; error?: string } {
    if (!req.standing || !['1st', '2nd', '3rd', '4th', 'graduate'].includes(req.standing)) {
        return { isValid: false, error: 'Standing requirement must have a valid standing field' };
    }

    return { isValid: true };
}

function validateRequirementProgram(req: any): { isValid: boolean; error?: string } {
    if (!req.program || typeof req.program !== 'string') {
        return { isValid: false, error: 'Program requirement must have a program field' };
    }

    return { isValid: true };
}

function validateRequirementPermission(req: any): { isValid: boolean; error?: string } {
    if (!req.note || typeof req.note !== 'string') {
        return { isValid: false, error: 'Permission requirement must have a note field' };
    }

    return { isValid: true };
}

function validateRequirementOther(req: any): { isValid: boolean; error?: string } {
    if (!req.note || typeof req.note !== 'string') {
        return { isValid: false, error: 'Other requirement must have a note field' };
    }

    return { isValid: true };
}
