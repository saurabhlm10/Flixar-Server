import express from "express";
import { upload } from "./utils/multer";
import cors from "cors";
import morgan from "morgan";

const app = express();

app.use(morgan("dev"));
app.use(cors());
app.use(express.json());

app.post("/api/upload", upload.single("video"), (req, res) => {
  if (!req.file) return res.status(400).send("No file uploaded.");

  console.log(req.file); // For debugging, shows file details in the console
  res.send("File uploaded successfully.");
});

export default app;
