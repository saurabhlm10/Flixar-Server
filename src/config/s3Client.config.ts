import { S3Client } from "@aws-sdk/client-s3";
import { ENV } from "../constants";

const s3Client = new S3Client({
  region: "ap-south-1",
  credentials: {
    accessKeyId: ENV.S3_ACCESS_KEY_ID,
    secretAccessKey: ENV.S3_ACCESS_KEY_SECRET,
  },
});

export default s3Client;
