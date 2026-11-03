# Google Apps Script Backend Setup Guide

This Google Apps Script acts as the secure serverless backend that receives uploads from the **Student Submission Portal** and stores them directly into the Google Drive folder without requiring students to log in or register.

- **Target Folder Link**: [https://drive.google.com/drive/folders/1IewvX8KRtt0nmRp7ZV8X8D_J_tkZn2uiL](https://drive.google.com/drive/folders/1IewvX8KRtt0nmRp7ZV8X8D_J_tkZn2uiL)
- **Target Folder ID**: `1IewvX8KRtt0nmRp7ZV8X8D_J_tkZn2uiL`

---

## 5-Minute Setup Instructions

1. **Open Google Apps Script**:
   Navigate to [script.google.com](https://script.google.com/home) and click **+ New project**.

2. **Paste the Script**:
   - Delete everything in `Code.gs`.
   - Copy the entire contents of `google-apps-script/Code.gs` and paste it into the editor.
   - Rename the project in the top left to `Student Submission Backend`.
   - Press **Save** (Ctrl+S or Cmd+S).

3. **Deploy as Web App**:
   - In the top right, click **Deploy** > **New deployment**.
   - Click the **gear icon (Select type)** and pick **Web app**.
   - Set the configuration:
     - **Description**: `Student Submission Web App`
     - **Execute as**: `Me (your email)`
     - **Who has access**: `Anyone` *(Crucial: This enables students to upload without needing Google authentication)*
   - Click **Deploy**.

4. **Authorize Access**:
   - Google will show a prompt: *"Authorization required"*.
   - Click **Authorize access**, choose your Google account.
   - If prompted with *"Google hasn't verified this app"*, click **Advanced** > **Go to Student Submission Backend (unsafe)**.
   - Click **Allow** to give the script permission to create files in your Drive.

5. **Copy Web App URL**:
   - Copy the generated URL ending with `/exec` (e.g., `https://script.google.com/macros/s/AKfycb.../exec`).
   - Paste this URL into the **Deployment Settings** inside the Student Submission Portal or save it in your `.env` file as `VITE_GOOGLE_APPS_SCRIPT_URL`.

---

## Privacy & Security Guarantees
- **No file browsing**: Students cannot view, edit, download, or delete existing files in the Drive folder.
- **Private files**: Files are stored with standard folder permissions and are NOT made public via shared links.
- **Overwrite prevention**: If a student submits multiple files with the same name, a unique timestamp is appended automatically (e.g. `Assignment_Rameez_Ali_20261103_182100.pdf`).
- **File extension preservation**: The original file extension is verified and kept intact.
