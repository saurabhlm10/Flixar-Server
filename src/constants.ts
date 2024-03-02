import dotenv from "dotenv";
dotenv.config();

const port = process.env.PORT;

const S3_ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID as string;
const S3_ACCESS_KEY_SECRET = process.env.S3_ACCESS_KEY_SECRET as string;
const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME as string;

export const ENV = {
  port,
  S3_ACCESS_KEY_ID,
  S3_ACCESS_KEY_SECRET,
  S3_BUCKET_NAME,
};
