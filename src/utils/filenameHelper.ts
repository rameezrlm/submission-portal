/**
 * Helpers for sanitizing student names and creating predictable, conflict-free filenames.
 */

export function sanitizeStudentName(name: string): string {
  if (!name) return 'Student';
  return name
    .trim()
    .replace(/[\\/:*?"<>|#%&{}\\$!'@+`=]/g, '')
    .replace(/\s+/g, '_');
}

export function generateTargetFilename(originalFilename: string, studentName: string): {
  targetFilename: string;
  baseName: string;
  cleanStudentName: string;
  extension: string;
} {
  const cleanStudent = sanitizeStudentName(studentName);
  const trimmedOriginal = (originalFilename || 'submission').trim();

  const lastDotIndex = trimmedOriginal.lastIndexOf('.');
  let baseName = trimmedOriginal;
  let extension = '';

  if (lastDotIndex > 0) {
    baseName = trimmedOriginal.substring(0, lastDotIndex);
    extension = trimmedOriginal.substring(lastDotIndex);
  }

  // Sanitize base filename for filesystem safety
  const cleanBase = baseName.replace(/[\\/:*?"<>|]/g, '_');
  const targetFilename = `${cleanBase}_${cleanStudent}${extension}`;

  return {
    targetFilename,
    baseName: cleanBase,
    cleanStudentName: cleanStudent,
    extension,
  };
}

export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}
