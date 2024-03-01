import express from "express";
import multer from "multer";
import fs from "fs";
import cors from "cors";
import morgan from "morgan";
import path from "path";

const upload = multer({ dest: "uploads/" });
const app = express();

app.use(morgan("dev"));
app.use(cors());
app.use(express.json());

app.post("/api/upload/chunk", upload.single("chunk"), (req, res) => {
  const { chunkId } = req.body;
  const { file } = req;

  if (!file) return res.status(400).send("No chunk uploaded.");

  // For simplicity, this example just logs the chunkId and file details.
  // In a real implementation, you would store these chunks with their IDs, reassemble them once all are received, and possibly track the upload status in a database.
  console.log(`Received chunk ${chunkId}:`, file);

  res.send(`Chunk ${chunkId} uploaded successfully.`);
});

export default app;
