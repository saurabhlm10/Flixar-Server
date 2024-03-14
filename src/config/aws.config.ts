import { config } from "aws-sdk";
import { ENV } from "../constants";

export const awsConfig = () =>
  config.update({
    region: "ap-south-1", // replace with your Cognito User Pool region
    credentials: {
      accessKeyId: ENV.aws_key,
      secretAccessKey: ENV.aws_secret,
    },
  });
