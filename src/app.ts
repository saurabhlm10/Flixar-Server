import express, { Request, Response } from "express";
import multer from "multer";
import fs from "fs";
import cors from "cors";
import morgan from "morgan";
import path from "path";
import { ENV } from "./constants";
import {
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import s3Client from "./config/s3Client.config";
import { awsConfig } from "./config/aws.config";
awsConfig();

import AWS from "aws-sdk";
const sns = new AWS.SNS();

import { sendOtp, verifyOtp } from "./cognitoService";

const upload = multer({ dest: "uploads/" });
const app = express();

app.use(morgan("dev"));
app.use(cors());
app.use(express.json());

// Helper function to merge chunks
const mergeChunks = async (
  chunks: string[],
  destination: string,
  totalChunks: number
) => {
  const writeStream = fs.createWriteStream(destination);

  for (let i = 0; i < totalChunks; i++) {
    const chunkPath = chunks[i];
    if (!fs.existsSync(chunkPath)) {
      console.error(`Missing chunk: ${chunkPath}`);
      continue; // Consider better error handling for production
    }
    const chunkStream = fs.createReadStream(chunkPath);

    await new Promise((resolve, reject) => {
      chunkStream.pipe(writeStream, { end: false });
      chunkStream.on("end", resolve);
      chunkStream.on("error", reject);
    });

    fs.unlinkSync(chunkPath); // Delete chunk file after merging
  }
  writeStream.end();
};

// Define the SSEConnections interface
interface SSEConnections {
  [uploadId: string]: (data: any) => void;
}

// Declare the sseConnections object on the global object
declare global {
  var sseConnections: SSEConnections;
}

// Initialize sseConnections
global.sseConnections = global.sseConnections || {};

app.get("/api/progress/:uploadId", (req, res) => {
  const { uploadId } = req.params;

  // Set headers for SSE
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const sendProgressUpdate = (data: any) => {
    console.log("event sent");
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Store the sendProgressUpdate function using uploadId as key
  global.sseConnections[uploadId] = sendProgressUpdate;

  // Remove the connection when client closes the connection
  req.on("close", () => {
    delete global.sseConnections[uploadId];
  });
});

// ... rest of your code
app.post("/api/upload/initiate", async (req: Request, res: Response) => {
  const { fileId } = req.body;

  const createMultipartUploadCommand = new CreateMultipartUploadCommand({
    Bucket: ENV.S3_BUCKET_NAME,
    Key: `${fileId}.mp4`,
  });

  try {
    const { UploadId } = await s3Client.send(createMultipartUploadCommand);
    res.send({ UploadId });
  } catch (err) {
    console.error("Error initiating upload to S3:", err);
    res.status(500).send("Failed to initiate upload.");
  }
});

app.get("/progress/:uploadId", (req, res) => {
  const { uploadId } = req.params;

  // Set headers for SSE
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const sendProgressUpdate = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Store the sendProgressUpdate function using uploadId as key
  global.sseConnections[uploadId] = sendProgressUpdate;

  // Remove the connection when client closes the connection
  req.on("close", () => {
    delete global.sseConnections[uploadId];
  });
});

app.post("/api/upload/chunk", upload.single("chunk"), async (req, res) => {
  const { chunkId, fileId, uploadId } = req.body;

  const file = req.file;

  if (!file) {
    res.status(400).send({ message: "No file received" });
    return;
  }

  // Check if the chunk is empty
  if (file.size === 0) {
    res.status(400).send({ message: "Empty chunk received" });
    return;
  }

  const params = {
    Bucket: ENV.S3_BUCKET_NAME, // Your S3 Bucket name
    Key: `${fileId}.mp4`,
    PartNumber: chunkId,
    UploadId: uploadId,
    Body: fs.createReadStream(file.path),
  };

  const command = new UploadPartCommand(params);

  try {
    // Send the command to S3
    const { ETag } = await s3Client.send(command);

    res.send({
      message: "Chunk uploaded successfully.",
      ETag,
    });
    // Send a progress update if there's a connection for this uploadId
    if (global.sseConnections[uploadId]) {
      const progressData = {
        chunkId,
        progress: "Some progress value or message",
      };
      global.sseConnections[uploadId](progressData);
    }

    fs.unlink(file.path, () => {
      console.log("unlinked");
    });
  } catch (err) {
    console.error("Error uploading chunk to S3:", err);
    res.status(500).send("Failed to upload chunk.");
  }
});

app.post("/api/upload/merge", async (req: Request, res: Response) => {
  const { fileId, uploadId, etags } = req.body;

  if (etags.length === 0) {
    return res.status(400).send("No chunks to merge");
  }

  // Complete the multipart upload
  const completeMultipartUploadCommand = new CompleteMultipartUploadCommand({
    Bucket: ENV.S3_BUCKET_NAME,
    Key: `${fileId}.mp4`,
    UploadId: uploadId,
    MultipartUpload: {
      Parts: etags,
    },
  });

  try {
    await s3Client.send(completeMultipartUploadCommand);
    res.send({ message: "File merged successfully." });
  } catch (err) {
    console.error("Error merging file:", err);
    res.status(500).send("Failed to merge file.");
  }
});
// Endpoint to query the progress of an upload
app.get("/api/upload/progress/:fileId", (req, res) => {
  const { fileId } = req.params;
  const uploadDir = path.join(__dirname, "uploads", fileId);

  if (!fs.existsSync(uploadDir)) {
    return res.json({ uploadedChunks: [] });
  }

  const chunkFiles = fs.readdirSync(uploadDir);
  const uploadedChunks = chunkFiles
    .map((file) => {
      const match = file.match(/chunk-(\d+)/);
      return match ? parseInt(match[1], 10) : null;
    })
    .filter((chunkId) => chunkId !== null);

  res.json({ uploadedChunks });
});

app.get("/api/empty-uploads-directory", (req, res) => {
  const uploadsDir =
    ENV.env === "dev"
      ? path.join(__dirname, "../uploads")
      : path.join(__dirname, "uploads");

  fs.readdir(uploadsDir, (err, files) => {
    if (err) {
      console.error("Failed to list directory contents:", err);
      return res.status(500).send("Failed to empty uploads directory.");
    }

    files.forEach((file) => {
      const filePath = path.join(uploadsDir, file);
      fs.stat(filePath, (err, stat) => {
        if (err) {
          console.error("Failed to stat file:", err);
          return;
        }

        if (stat.isDirectory()) {
          // Recursively delete directories
          fs.rmdir(filePath, { recursive: true }, (err) => {
            if (err) console.error("Failed to remove directory:", err);
          });
        } else {
          // Delete files
          fs.unlink(filePath, (err) => {
            if (err) console.error("Failed to delete file:", err);
          });
        }
      });
    });

    res.send("Uploads directory emptied");
  });
});

async function sendSNS(phoneNumber: string) {
  const params = {
    Message: `Hello fron Nodejs SNS 2`,
    PhoneNumber: phoneNumber,
  };
  return sns.publish(params).promise();
}

app.post("/api/send-otp", async (req: Request, res: Response) => {
  try {
    const { phoneNumber } = req.body;

    const response = await sendOtp(phoneNumber);

    // const response = await sendSNS(phoneNumber);

    res.json(response);
  } catch (error: any) {
    res.status(500).send(error.toString());
  }
});

app.post("/api/verify-otp", async (req: Request, res: Response) => {
  try {
    const { phoneNumber, code, session } = req.body;

    const response = await verifyOtp(phoneNumber, code, session);
    res.json(response);
  } catch (error: any) {
    res.status(500).send(error.toString());
  }
});

export default app;
