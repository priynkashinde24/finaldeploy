import axios from "axios";

/**
 * Send OTP via SMS using Fast2SMS API
 * @param phone - Phone number (10 digits, without country code)
 * @param otp - OTP code to send
 * @returns Promise<void>
 */
export const sendOTP = async (phone: string, otp: string): Promise<void> => {
  try {
    const apiKey = process.env.FAST2SMS_API_KEY;

    if (!apiKey) {
      throw new Error('FAST2SMS_API_KEY environment variable is not set');
    }

    // Remove any non-digit characters and ensure phone is 10 digits
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);

    if (cleanPhone.length !== 10) {
      throw new Error(`Invalid phone number format. Expected 10 digits, got: ${cleanPhone}`);
    }

    const response = await axios.post(
      "https://www.fast2sms.com/dev/bulkV2",
      {
        route: "q",
        message: `Your OTP is ${otp}. Do not share it with anyone.`,
        language: "english",
        numbers: cleanPhone,
      },
      {
        headers: {
          authorization: apiKey,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ OTP SMS sent:", response.data);
  } catch (error: any) {
    console.error("❌ SMS sending failed:", error.response?.data || error.message);
    throw error;
  }
};

