# AI Calling Center

An AI-powered calling center using Twilio for voice calls, Google Cloud Text-to-Speech and Speech-to-Text, and OpenAI's GPT-3.5 for natural conversation processing.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file with your credentials:
```bash
cp .env.example .env
```

3. Update the `.env` file with your credentials:
- TWILIO_ACCOUNT_SID
- TWILIO_AUTH_TOKEN
- TWILIO_PHONE_NUMBER
- GOOGLE_APPLICATION_CREDENTIALS
- OPENAI_API_KEY

4. Start the server:
```bash
npm start
```

## Features

- Automated outbound calls using Twilio
- Real-time speech-to-text conversion using Google Cloud Speech-to-Text
- Natural language processing using OpenAI's GPT-3.5
- Text-to-speech using Google Cloud Text-to-Speech
- Call state management and history
- Configurable call duration and retry limits

## API Endpoints

- POST `/api/call/start` - Start a new call
- POST `/api/call/speech` - Process incoming speech and generate responses

## Requirements

- Node.js 16+
- Twilio Account
- Google Cloud Project with Text-to-Speech and Speech-to-Text enabled
- OpenAI API Key
- Valid phone number for Twilio
