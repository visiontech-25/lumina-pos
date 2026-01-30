import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, X, Send, Sparkles, HelpCircle, Phone, Mail } from 'lucide-react';
import userManualText from '../USER_MANUAL.md?raw';
import setupText from '../DOCS_01_SETUP_AND_SYNCS.md?raw';
import restaurantHardwareText from '../DOCS_03_RESTAURANT_HARDWARE.md?raw';
import securityText from '../DOCS_04_SECURITY_TROUBLESHOOTING.md?raw';

interface LuminaAIAssistantProps {
  isOpen: boolean;
  onClose: () => void;
}

const LuminaAIAssistant: React.FC<LuminaAIAssistantProps> = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    {
      role: 'assistant',
      content: "Hello! I'm Lumina AI, your personal assistant. How can I help you today? Ask me anything about using Lumina POS!"
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const streamTimerRef = useRef<number | null>(null);
  const isOpenRef = useRef<boolean>(false);

  useEffect(() => {
    isOpenRef.current = isOpen;
    return () => {
      // stop stream on close/unmount
      if (streamTimerRef.current) {
        window.clearInterval(streamTimerRef.current);
        streamTimerRef.current = null;
      }
    };
  }, [isOpen]);

  const docCorpus = useMemo(() => {
    // Only user-facing docs (no developer/internal architecture docs).
    return [
      { id: 'USER_MANUAL.md', title: 'User Manual', text: userManualText },
      { id: 'DOCS_03_RESTAURANT_HARDWARE.md', title: 'Restaurant & Hardware', text: restaurantHardwareText },
      { id: 'DOCS_04_SECURITY_TROUBLESHOOTING.md', title: 'Security & Troubleshooting', text: securityText },
      { id: 'DOCS_01_SETUP_AND_SYNCS.md', title: 'Setup & Syncs', text: setupText },
    ];
  }, []);

  const tokenize = (s: string): string[] => {
    // Split into "word-like" tokens but keep spacing readable.
    return s.split(/(\s+)/g).filter(t => t.length > 0);
  };

  const streamAssistantText = (fullText: string) => {
    // Cancel any existing stream.
    if (streamTimerRef.current) {
      window.clearInterval(streamTimerRef.current);
      streamTimerRef.current = null;
    }

    const tokens = tokenize(fullText);
    const startIdx = messages.length + 1; // optimistic: user message already appended

    // Add placeholder assistant message.
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    let i = 0;
    const baseDelayMs = 18; // faster than a 1s timeout, feels "live"
    streamTimerRef.current = window.setInterval(() => {
      if (!isOpenRef.current) {
        // stop streaming when panel closed
        if (streamTimerRef.current) window.clearInterval(streamTimerRef.current);
        streamTimerRef.current = null;
        return;
      }

      // Push 1-3 tokens per tick depending on punctuation
      const step = tokens[i] && /[.,!?;:]/.test(tokens[i]) ? 1 : 2;
      const nextI = Math.min(tokens.length, i + step);
      const chunk = tokens.slice(i, nextI).join('');
      i = nextI;

      setMessages(prev => {
        const copy = [...prev];
        const idx = copy.length - 1; // last should be assistant placeholder
        if (copy[idx]?.role === 'assistant') {
          copy[idx] = { ...copy[idx], content: (copy[idx].content || '') + chunk };
        }
        return copy;
      });

      if (i >= tokens.length) {
        if (streamTimerRef.current) window.clearInterval(streamTimerRef.current);
        streamTimerRef.current = null;
        setIsTyping(false);
      }
    }, baseDelayMs);
  };

  const findInDocs = (question: string): { sourceId: string; sourceTitle: string; excerpt: string } | null => {
    const q = question.toLowerCase();
    const keywords = q
      .split(/[^a-z0-9]+/g)
      .filter(w => w.length >= 4)
      .slice(0, 10);
    if (keywords.length === 0) return null;

    let best: { score: number; docIdx: number; lineIdx: number } | null = null;

    for (let d = 0; d < docCorpus.length; d++) {
      const lines = docCorpus[d].text.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].toLowerCase();
        let score = 0;
        for (const k of keywords) if (line.includes(k)) score++;
        if (!best || score > best.score) {
          best = { score, docIdx: d, lineIdx: i };
        }
      }
    }

    if (!best || best.score <= 0) return null;

    const doc = docCorpus[best.docIdx];
    const lines = doc.text.split('\n');
    const start = Math.max(0, best.lineIdx - 5);
    const end = Math.min(lines.length, best.lineIdx + 14);
    const excerpt = lines.slice(start, end).join('\n').trim();
    if (!excerpt) return null;
    return { sourceId: doc.id, sourceTitle: doc.title, excerpt };
  };

  // Knowledge base: human-like explanations for retailers and cashiers (not copy-paste from manual)
  const knowledgeBase: Record<string, string> = {
    'sale': `Of course! Here’s how you can make a sale:

1.  First, make sure you're on the **Terminal** screen. You can click it in the sidebar on the left.
2.  Use the search bar at the top to find a product. You can type its name, SKU, or just scan its barcode.
3.  You'll see the products appear in a grid. Just tap on a product to add it to the cart on the right.
4.  If you need to change the quantity, use the little **+** and **-** buttons next to the item in the cart.
5.  Once you're ready, click the big **'Complete Transaction'** button at the bottom of the cart.
6.  Choose how the customer is paying: **Cash**, **Card**, or **M-Pesa**.

And that's it! The sale is done, and a receipt should print out automatically.`,

    'add product': `I can help with that. To add a new product:

1.  Click on **'Inventory'** in the sidebar on the left.
2.  Look for a green button that says **'New Product'** at the top and click it.
3.  A form will pop up. Fill in the important details like the **product name**, **price**, and how many you have in **stock**.
4.  Click **'Commit'** to save the new product.

It will now be available to add to the cart in the Terminal!`,

    'check sales': `You can easily check your sales history. Here's how:

1.  Go to the **'Sales'** tab in the sidebar.
2.  You'll see a list of every transaction you've made.
3.  You can click on any sale to see more details, like which items were sold and how the customer paid.

If you want to see trends and summaries, check out the **'Reports'** tab!`,

    'mpesa': `Using M-Pesa is simple. When you're ready to complete a sale:

1.  Click the **'M-Pesa'** button as the payment method.
2.  A small window will appear asking for the customer's phone number.
3.  Type in their number and click **'Send Push Request'**.
4.  The customer will get a notification on their phone asking them to enter their M-Pesa PIN.

Once they enter their PIN, the sale will automatically complete on your screen. Just make sure you have an internet connection!`,

    'inventory': `To manage your inventory, go to the **'Inventory'** tab in the sidebar. From there, you can:

- **See all your products** and their current stock levels.
- **Adjust stock** by clicking on the number in the 'Stock' column for any product. You can add or remove items and give a reason, like 'New Shipment' or 'Damaged'.
- **Add new products** using the 'New Product' button.
- **Import products** in bulk from a CSV file if you have many to add at once.`,

    'quote': `To create a quote for a customer:

1.  Navigate to the **'Prospects'** tab on the sidebar.
2.  Click the **'New Quote'** button.
3.  Add products to the quote just like you would for a normal sale in the Terminal.
4.  Enter the customer's details (name, email, etc.).
5.  Save the quote. You can then send it to the customer, and when they're ready, you can convert it directly into a sale!`,

    'report': `To see how your business is doing, click on the **'Reports'** tab in the sidebar. This will show you a dashboard with:

- Your total sales for different time periods.
- Which products are your bestsellers.
- A breakdown of how customers are paying (Cash, Card, etc.).

You can filter the reports by date and export them if you need to.`,

    'sync': `If you're worried about data syncing, look at the top right of the screen. You'll see a status badge:

- **Green** means everything is synced with the cloud.
- **Orange** means you're offline. Don't worry, all your sales are saved on the device and will sync automatically once you're back online.
- **Blue** means there are changes waiting to be synced.

Everything is saved locally first, so you will never lose a sale, even if your internet goes down!`,

    'login': `If you're having trouble logging in, here are a few things to check:

1.  Make sure you're using the correct email and password.
2.  If you just created your account, you must first **verify your email**. Check your inbox for a verification link from us.
3.  If you've forgotten your password, you can use the 'Forgot Password' link on the login screen to reset it.`,

    'stock': `If you notice that stock levels aren't updating correctly:

- First, make sure the sale was completed successfully.
- Check your internet connection. If you're offline, the stock levels will update on your device but won't sync to the cloud until you're back online.
- Ensure you have the right permissions. Only users with 'Manage Inventory' permissions (like admins) can make manual stock adjustments.`
  };

  const findAnswer = (question: string): string => {
    const lowerQuestion = question.toLowerCase();
    
    // Check knowledge base
    for (const [key, answer] of Object.entries(knowledgeBase)) {
      if (lowerQuestion.includes(key)) {
        return answer;
      }
    }

    // Default responses for common patterns
    if (lowerQuestion.includes('hello') || lowerQuestion.includes('hi')) {
      return "Hello! I'm Lumina AI. How can I help you with Lumina POS today?";
    }

    if (lowerQuestion.includes('help')) {
      return `I can help you with:
- Processing sales
- Managing inventory
- Creating quotes
- Viewing reports
- Payment methods
- Troubleshooting issues

What would you like to know?`;
    }

    if (lowerQuestion.includes('contact') || lowerQuestion.includes('support') || lowerQuestion.includes('help me')) {
      return `I couldn't find a solution for your specific question. Please contact our support team:

📧 Email: support@vantixa.com
📱 WhatsApp: +254 700 000 000

Our support team is available:
- Monday-Friday: 9:00 AM - 6:00 PM EAT
- Saturday: 10:00 AM - 2:00 PM EAT

For emergencies: emergency@vantixa.com

They'll be happy to help you!`;
    }

    // Generic response
    const docHit = findInDocs(question);
    if (docHit) {
      return `Got you. Here’s the closest match I found in **${docHit.sourceTitle}**.\n\n${docHit.excerpt}\n\nSource: ${docHit.sourceId}\n\nIf you tell me what screen you're on (Terminal / Inventory / Restaurant / KDS / Settings), I’ll guide you step‑by‑step.`;
    }

    return `I can help with that — quick question first:\n\n- Are you using **Retail** or **Restaurant** mode?\n\nIf you want, open **User Manual** in the sidebar and tell me the heading you’re stuck on, and I’ll guide you like a teammate (not like a machine).`;
  };

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsTyping(true);

    // Stream response in "live typing" chunks.
    const answer = findAnswer(userMessage);
    streamAssistantText(answer);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl h-[600px] flex flex-col">
        {/* Header */}
        <div className="bg-indigo-600 text-white p-4 rounded-t-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            <h2 className="text-lg font-semibold">Lumina AI Assistant</h2>
          </div>
          <button
            onClick={onClose}
            className="hover:bg-indigo-700 rounded p-1 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                <div className="flex items-start gap-2">
                  {msg.role === 'assistant' && (
                    <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
                </div>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-lg p-3">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="border-t p-2 flex gap-2 overflow-x-auto">
          <button
            onClick={() => setInput('How do I process a sale?')}
            className="text-xs px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full hover:bg-indigo-100 whitespace-nowrap"
          >
            Process Sale
          </button>
          <button
            onClick={() => setInput('How do I add a product?')}
            className="text-xs px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full hover:bg-indigo-100 whitespace-nowrap"
          >
            Add Product
          </button>
          <button
            onClick={() => setInput('How do I check my sales?')}
            className="text-xs px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full hover:bg-indigo-100 whitespace-nowrap"
          >
            View Sales
          </button>
          <button
            onClick={() => setInput('Contact support')}
            className="text-xs px-3 py-1 bg-red-50 text-red-600 rounded-full hover:bg-red-100 whitespace-nowrap"
          >
            Contact Support
          </button>
        </div>

        {/* Input */}
        <div className="border-t p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask me anything about Lumina POS..."
              className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <HelpCircle className="w-3 h-3" />
              <span>Need help? Ask me anything!</span>
            </div>
            <div className="flex items-center gap-1">
              <Mail className="w-3 h-3" />
              <span>support@vantixa.com</span>
            </div>
            <div className="flex items-center gap-1">
              <Phone className="w-3 h-3" />
              <span>+254 700 000 000</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LuminaAIAssistant;
