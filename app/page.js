'use client'
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { stripIndents } from './stripindents';
import Image from 'next/image';

const pc = new Pinecone({
  apiKey: 'pcsk_6MpTEm_7VaqKShPByFSKTcTVE8hG3t9EyPpanzQcmFLRztsHbqGsZFXTWd7ZUYCHV3q5S9',
});

const genAI = new GoogleGenerativeAI('AIzaSyAfMcjDE5LkLCm4W9JDx6TGc5AD7awF8eI');

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
  responseMimeType: "application/json",
  responseSchema: {
    type: "object",
    properties: {
      productName: {
        type: "string"
      },
      productUrl: {
        type: "string"
      },
      productPrice: {
        type: "string"
      },
      productImage: {
        type: "string"
      },
      productCategory: {
        type: "string"
      },
      productColor: {
        type: "string"
      }
    }
  },
};

async function fetchAIResponse(userQuery) {
  const queryEmbedding = await generateEmbeddings(userQuery);

  const searchResults = await pc
    .index('fashion')
    .namespace('fff3cb26-15f5-41ce-b06c-d573ad93ee88')
    .query({
      vector: queryEmbedding,
      topK: 5,
      includeMetadata: true,
    });

  const relevantContext = searchResults.matches.map((match) => match.metadata.text).join(' ');

  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-pro',
    systemInstruction:
      "act as you was a retail store with girls cloths the girl will tell you the product and situation you need to give prouduct based on the given context only not outside the contexty recomand 4 products only i want response in format of {productName:string,productUrl:string,productPrice:string,productImage:string,productCategory:string,productColor:string} respond me in json format only no text more than that",
  });

  const chat = model.startChat({
    history: [
      {
        role: 'user',
        parts: [
          {
            text: `Based on the following context: ${relevantContext},recommend products for : "${userQuery} answer should be from context only"`,
          },
        ],
      },
    ],
  });

  let fullResponse = '';
  const resultStream = await chat.sendMessageStream(userQuery, generationConfig);

  for await (const chunk of resultStream.stream) {
    fullResponse += chunk.text();
  }

  try {
    const cleanedResponse = stripIndents(fullResponse);

    const aiProducts = JSON.parse(cleanedResponse);
    return aiProducts;
  } catch (error) {
    console.error('Error parsing AI response as JSON:', error);
    return []; // Return an empty array as fallback
  }
}


export default function Chat() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]); // Store messages as an array of objects
  const [isTyping, setIsTyping] = useState(false);

  const handleInputChange = (e) => {
    setInput(e.target.value);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { id: Date.now(), role: 'user', content: input.trim() };
    setMessages((prevMessages) => [...prevMessages, userMessage]); // Add user message to chat
    setIsTyping(true);

    try {
      const aiProducts = await fetchAIResponse(userMessage.content);
      const aiMessage = { id: Date.now(), role: 'ai', content: aiProducts }; // AI response
      setMessages((prevMessages) => [...prevMessages, aiMessage]); // Add AI response to chat
    } catch (error) {
      console.error('Error fetching AI response:', error);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Card className="w-full max-w-2xl ">
<CardHeader className="flex items-center justify-between flex-row h-5">
 
    <CardTitle className="text-xl font-semibold">AI Chat</CardTitle>
    <img
      src="logo.png" // Replace with your logo path
      alt="Company Logo"
      width={100}
      height={100}
    />
</CardHeader>


        <CardContent className="h-[60vh] overflow-y-auto">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`mb-4 ${message.role === 'user' ? 'text-right' : 'text-left'}`}
            >
              <span
                className={`inline-block p-2 rounded-lg ${message.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-black'
                  }`}
              >
                {message.role === 'user' ? (
                  message.content
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {message.content
                      .filter((product) => product.productImage)
                      .map((product, index) => (
                        <div key={index} className="p-2 border rounded-lg">
                          <img
                            src={product.productImage}
                            alt={product.productName}
                            className="w-full h-48 object-cover mb-2"
                            onError={(e) => (e.target.parentNode.style.display = 'none')} // Hide the entire product if the image fails to load
                          />
                          <h3 className="font-semibold">{product.productName}</h3>
                          <p className="text-sm">{product.productPrice}</p>
                          <a
                            href={product.productUrl}
                            className="text-blue-500"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            View Product
                          </a>
                        </div>
                      ))}
                  </div>
                )}

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
