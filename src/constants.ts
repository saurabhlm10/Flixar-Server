import dotenv from "dotenv";
dotenv.config();

const port = process.env.PORT;

const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME as string;
const aws_key = process.env.AWS_ACCESS_KEY_ID as string;
const aws_secret = process.env.AWS_ACCESS_KEY_SECRET as string;
const aws_cognito_client_id = process.env.AWS_COGNITO_CLIENT_ID as string;
const aws_cognito_user_pool_id = process.env.AWS_COGNITO_USER_POOL_ID as string;

export const ENV = {
  port,
  S3_BUCKET_NAME,
  aws_key,
  aws_secret,
  aws_cognito_client_id,
  aws_cognito_user_pool_id,
};
