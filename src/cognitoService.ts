import { CognitoIdentityServiceProvider } from "aws-sdk";
import { ENV } from "./constants";

const cognito = new CognitoIdentityServiceProvider();

const clientId = ENV.aws_cognito_client_id;

const userPoolId = ENV.aws_cognito_user_pool_id;

// Initiate authentication flow to send OTP to user's phone number.

// Function to initiate sending OTP to user's phone number
export const sendOtp = async (
  phoneNumber: string
): Promise<CognitoIdentityServiceProvider.InitiateAuthResponse | undefined> => {
  try {
    // First, attempt to get the user to see if they already exist
    try {
      await cognito
        .adminGetUser({
          UserPoolId: userPoolId,
          Username: phoneNumber,
        })
        .promise();
      // If the above call succeeds, the user exists, and no error is thrown
    } catch (error: any) {
      if (error.code === "UserNotFoundException") {
        // User does not exist, create the user
        await cognito
          .adminCreateUser({
            UserPoolId: userPoolId,
            Username: phoneNumber,
            UserAttributes: [
              {
                Name: "phone_number",
                Value: phoneNumber,
              },
              {
                Name: "phone_number_verified",
                Value: "true", // Set to "true" if you are verifying phone numbers elsewhere
              },
            ],
            // Temporary password. You may choose to auto-confirm users to bypass the need for an initial password
            TemporaryPassword: "TempPassword123!", // Consider using a secure, random password
            MessageAction: "SUPPRESS", // Use SUPPRESS if you do not want to send an invitation message
          })
          .promise();
      } else {
        // If the error is not UserNotFoundException, rethrow it
        throw error;
      }
    }

    // Proceed to initiate custom auth flow with OTP
    const params = {
      AuthFlow: "CUSTOM_AUTH",
      ClientId: clientId,
      AuthParameters: {
        USERNAME: phoneNumber,
      },
    };

    const response = await cognito.initiateAuth(params).promise();
    return response;
  } catch (error) {
    console.error("Error in sendOtp:", error);
    throw error;
  }
};

// Verify the user-submitted OTP.

export const verifyOtp = async (
  phoneNumber: string,
  code: string,
  session: string
): Promise<
  CognitoIdentityServiceProvider.RespondToAuthChallengeResponse | undefined
> => {
  try {
    const params = {
      ChallengeName: "CUSTOM_CHALLENGE",
      ClientId: clientId,
      ChallengeResponses: {
        USERNAME: phoneNumber,
        ANSWER: code,
      },
      Session: session,
    };

    const response = await cognito.respondToAuthChallenge(params).promise();

    return response;
  } catch (error) {
    console.error("Error verifying OTP:", error);
    throw error;
  }
};
