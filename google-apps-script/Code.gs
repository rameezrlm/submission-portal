/**
 * =========================================================================
 * Student Submission Portal - Resilient Google Apps Script Backend
 * Target Google Drive Folder ID: 1IewvX8KRtt0nmRp7ZV8X8D_J_tkZn2uiL
 * =========================================================================
 */

var DEFAULT_FOLDER_ID = "1IewvX8KRtt0nmRp7ZV8X8D_J_tkZn2uiL";

/**
 * Extracts raw folder ID from full URLs or query strings.
 */
function cleanFolderId(input) {
  if (!input) return DEFAULT_FOLDER_ID;
  var str = ("" + input).trim();
  var match = str.match(/folders\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) return match[1];
  var idMatch = str.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1]) return idMatch[1];
  return str.replace(/https?:\/\/[^/]+\//, "").replace(/\//g, "").trim();
}

/**
 * Resolves the target Google Drive folder.
 * If the configured folder ID is not shared with this Google account,
 * safely falls back to a "Student Submissions" folder in the account's Drive
 * so submissions are NEVER lost.
 */
function getTargetFolder(rawFolderId) {
  var cleanId = cleanFolderId(rawFolderId || DEFAULT_FOLDER_ID);
  var effectiveEmail = "";
  try {
    effectiveEmail = Session.getEffectiveUser().getEmail();
  } catch (e) {}

  try {
    var folder = DriveApp.getFolderById(cleanId);
    return {
      folder: folder,
      folderId: cleanId,
      folderName: folder.getName(),
      fallback: false,
      effectiveEmail: effectiveEmail
    };
  } catch (err) {
    // Fallback to "Student Submissions" folder in Drive root
    var folderName = "Student Submissions";
    var existing = DriveApp.getFoldersByName(folderName);
    var fallbackFolder = existing.hasNext() ? existing.next() : DriveApp.createFolder(folderName);

    return {
      folder: fallbackFolder,
      folderId: fallbackFolder.getId(),
      folderName: fallbackFolder.getName(),
      fallback: true,
      requestedFolderId: cleanId,
      effectiveEmail: effectiveEmail,
      warning: "Target folder ID (" + cleanId + ") was not accessible to account [" + (effectiveEmail || "current user") + "]. Upload was safely saved in folder '" + folderName + "'."
    };
  }
}

/**
 * GET handler: verifies connection, account, and folder access.
 */
function doGet(e) {
  try {
    var folderResult = getTargetFolder(e && e.parameter ? e.parameter.folderId : DEFAULT_FOLDER_ID);
    var response = {
      status: "ready",
      message: folderResult.fallback
        ? folderResult.warning
        : "Student Submission Portal backend is active and connected to Drive.",
      folderId: folderResult.folderId,
      folderName: folderResult.folderName,
      fallbackUsed: folderResult.fallback,
      effectiveEmail: folderResult.effectiveEmail,
      targetFolderId: DEFAULT_FOLDER_ID,
      timestamp: new Date().toISOString()
    };
    return ContentService.createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: "Diagnostics error: " + err.toString(),
      targetFolderId: DEFAULT_FOLDER_ID
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * POST handler: receives student submission and saves to Google Drive.
 */
function doPost(e) {
  try {
    if (!e || (!e.postData && !e.parameter)) {
      throw new Error("No data received in POST request.");
    }

    var payload = {};
    if (e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (jsonErr) {
        payload = e.parameter || {};
      }
    } else if (e.parameter) {
      payload = e.parameter;
    }

    var studentName = (payload.studentName || payload.name || "").trim();
    var originalFilename = (payload.filename || payload.fileName || "submission").trim();
    var base64Data = payload.fileData || payload.base64 || "";
    var mimeType = payload.mimeType || "application/octet-stream";
    var requestedFolderId = payload.folderId || DEFAULT_FOLDER_ID;

    // Validations
    if (!studentName) {
      throw new Error("Student Full Name is required.");
    }
    if (!base64Data) {
      throw new Error("No file content received.");
    }

    // Strip Data URL prefix if present
    if (base64Data.indexOf("base64,") !== -1) {
      base64Data = base64Data.split("base64,")[1];
    }

    // Sanitize student name: "Rameez Ali" -> "Rameez_Ali"
    var cleanStudentName = studentName
      .replace(/[\\/:*?"<>|#%&{}\\$!'@+`=]/g, "")
      .replace(/\s+/g, "_")
      .trim();

    if (!cleanStudentName) {
      cleanStudentName = "Student";
    }

    // Parse base filename and extension
    var lastDotIndex = originalFilename.lastIndexOf(".");
    var baseName = originalFilename;
    var extension = "";
    if (lastDotIndex > 0) {
      baseName = originalFilename.substring(0, lastDotIndex);
      extension = originalFilename.substring(lastDotIndex);
    }

    var cleanBaseName = baseName
      .replace(/[\\/:*?"<>|]/g, "_")
      .trim();

    // Construct target filename: Assignment_Rameez_Ali.pdf
    var targetFilename = cleanBaseName + "_" + cleanStudentName + extension;

    // Resolve target Google Drive folder (with fallback protection so file is never lost)
    var folderResult = getTargetFolder(requestedFolderId);
    var folder = folderResult.folder;

    // Prevent overwriting existing files
    var existingFiles = folder.getFilesByName(targetFilename);
    if (existingFiles.hasNext()) {
      var timeFormatted = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "UTC", "yyyyMMdd_HHmmss");
      targetFilename = cleanBaseName + "_" + cleanStudentName + "_" + timeFormatted + extension;
    }

    // Decode and create file
    var decodedBytes = Utilities.base64Decode(base64Data);
    var blob = Utilities.newBlob(decodedBytes, mimeType, targetFilename);
    var createdFile = folder.createFile(blob);

    var fileId = createdFile.getId();
    var fileSize = createdFile.getSize();
    var fileUrl = createdFile.getUrl();

    var successResponse = {
      status: "success",
      message: folderResult.fallback
        ? "File uploaded to Drive in folder '" + folderResult.folderName + "'. (" + folderResult.warning + ")"
        : "File successfully uploaded and saved to Google Drive.",
      fileId: fileId,
      filename: targetFilename,
      originalFilename: originalFilename,
      studentName: studentName,
      fileSize: fileSize,
      fileUrl: fileUrl,
      folderId: folderResult.folderId,
      folderName: folderResult.folderName,
      fallbackUsed: folderResult.fallback,
      timestamp: new Date().toISOString()
    };

    return ContentService.createTextOutput(JSON.stringify(successResponse))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    var errorResponse = {
      status: "error",
      message: err.message || err.toString(),
      timestamp: new Date().toISOString()
    };
    return ContentService.createTextOutput(JSON.stringify(errorResponse))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
