"use client"
import { useState } from 'react';
// import { Phone, Play, Pause, Stop } from 'react-icons/ai';

export default function Home() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [callId, setCallId] = useState('');
  const [callActive, setCallActive] = useState(false);
  const [callHistory, setCallHistory] = useState([]);
  const [status, setStatus] = useState('idle');

  const handleStartCall = async () => {
    try {
      setStatus('calling');
      const response = await fetch('http://localhost:4000/api/call/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phoneNumber }),
      });

      const data = await response.json();
      if (data.success) {
        setCallId(data.callId);
        setCallActive(true);
        setStatus('active');
      }
    } catch (error) {
      console.error('Error starting call:', error);
      setStatus('error');
    }
  };

  const handleEndCall = async () => {
    // Implementation for ending call
    setCallActive(false);
    setStatus('idle');
  };

  const handleTranscription = async (transcription) => {
    // Implementation for sending transcription to server
    console.log('Transcription:', transcription);
  };

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold mb-8 text-center">AI Calling Center</h1>

        <div className="mb-8">
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Phone Number
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              placeholder="Enter phone number"
            />
          </div>

          <div className="flex justify-center gap-4">
            <button
              onClick={handleStartCall}
              disabled={callActive || !phoneNumber}
className="btn btn-primary focus:outline-none focus:shadow-outline disabled:opacity-50"
            >
              {/* <Phone className="inline-block w-5 h-5 mr-2" /> */}
              Start Call
            </button>

            {callActive && (
              <button
                onClick={handleEndCall}
  className="btn btn-danger focus:outline-none focus:shadow-outline"
              >
                {/* <Stop className="inline-block w-5 h-5 mr-2" /> */}
                End Call
              </button>
            )}
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-xl font-bold mb-4">Call History</h2>
          <div className="space-y-4">
            {callHistory.map((message, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg ${
                  message.type === 'speech'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                <p className="font-bold">{message.type === 'speech' ? 'Lead:' : 'AI:'}</p>
                <p>{message.content}</p>
                <p className="text-sm text-gray-600">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
