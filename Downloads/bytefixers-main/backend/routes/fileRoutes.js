const express = require("express");
const router = express.Router();
const Task = require("../models/Task");
const { upload, cloudinary } = require("../config/fileuploadConfig");
const Project = require("../models/Project");
const https = require("https");
const Attachment = require("../models/Attachment"); // Add this import
const fetch = require("node-fetch"); // Add this if not already imported
// Upload file to a task
router.post("/upload/:taskId", upload.single("file"), async (req, res) => {
  try {
    const { taskId } = req.params;
    const { userId } = req.body;

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    console.log("Cloudinary upload result:", req.file);

    // Get the file extension from original filename
    const fileExtension = req.file.originalname.split(".").pop().toLowerCase();

    // Build a proper URL that will download with the correct extension
    // Format: base URL/extension/version/folder/filename.extension
    let fileUrl = req.file.path;

    // If the URL doesn't already have the file extension, add it
    if (!fileUrl.endsWith(`.${fileExtension}`)) {
      fileUrl = `${fileUrl}.${fileExtension}`;
    }

    // Get file details from the uploaded file
    const fileDetails = {
      fileName: req.file.originalname,
      fileUrl: fileUrl, // Use the URL with extension
      fileSize: req.file.size,
      fileType: req.file.mimetype,
      uploadedBy: userId,
      uploadedAt: new Date(),
      // Store the extension separately for easier reference
      fileExtension: fileExtension,
    };

    // Find the task and add the file
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    // Initialize attachments array if needed
    if (!task.attachments) {
      task.attachments = [];
    }

    // Add the file to task's attachments
    task.attachments.push(fileDetails);

    // Add activity log entry for the file upload
    task.activityLog.push({
      user: userId,
      action: "File Uploaded",
      details: {
        fileName: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
      },
      timestamp: new Date(),
    });

    await task.save();

    // Return the updated task with populated fields
    const updatedTask = await Task.findById(taskId)
      .populate("assignee", "name email")
      .populate("reporter", "name email")
      .populate("team", "name")
      .populate("attachments.uploadedBy", "name email");

    res.status(200).json(updatedTask);
  } catch (error) {
    console.error("Error uploading file:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Delete a file with activity logging
router.delete("/:taskId/:fileId", async (req, res) => {
  try {
    const { taskId, fileId } = req.params;
    const { userId } = req.body;

    // Find the task
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    // Find the file in attachments
    const fileIndex = task.attachments.findIndex(
      (attachment) => attachment._id.toString() === fileId
    );

    if (fileIndex === -1) {
      return res.status(404).json({ message: "File not found" });
    }

    // Get file details before deletion (for activity log)
    const deletedFile = task.attachments[fileIndex];

    // Extract file public ID from URL for Cloudinary deletion
    // Example: "http://res.cloudinary.com/your-cloud-name/image/upload/v1234567890/task-attachments/abcdef"
    // We need to extract "task-attachments/abcdef"
    const fileUrl = deletedFile.fileUrl;
    const publicIdMatch = fileUrl.match(/\/v\d+\/([^.]+)/);

    if (publicIdMatch?.[1]) {
      // Delete from Cloudinary
      await cloudinary.uploader.destroy(publicIdMatch[1]);
    }

    // Remove the file from attachments
    task.attachments.splice(fileIndex, 1);

    // Add to activity log
    task.activityLog.push({
      user: userId,
      action: "File Deleted",
      details: {
        fileName: deletedFile.fileName,
        fileType: deletedFile.fileType,
      },
      timestamp: new Date(),
    });

    // Save the task
    await task.save();

    // Return updated task with populated fields
    const updatedTask = await Task.findById(taskId)
      .populate("assignee", "name email")
      .populate("reporter", "name email")
      .populate("team", "name")
      .populate("attachments.uploadedBy", "name email");

    res.status(200).json(updatedTask);
  } catch (error) {
    console.error("Error deleting file:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get all files for a task
router.get("/:taskId/files", async (req, res) => {
  try {
    const { taskId } = req.params;

    // Find the task
    const task = await Task.findById(taskId)
      .select("attachments")
      .populate("attachments.uploadedBy", "name email");

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    res.status(200).json(task.attachments || []);
  } catch (error) {
    console.error("Error fetching files:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Helper function to format file size
function formatFileSize(bytes) {
  if (!bytes) return "0 Bytes";

  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));

  return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(2))} ${sizes[i]}`;
}
// Replace your existing /user/:userId route with this fixed version

router.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`Fetching files for user: ${userId}`);

    // Find all projects where the user is a member
    const projects = await Project.find({
      $or: [{ creator: userId }, { members: userId }],
    }).select("_id name task");

    if (!projects || projects.length === 0) {
      console.log("No projects found for this user");
      return res.status(200).json([]);
    }

    console.log(`Found ${projects.length} projects for user`);

    // Get all tasks from these projects
    let allFiles = [];

    for (const project of projects) {
      console.log(`Processing project: ${project.name} (${project._id})`);

      // Safety check: ensure project has task array
      if (
        !project.task ||
        !Array.isArray(project.task) ||
        project.task.length === 0
      ) {
        console.log(`Project ${project._id} has no tasks, skipping`);
        continue;
      }

      console.log(`Project has ${project.task.length} tasks`);

      // Find tasks for this project
      const tasks = await Task.find({
        _id: { $in: project.task },
      })
        .populate("attachments.uploadedBy", "name email")
        .select("title attachments");

      console.log(`Found ${tasks.length} tasks for project ${project._id}`);

      // Extract files from each task
      let fileCount = 0;
      tasks.forEach((task) => {
        if (task.attachments && task.attachments.length > 0) {
          fileCount += task.attachments.length;

          // For each attachment, add task and project context
          const filesWithContext = task.attachments.map((file) => {
            const fileObj = file.toObject();
            return {
              ...fileObj,
              taskId: task._id,
              taskTitle: task.title,
              projectId: project._id,
              projectName: project.name,
            };
          });

          allFiles = allFiles.concat(filesWithContext);
        }
      });

      console.log(`Added ${fileCount} files from project ${project._id}`);
    }

    // Sort files by upload date (newest first)
    allFiles.sort(
      (a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0)
    );

    console.log(`Returning ${allFiles.length} total files`);

    // Add debugging information to help identify issues
    const simplifiedFiles = allFiles.map((file) => ({
      id: file._id,
      name: file.fileName,
      taskId: file.taskId,
      projectId: file.projectId,
    }));
    console.log("Files summary:", JSON.stringify(simplifiedFiles, null, 2));

    res.status(200).json(allFiles);
  } catch (error) {
    console.error("Error fetching user files:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});
// Replace your download route with this enhanced version:

// In your fileRoutes.js
// Replace your current download route
// Better download route that handles all file types
// Update your download route
// Update your download route with this more reliable approach
const axios = require("axios"); // npm install axios

// Replace your download route with this simpler approach
router.get("/download/:taskId/:fileId", async (req, res) => {
  try {
    const { taskId, fileId } = req.params;

    // Find the task that contains the file
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    // Find the file in the task's attachments array
    const file = task.attachments.find(
      (attachment) => attachment._id.toString() === fileId
    );

    if (!file) {
      return res.status(404).json({ message: "File not found" });
    }

    console.log(`Found file: ${file.fileName}, URL: ${file.fileUrl}`);

    // Instead of trying to fetch the file with authorization,
    // create a temporary server-side download and pipe it to the client
    const https = require("https");

    // Set up response headers for download
    res.setHeader("Content-Type", file.fileType || "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(file.fileName)}"`
    );

    // Make a request to Cloudinary without authentication
    // and pipe the response directly to the client
    https
      .get(file.fileUrl, (cloudinaryResponse) => {
        // Check if we got a successful response
        if (cloudinaryResponse.statusCode !== 200) {
          console.error(
            `Error from Cloudinary: ${cloudinaryResponse.statusCode}`
          );
          return res.status(cloudinaryResponse.statusCode).json({
            message: `Error downloading file: Cloudinary returned ${cloudinaryResponse.statusCode}`,
          });
        }

        // Set Content-Length header if available
        if (cloudinaryResponse.headers["content-length"]) {
          res.setHeader(
            "Content-Length",
            cloudinaryResponse.headers["content-length"]
          );
        }

        // Pipe the response directly to the client
        cloudinaryResponse.pipe(res);
      })
      .on("error", (err) => {
        console.error("Error during file download:", err);
        res
          .status(500)
          .json({ message: `Error downloading file: ${err.message}` });
      });
  } catch (error) {
    console.error("Error downloading file:", error);
    return res
      .status(500)
      .json({ message: `Error downloading file: ${error.message}` });
  }
});
module.exports = router;
