import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { messageService, ConversationDetail } from "../services/messages";
import { marketplaceService } from "../services/marketplace";
import { uploadService } from "../services/upload";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { useUnreadCount } from "../contexts/UnreadCountContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent, CardHeader } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import {
  ArrowLeft,
  Send,
  Package,
  ShoppingBag,
  Store,
  CheckCircle,
  ExternalLink,
} from "lucide-react";
import { cn } from "../lib/utils";

export default function ConversationPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [markingSold, setMarkingSold] = useState(false);
  const [newMessageAlert, setNewMessageAlert] = useState(false);
  const [, setCurrentTime] = useState(Date.now());
  const { user } = useAuth();
  const { addToast } = useToast();
  const { refreshUnreadCount } = useUnreadCount();
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessageCount = useRef(0);

  useEffect(() => {
    loadConversation();
    const interval = setInterval(loadConversation, 5000);
    const timeInterval = setInterval(() => setCurrentTime(Date.now()), 60000);
    return () => {
      clearInterval(interval);
      clearInterval(timeInterval);
    };
  }, [conversationId]);

  useEffect(() => {
    if (conversation?.messages) {
      const currentCount = conversation.messages.length;
      if (prevMessageCount.current > 0 && currentCount > prevMessageCount.current) {
        const latestMessage = conversation.messages[0];
        if (latestMessage && latestMessage.userId !== user?.id) {
          setNewMessageAlert(true);
          addToast("New message received!", "info");
          setTimeout(() => setNewMessageAlert(false), 3000);
        }
      }
      prevMessageCount.current = currentCount;
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [conversation?.messages, user?.id, addToast]);

  const loadConversation = async () => {
    try {
      const data = await messageService.getConversation(Number(conversationId));
      setConversation(data);
      await refreshUnreadCount();
    } catch (error) {
      console.error("Failed to load conversation:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending || !conversation) return;

    setSending(true);
    try {
      await messageService.sendMessage(conversation.id, newMessage.trim());
      setNewMessage("");
      await loadConversation();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to send message";
      addToast(message, "error");
    } finally {
      setSending(false);
    }
  };

  const handleMarkAsSold = async () => {
    if (!conversation || markingSold) return;

    if (!window.confirm("Mark this listing as sold? This will archive the conversation.")) {
      return;
    }

    setMarkingSold(true);
    try {
      const result = await marketplaceService.completeListing(conversation.listingId);
      addToast(`Listing marked as sold! +${result.pointsAwarded} points`, "success");
      await loadConversation();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to mark as sold";
      addToast(message, "error");
    } finally {
      setMarkingSold(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } else if (days === 1) {
      return "Yesterday";
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: "short" });
    } else {
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate("/messages")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Messages
        </Button>
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-gray-500">Conversation not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const sortedMessages = [...conversation.messages].reverse();
  const otherUser =
    conversation.seller.id === user?.id ? conversation.buyer : conversation.seller;
  const isSeller = conversation.role === "selling";
  const isArchived = conversation.listing.status === "completed";

  // Get listing image
  const imageUrls = uploadService.getListingImageUrls(conversation.listing.images);
  const thumbnailUrl = imageUrls[0];

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header with Product Card */}
      <Card className={`mb-4 ${newMessageAlert ? "ring-2 ring-primary animate-pulse" : ""}`}>
        <CardHeader className="py-3 px-4">
          <div className="flex items-start gap-4">
            {/* Back Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/messages")}
              className="shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            {/* Product Image */}
            <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-gray-100 shrink-0">
              {thumbnailUrl ? (
                <img
                  src={thumbnailUrl}
                  alt={conversation.listing.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="h-6 w-6 text-gray-400" />
                </div>
              )}
              {isArchived && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <span className="text-white text-[10px] font-medium">SOLD</span>
                </div>
              )}
            </div>

            {/* Product Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={isSeller ? "default" : "secondary"} className="text-xs">
                  {isSeller ? (
                    <>
                      <Store className="h-3 w-3 mr-1" />
                      Selling
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="h-3 w-3 mr-1" />
                      Buying
                    </>
                  )}
                </Badge>
                {isArchived && (
                  <Badge variant="outline" className="text-xs bg-gray-100">
                    Archived
                  </Badge>
                )}
                {newMessageAlert && (
                  <span className="text-xs text-primary font-medium animate-bounce">
                    New message!
                  </span>
                )}
              </div>
              <h2 className="font-semibold truncate mt-1">{conversation.listing.title}</h2>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>with {otherUser.name}</span>
                {conversation.listing.price !== null && (
                  <>
                    <span>-</span>
                    <span className="font-medium">
                      {conversation.listing.price === 0
                        ? "Free"
                        : `$${conversation.listing.price.toFixed(2)}`}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" asChild>
                <Link to={`/marketplace/${conversation.listingId}`}>
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
              {isSeller && !isArchived && (
                <Button
                  size="sm"
                  onClick={handleMarkAsSold}
                  disabled={markingSold}
                  className="bg-success text-success-foreground hover:bg-success/90"
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Mark Sold
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Messages */}
      <Card className="flex-1 overflow-hidden flex flex-col">
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
          {sortedMessages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            sortedMessages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex",
                  msg.userId === user?.id ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[70%] rounded-lg px-4 py-2",
                    msg.userId === user?.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  <p className="break-words">{msg.messageText}</p>
                  <p
                    className={cn(
                      "text-xs mt-1",
                      msg.userId === user?.id
                        ? "text-primary-foreground/70"
                        : "text-gray-500"
                    )}
                  >
                    {formatTime(msg.createdAt)}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </CardContent>

        {/* Message Input */}
        {isArchived ? (
          <div className="border-t p-4 bg-gray-50">
            <p className="text-center text-sm text-gray-500">
              This conversation is archived because the listing has been sold.
            </p>
          </div>
        ) : (
          <div className="border-t p-4">
            <form onSubmit={handleSend} className="flex gap-2">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                disabled={sending}
                className="flex-1"
              />
              <Button type="submit" disabled={sending || !newMessage.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        )}
      </Card>
    </div>
  );
}
