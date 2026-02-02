/**
 * SMS Service
 * 
 * Currently logs messages to console. To enable real SMS:
 * 1. Install Twilio: npm install twilio
 * 2. Set environment variables: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
 * 3. Uncomment the Twilio implementation below
 */

export async function sendSms(to: string, message: string): Promise<void> {
  // For development: log to console
  console.log(`[SMS] To: ${to}`);
  console.log(`[SMS] Message: ${message}`);
  console.log("---");

  // TODO: Uncomment when Twilio is configured
  /*
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    console.warn("Twilio credentials not configured. SMS not sent.");
    return;
  }

  const client = require('twilio')(accountSid, authToken);
  
  try {
    await client.messages.create({
      body: message,
      from: fromNumber,
      to: to,
    });
    console.log(`SMS sent successfully to ${to}`);
  } catch (error) {
    console.error(`Failed to send SMS to ${to}:`, error);
    throw error;
  }
  */
}







