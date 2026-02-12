import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { messageService, ConversationDetail, Message } from "../services/messages";
import { marketplaceService } from "../services/marketplace";
import { uploadService } from "../services/upload";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { useUnreadCount } from "../contexts/UnreadCountContext";
import {
  useWebSocket,
  WS_EVENTS,
  type NewMessagePayload,
} from "../contexts/WebSocketContext";
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
  UserCheck,
  XCircle,
} from "lucide-react";
import { cn } from "../lib/utils";
import { formatMessageTime } from "../utils/dateFormatting";

export default function ConversationPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [markingSold, setMarkingSold] = useState(false);
  const [reserving, setReserving] = useState(false);
  const [newMessageAlert, setNewMessageAlert] = useState(false);
  const [, setCurrentTime] = useState(Date.now());
  const { user } = useAuth();
  const { addToast } = useToast();
  const { refreshUnreadCount } = useUnreadCount();
  const { subscribe, isConnected } = useWebSocket();
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessageCount = useRef(0);

  useEffect(() => {
    loadConversation();
    // Increase polling interval since WebSocket handles real-time updates
    // Keep polling as fallback when WebSocket is not connected
    const pollingInterval = isConnected ? 30000 : 5000;
    const interval = setInterval(loadConversation, pollingInterval);
    const timeInterval = setInterval(() => setCurrentTime(Date.now()), 60000);
    return () => {
      clearInterval(interval);
      clearInterval(timeInterval);
    };
  }, [conversationId, isConnected]);

  // Subscribe to WebSocket new message events for this conversation
  useEffect(() => {
    const unsubscribe = subscribe<NewMessagePayload>(
      WS_EVENTS.NEW_MESSAGE,
      (payload) => {
        // Only handle messages for the current conversation
        if (payload.conversationId !== Number(conversationId)) {
          return;
        }

        // Add the new message to the conversation
        setConversation((prev) => {
          if (!prev) return prev;

          // Check if message already exists (avoid duplicates)
          const messageExists = prev.messages.some(
            (m) => m.id === payload.message.id
          );
          if (messageExists) return prev;

          // Add new message at the beginning (messages are sorted desc by createdAt)
          return {
            ...prev,
            messages: [payload.message as Message, ...prev.messages],
          };
        });

        // Show notification for messages from other users
        if (payload.senderId !== user?.id) {
          setNewMessageAlert(true);
          addToast(`${payload.senderName}: ${payload.message.messageText.slice(0, 50)}${payload.message.messageText.length > 50 ? '...' : ''}`, "info");
          setTimeout(() => setNewMessageAlert(false), 3000);
        }

        // Mark messages as read since we're viewing the conversation
        messageService.markAsRead(Number(conversationId));
        refreshUnreadCount();
      }
    );

    return unsubscribe;
  }, [conversationId, subscribe, user?.id, addToast, refreshUnreadCount]);

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
      // Pass the buyer's ID from the conversation
      await marketplaceService.completeListing(
        conversation.listingId,
        conversation.buyer.id
      );
      addToast("Listing marked as sold!", "success");
      await loadConversation();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to mark as sold";
      addToast(message, "error");
    } finally {
      setMarkingSold(false);
    }
  };

  const handleReserve = async () => {
    if (!conversation || reserving) return;

    if (!window.confirm(`Reserve this listing for ${conversation.buyer.name}?`)) {
      return;
    }

    setReserving(true);
    try {
      await marketplaceService.reserveListingForBuyer(
        conversation.listingId,
        conversation.buyer.id
      );
      addToast(`Listing reserved for ${conversation.buyer.name}!`, "success");
      await loadConversation();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to reserve listing";
      addToast(message, "error");
    } finally {
      setReserving(false);
    }
  };

  const handleUnreserve = async () => {
    if (!conversation || reserving) return;

    if (!window.confirm("Cancel this reservation? The buyer will be notified.")) {
      return;
    }

    setReserving(true);
    try {
      await marketplaceService.unreserveListing(conversation.listingId);
      addToast("Reservation cancelled", "success");
      await loadConversation();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to cancel reservation";
      addToast(message, "error");
    } finally {
      setReserving(false);
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
            <p className="text-muted-foreground">Conversation not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const sortedMessages = [...conversation.messages].reverse();
  const otherUser =
    conversation.seller.id === user?.id ? conversation.buyer : conversation.seller;
  const isSeller = conversation.role === "selling";
  const isArchived = conversation.listing.status === "completed" || conversation.listing.status === "sold";
  const isReserved = conversation.listing.status === "reserved";
  const isReservedForThisBuyer = isReserved && conversation.listing.buyerId === conversation.buyer.id;
  const isActive = conversation.listing.status === "active";

  // Get listing image
  const imageUrls = uploadService.getListingImageUrls(conversation.listing.images);
  const thumbnailUrl = imageUrls[0];

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] sm:h-[calc(100vh-10rem)] lg:h-[calc(100vh-8rem)]">
      {/* Header with Product Card */}
      <Card className={`mb-3 ${newMessageAlert ? "ring-2 ring-primary animate-pulse" : ""}`}>
        <CardHeader className="py-3 px-4 space-y-3">
          <div className="flex items-center gap-3">
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
            <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-muted shrink-0">
              {thumbnailUrl ? (
                <img
                  src={thumbnailUrl}
                  alt={conversation.listing.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="h-6 w-6 text-muted-foreground" />
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
                  <Badge variant="outline" className="text-xs bg-muted">
                    Archived
                  </Badge>
                )}
                {isReservedForThisBuyer && (
                  <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                    Reserved
                  </Badge>
                )}
                {newMessageAlert && (
                  <span className="text-xs text-primary font-medium animate-bounce">
                    New message!
                  </span>
                )}
              </div>
              <h2 className="font-semibold text-sm truncate mt-1">{conversation.listing.title}</h2>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <span className="truncate">with {otherUser.name}</span>
                {conversation.listing.price !== null && (
                  <>
                    <span className="shrink-0">·</span>
                    <span className="font-medium shrink-0 text-foreground">
                      {conversation.listing.price === 0
                        ? "Free"
                        : `$${conversation.listing.price.toFixed(2)}`}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons - separate row to prevent overlap on mobile */}
          <div className="flex items-center gap-2 justify-end flex-wrap">
            <Button variant="outline" size="sm" asChild>
              <Link to={`/marketplace/${conversation.listingId}`}>
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                View Listing
              </Link>
            </Button>
            {isSeller && !isArchived && (
              <>
                {/* Reserve/Unreserve button */}
                {isActive && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleReserve}
                    disabled={reserving}
                  >
                    <UserCheck className="h-3.5 w-3.5 mr-1" />
                    Reserve
                  </Button>
                )}
                {isReservedForThisBuyer && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleUnreserve}
                    disabled={reserving}
                    className="text-destructive hover:text-destructive"
                  >
                    <XCircle className="h-3.5 w-3.5 mr-1" />
                    Unreserve
                  </Button>
                )}
                {/* Mark Sold button */}
                <Button
                  size="sm"
                  onClick={handleMarkAsSold}
                  disabled={markingSold}
                  className="bg-success text-success-foreground hover:bg-success/90"
                >
                  <CheckCircle className="h-3.5 w-3.5 mr-1" />
                  Mark Sold
                </Button>
              </>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Messages */}
      <Card className="flex-1 overflow-hidden flex flex-col">
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
          {sortedMessages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
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
                        : "text-muted-foreground"
                    )}
                  >
                    {formatMessageTime(msg.createdAt)}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </CardContent>

        {/* Message Input */}
        {isArchived ? (
          <div className="border-t p-4 bg-muted">
            <p className="text-center text-sm text-muted-foreground">
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
