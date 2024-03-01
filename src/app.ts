import express from "express";
import multer from "multer";
import fs from "fs";
import cors from "cors";
import morgan from "morgan";
import path from "path";
import { promisify } from "util";

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
    const chunkStream = fs.createReadStream(chunkPath);

    await new Promise((resolve, reject) => {
      chunkStream.pipe(writeStream, { end: false });
      chunkStream.on("end", () => resolve(null));
      chunkStream.on("error", reject);
    });

    fs.unlinkSync(chunkPath);
  }
  writeStream.end();
};

app.post("/api/upload/chunk", upload.single("chunk"), async (req, res) => {
  const { chunkId, totalChunks, fileId } = req.body;
  const chunkPath = req.file?.path;
  const uploadDir = path.join(__dirname, "..", "uploads", fileId);

  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  if (chunkPath) {
    const chunkFileName = path.join(uploadDir, `${fileId}-${chunkId}`);
    fs.renameSync(chunkPath, chunkFileName);
  } else {
    // Handle the case where chunkPath is undefined
    console.error("chunkPath is undefined");
  }

  // Check if all chunks are uploaded
  const uploadedChunks = fs.readdirSync(uploadDir).length;
  if (uploadedChunks === parseInt(totalChunks)) {
    // All chunks are uploaded, proceed to merge
    const chunks = Array.from({ length: totalChunks }, (_, index) =>
      path.join(uploadDir, `${fileId}-${index}`)
    );
    const destination = path.join(uploadDir, "..", `${fileId}.mp4`);
    await mergeChunks(chunks, destination, totalChunks);

    // Cleanup: remove the chunks directory if needed
    fs.rmSync(uploadDir, { recursive: true });
    res.send({ message: "File uploaded and merged successfully." });
  } else {
    res.send({ message: "Chunk uploaded successfully." });
  }
});

export default app;
