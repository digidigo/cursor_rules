import { ChatContainer } from "@/components/chat/chat-container";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center p-4 sm:p-8 md:p-24">
      <div className="w-full">
        <h1 className="text-4xl font-bold text-center mb-8">Financial Assistant</h1>
        <ChatContainer />
      </div>
    </main>
  );
} 