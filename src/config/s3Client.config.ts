import { S3Client } from "@aws-sdk/client-s3";
import { ENV } from "../constants";

const s3Client = new S3Client({
  region: "ap-south-1",
  credentials: {
    accessKeyId: ENV.aws_key,
    secretAccessKey: ENV.aws_secret,
  },
});

export default s3Client;
