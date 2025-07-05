import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import type { CourseSaveFile } from './types';
import { SCHEMA_VERSION } from './types';


async function fetchAndStoreData() {
    const url = 'https://www.ubcfinder.com/data/course-data/subjects-prereqs/course-prereqs.json';
    const outputPath = path.join(__dirname, 'data', 'fetch', 'courses.json');
    const coursesDir = path.join(__dirname, 'data', 'courses');

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch data: ${response.statusText}`);
        }

        const data = await response.json() as any[];

        // Ensure the output directories exist
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.mkdirSync(coursesDir, { recursive: true });

        // Write the data to the file
        fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');
        console.log('Data successfully fetched and stored in:', outputPath);

        // Create individual course files
        let courseCount = 0;
        for (const course of data) {
            // Extract course code (adjust based on actual data structure)
            const courseCode = course.course || course.code || course.id;
            if (!courseCode) continue;

            const courseSaveFile: CourseSaveFile = {
                schemaVersion: SCHEMA_VERSION,
                course: courseCode,
                originalPrerequisite: course.prer ? course.prer : null,
                originalCorequisite: course.crer ? course.crer : null,
                status: (!course.prer && !course.crer) ? 'parsed' : 'unparsed',
                lastUpdated: new Date().toISOString()
            };

            // Remove undefined properties
            Object.keys(courseSaveFile).forEach(key => {
                if (courseSaveFile[key as keyof CourseSaveFile] === undefined) {
                    delete courseSaveFile[key as keyof CourseSaveFile];
                }
            });

            // Clean course code for filename (replace spaces and special chars)
            const safeFileName = courseCode.replace(/[^a-zA-Z0-9]/g, '_');
            const coursePath = path.join(coursesDir, `${safeFileName}.json`);
            
            fs.writeFileSync(coursePath, JSON.stringify(courseSaveFile, null, 2), 'utf-8');
            courseCount++;
        }
        
        console.log(`Created ${courseCount} individual course files in:`, coursesDir);
    } catch (error) {
        if (error instanceof Error) {
            console.error('Error fetching or storing data:', error.message);
        } else {
            console.error('Error fetching or storing data:', error);
        }
    }
}

fetchAndStoreData();