'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenerativeAI } from '@google/generative-ai';

const pc = new Pinecone({
  apiKey: 'pcsk_6MpTEm_7VaqKShPByFSKTcTVE8hG3t9EyPpanzQcmFLRztsHbqGsZFXTWd7ZUYCHV3q5S9',
});

const genAI = new GoogleGenerativeAI('AIzaSyAOdtyU99g9xBbqCL1iltjDs31R7VjBOVE');

async function generateEmbeddings(text) {
  const model = genAI.getGenerativeModel({ model: 'embedding-001' });
  const result = await model.embedContent(text);
  const embedding = Array.isArray(result.embedding) ? result.embedding : Object.values(result.embedding);
  return embedding;
}

const generationConfig = {
  temperature: 1,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 8192,
  responseMimeType: 'text/plain',
};

async function fetchAIResponse(userQuery) {
  const queryEmbedding = await generateEmbeddings(userQuery);

  const searchResults = await pc
    .index('fashion')
    .namespace('4cc30482-b27e-46be-96e1-a8947bcf8d1b')
    .query({
      vector: queryEmbedding,
      topK: 5,
      includeMetadata: true,
    });

  const relevantContext = searchResults.matches.map((match) => match.metadata.text).join(' ');

  const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
  const chat = model.startChat({
    history: [
      {
        role: 'user',
        parts: [{ text: `Based on the following context: ${relevantContext}, answer the query: "${userQuery}"` }],
      },
    ],
  });

  let fullResponse = '';
  const resultStream = await chat.sendMessageStream(userQuery, generationConfig);

  for await (const chunk of resultStream.stream) {
    fullResponse += chunk.text();
  }

  return fullResponse;
}

export default function Chat() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);

  const handleInputChange = (e) => {
    setInput(e.target.value);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { id: Date.now(), role: 'user', content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      const aiResponse = await fetchAIResponse(userMessage.content);
      const aiMessage = { id: Date.now(), role: 'ai', content: aiResponse };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error fetching AI response:', error);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>AI Chat</CardTitle>
        </CardHeader>
        <CardContent className="h-[60vh] overflow-y-auto">
          {messages.map((m) => (
            <div key={m.id} className={`mb-4 ${m.role === 'user' ? 'text-right' : 'text-left'}`}>
              <span
                className={`inline-block p-2 rounded-lg ${
                  m.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-black'
                }`}
              >
                {m.content}
              </span>
            </div>
          ))}
          {isTyping && (
            <div className="text-left">
              <span className="inline-block p-2 rounded-lg bg-gray-200 text-black">
                AI is typing...
              </span>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <form onSubmit={onSubmit} className="flex w-full space-x-2">
            <Input
              value={input}
              onChange={handleInputChange}
              placeholder="Type your message..."
              className="flex-grow"
            />
            <Button type="submit" disabled={isTyping}>
              Send
            </Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  );
}
