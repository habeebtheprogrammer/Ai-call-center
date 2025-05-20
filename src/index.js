require('dotenv').config({ path: '.env' });
const express = require('express');
const cors = require('cors');
const twilio = require('twilio');
const { TextToSpeechClient } = require('@google-cloud/text-to-speech');
const bodyParser = require('body-parser');
const { SpeechClient } = require('@google-cloud/speech');
const axios = require('axios');
const morgan = require('morgan');

// Initialize app and middleware
const app = express();

// Add all middleware
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false })); // for parsing form-encoded data from Twilio
app.use(bodyParser.json()); // for parsing JSON data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev', {
  stream: process.stdout
}));

// Add logging middleware to see webhook requests
app.use((req, res, next) => {
  console.log(`Webhook request received: ${req.method} ${req.path}`);
  // console.log('Request body:', req.body);
  // console.log('Request query:', req.query);
  // console.log('Request headers:', req.headers);
  next();
});

// Create a custom Morgan format
const customFormat = ':method :url :status :response-time ms - :res[content-length] :req[content-length] :req[body]';
app.use(morgan(customFormat, {
  skip: function (req, res) {
    return req.url === '/health' || req.url === '/ping';
  },
  stream: process.stdout
}));

// Initialize clients
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const textToSpeechClient = new TextToSpeechClient();
const speechClient = new SpeechClient();
const ngrokUrl = process.env.NGROK_URL || 'http://localhost:4000';

const openai = axios.create({
  baseURL: 'https://api.openai.com/v1',
  headers: {
    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    'Content-Type': 'application/json'
  }
});

// Call state management
const calls = new Map();

// Helper functions
function getGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  return 'evening';
}


// Add logging middleware to see webhook requests
app.use((req, res, next) => {
  console.log(`Webhook request received: ${req.method} ${req.path}`);
  next();
});

// Handle Twilio status callback
app.post('/api/call/status', async (req, res) => {
  try {
    const { CallSid, CallStatus, AccountSid } = req.body;
    console.log('Status callback received:', {
      CallSid,
      CallStatus,
      AccountSid
    });

    // Look for the call by CallSid
    const callEntry = Array.from(calls.entries()).find(([_, callData]) => callData.twilioCallSid === CallSid);
    if (callEntry) {
      const [callId, callData] = callEntry;
      console.log('Found call for status update:', callId, callData);
      
      // Update the call status
      callData.state = CallStatus;
      calls.set(callId, callData);
      console.log('Updated call status:', callId, callData);
    } else {
      console.log('No call found for status update:', CallSid);
    }

    res.send('<Response></Response>');
  } catch (error) {
    console.error('Error in status callback:', error);
    res.status(500).send('<Response></Response>');
  }
});

// Start a new call
app.post('/api/call/start', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    
    // Create a new call instance
    const callId = Date.now().toString();
    const callData = {
      phoneNumber,
      state: 'active',
      messages: [],
      startTime: new Date(),
      twilioCallSid: '' // Initialize with empty string
    };
    calls.set(callId, callData);
 

    // Get ngrok URL
    console.log('Using webhook URL:', ngrokUrl);

    // Make the call
    const twilioCall = await twilioClient.calls.create({
      twiml: `
        <Response>
          <Say voice="man">
            Good ${getGreeting()}, this is ${process.env.AGENT_NAME || 'AI Assistant'} calling from ${process.env.COMPANY_NAME || 'Our Company'}. 
            I hope you're doing well today. I'm reaching out regarding your recent interaction with us. 
            Do you have a quick minute to share your feedback?
          </Say>
          <Pause length="2"/>
          <Say>Please respond now.</Say>
          <Gather input="speech" action="${ngrokUrl}/api/call/speech" method="POST" 
                  speechTimeout="auto" timeout="10" language="en-US">
            <Say>Please respond now.</Say>
          </Gather>
        </Response>
      `,
      to: phoneNumber,
      from: process.env.TWILIO_PHONE_NUMBER
    });

    
    // Store the Twilio CallSid immediately
    console.log('Twilio call created with SID:', twilioCall.sid);
    const storedCall = calls.get(callId);
    if (storedCall) {
      storedCall.twilioCallSid = twilioCall.sid;
      storedCall.state = 'ringing'; // Update state to match Twilio's status
      calls.set(callId, storedCall);
      console.log('Updated call data:', storedCall);
    } else {
      console.error('Could not find call to update:', callId);
    }
    setTimeout(() => {
      res.json({ success: true, callId, twilioCallSid: twilioCall.sid });
    }, 100);
  } catch (error) {
    console.error('Error starting call:', error);
    res.status(500).json({ error: 'Failed to start call' });
  }
});

