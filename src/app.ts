import express from "express";
import multer from "multer";
import fs from "fs";
import cors from "cors";
import morgan from "morgan";
import path from "path";
import { ENV } from "./constants";

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

app.post("/api/upload/chunk", upload.single("chunk"), async (req, res) => {
  const { chunkId, totalChunks, fileId } = req.body;
  const chunkPath = req.file?.path;
  const uploadDir = path.join(__dirname, "uploads", fileId);

  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  if (chunkPath) {
    const chunkFileName = path.join(uploadDir, `chunk-${chunkId}`);
    fs.renameSync(chunkPath, chunkFileName);
  } else {
    return res.status(400).send("No chunk file received.");
  }

  // Check if all chunks are uploaded by comparing the number of files in the directory
  const uploadedChunks = fs
    .readdirSync(uploadDir)
    .filter((file) => file.startsWith("chunk-")).length;
  if (uploadedChunks === parseInt(totalChunks)) {
    // All chunks are uploaded, proceed to merge
    const chunks = Array.from({ length: uploadedChunks }, (_, index) =>
      path.join(uploadDir, `chunk-${index}`)
    );

    const destination = path.join(__dirname, "uploads", `${fileId}.mp4`);
    try {
      await mergeChunks(chunks, destination, uploadedChunks);
      fs.rmSync(uploadDir, { recursive: true, force: true }); // Ensure cleanup
      res.send({ message: "File uploaded and merged successfully." });
    } catch (error) {
      console.error("Error merging chunks:", error);
      res.status(500).send("Error merging file chunks.");
    }
  } else {
    res.send({ message: "Chunk uploaded successfully." });
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

export default app;
