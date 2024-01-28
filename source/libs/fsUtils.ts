import fs from 'fs';
import path from 'path';

function getDirectories(directoryPath: string): string[] {
    try {
        const filesAndDirs = fs.readdirSync(directoryPath);
        const directories = filesAndDirs.filter(item =>
            fs.statSync(path.join(directoryPath, item)).isDirectory()
        );
        return directories;
    } catch (error) {
        console.error(`Error reading directories in ${directoryPath}: ${error}`);
        return [];
    }
}


export { getDirectories };