// Handle Twilio webhook for speech
app.post('/api/call/speech', async (req, res) => {
  try {
 

    // Get the call SID from the request
    const callSid = req.body.CallSid || req.query.CallSid;
    if (!callSid) {
      console.error('No CallSid found in request');
      return res.status(400).send('<Response><Say>Error: No call SID found</Say></Response>');
    }

    // Look up the call by Twilio CallSid using status callback
    const allCalls = Array.from(calls.entries());
    console.log('All calls:', allCalls);
    
    // First try to find by Twilio CallSid
    let callEntry = allCalls.find(([_, callData]) => { 
      return callData.twilioCallSid === callSid;
    });

    // If not found, try to find by callId
    if (!callEntry) {
      console.log('Trying to find by callId');
      callEntry = allCalls.find(([callId, callData]) => {
        console.log('Checking call by ID:', callId);
        return callId === callSid;
      });
    }
    if (!callEntry) {
      return res.status(404).send('<Response><Say>Error: Call not found</Say></Response>');
    }
    const [callId, call] = callEntry;
    console.log('Found call:', callId, call);

    // Get the transcription
    const transcription = req.body.TranscriptionText || req.body.SpeechResult || '';
    if (!transcription) {
      console.error('No transcription found in request');
      return res.status(400).send('<Response><Say>Error: No transcription found</Say></Response>');
    }
    if (!transcription) {
      console.error('No transcription received');
      return res.status(400).send('<Response></Response>');
    }

    // Log the transcription
    console.log('Received transcription:', transcription);

    // Add transcription to call history
    call.messages.push({
      type: 'speech',
      content: transcription,
      timestamp: new Date()
    });

      // Process with ChatGPT
      const response = await processWithChatGPT(transcription);
      console.log("response", response);
      
      // Add response to call history
      call.messages.push({
        type: 'response',
        content: response,
        timestamp: new Date()
      });

      // Return TwiML response with Twilio's text-to-speech and keep conversation going
    res.set('Content-Type', 'text/xml');
    res.send(`
      <Response>
        <Say voice="man">${response}</Say>
        <Pause length="1"/>
        <Say>Please respond now.</Say>
        <Gather input="speech" action="${ngrokUrl}/api/call/speech" method="POST" 
                speechTimeout="auto" timeout="10" language="en-US">
          <Say>Please respond now.</Say>
        </Gather>
      </Response>
    `);
  } catch (error) {
    console.error('Error processing speech:', error?.response?.data, error);
    if (error?.response?.data?.message?.type == "insufficient_quota" ) {
      res.set('Content-Type', 'text/xml');
      res.send(`
        <Response>
          <Say>I've reached my daily limit for responses. Please try again later or contact support for assistance.</Say>
          <Gather input="speech" action="${ngrokUrl}/api/call/speech" method="POST" 
                  speechTimeout="auto" timeout="10" language="en-US">
            <Say>Please respond now.</Say>
          </Gather>
        </Response>
      `);
      return;
    }
    
    // Handle other errors
    res.set('Content-Type', 'text/xml');
    res.send(`
      <Response>
        <Say>I'm having trouble processing your request. Please try again.</Say>
        <Gather input="speech" action="${ngrokUrl}/api/call/speech" method="POST" 
                speechTimeout="auto" timeout="10" language="en-US">
          <Say>Please respond now.</Say>
        </Gather>
      </Response>
    `);
  }
})

// Process with ChatGPT
async function processWithChatGPT(prompt) {
  try {
    const response = await openai.post('/chat/completions', {
      model: 'gpt-4.1-nano',
      messages: [
        {
          role: 'system',
          content: 'You are a professional customer service representative. Keep responses concise and professional.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 100,
      temperature: 0.7
    });

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Error processing with ChatGPT:', error);
    throw error;
  }
}

// Convert text to speech using Google TTS
async function convertTextToSpeech(text) {
  try {
    const [audioResponse] = await textToSpeechClient.synthesizeSpeech({
      input: { text },
      voice: {
        languageCode: 'en-US',
        name: 'en-US-Neural2-D',
        ssmlGender: 'MALE'
      },
      audioConfig: {
        audioEncoding: 'MP3'
      }
    });

    return audioResponse.audioContent.toString('base64');
  } catch (error) {
    console.error('Error converting text to speech:', error);
    throw error;
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
